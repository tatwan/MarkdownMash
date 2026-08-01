const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const db = require('./db');
const { createOpaqueToken, hashOpaqueToken } = require('./security-utils');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the invitation database integration test');
}

const inspectionPool = new Pool({ connectionString: process.env.DATABASE_URL });

async function waitForSchema() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      await db.listHostedInstructors();
      return;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Timed out waiting for the database schema');
}

async function createInvitation({ email, displayName, masterId, expiresAt, token }) {
  return db.createHostedAccountInvitation({
    email,
    displayName,
    username: `hosted_${createOpaqueToken(12)}`,
    passwordHash: await bcrypt.hash(createOpaqueToken(), 4),
    tokenHash: hashOpaqueToken(token),
    expiresAt,
    createdBy: masterId
  });
}

async function run() {
  await waitForSchema();
  const suffix = createOpaqueToken(8).toLowerCase();
  const master = await db.createAdmin({
    username: `master_${suffix}`,
    passwordHash: await bcrypt.hash('master integration password', 4),
    email: `master-${suffix}@example.com`,
    emailVerifiedAt: new Date(),
    displayName: 'Integration Master',
    role: 'master'
  });

  const email = `teacher-${suffix}@example.com`;
  const firstToken = createOpaqueToken();
  const first = await createInvitation({
    email,
    displayName: 'First Name',
    masterId: master.id,
    expiresAt: new Date(Date.now() + 60_000),
    token: firstToken
  });
  assert.ok(await db.getHostedAccountInvitation(hashOpaqueToken(firstToken)));

  const stored = await inspectionPool.query(
    'SELECT token_hash, used_at FROM account_invitations WHERE id = $1',
    [first.invitation.id]
  );
  assert.equal(stored.rows[0].token_hash.equals(hashOpaqueToken(firstToken)), true);
  assert.equal(stored.rows[0].token_hash.includes(Buffer.from(firstToken)), false);

  const replacementToken = createOpaqueToken();
  await createInvitation({
    email,
    displayName: 'Updated Name',
    masterId: master.id,
    expiresAt: new Date(Date.now() + 60_000),
    token: replacementToken
  });
  assert.equal(await db.getHostedAccountInvitation(hashOpaqueToken(firstToken)), null);
  assert.equal(
    (await db.getHostedAccountInvitation(hashOpaqueToken(replacementToken))).display_name,
    'Updated Name'
  );

  const finalPassword = 'correct horse battery staple';
  const finalPasswordHash = await bcrypt.hash(finalPassword, 4);
  const activations = await Promise.all([
    db.activateHostedAccountInvitation({ tokenHash: hashOpaqueToken(replacementToken), passwordHash: finalPasswordHash }),
    db.activateHostedAccountInvitation({ tokenHash: hashOpaqueToken(replacementToken), passwordHash: finalPasswordHash })
  ]);
  assert.equal(activations.filter(Boolean).length, 1);
  assert.equal(await db.getHostedAccountInvitation(hashOpaqueToken(replacementToken)), null);

  const account = await db.getAdminByEmail(email);
  assert.equal(account.account_status, 'active');
  assert.ok(account.email_verified_at);
  assert.equal(await bcrypt.compare(finalPassword, account.password_hash), true);

  const expiredToken = createOpaqueToken();
  await createInvitation({
    email: `expired-${suffix}@example.com`,
    displayName: 'Expired Instructor',
    masterId: master.id,
    expiresAt: new Date(Date.now() - 1000),
    token: expiredToken
  });
  assert.equal(await db.getHostedAccountInvitation(hashOpaqueToken(expiredToken)), null);

  const rls = await inspectionPool.query(
    "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.account_invitations'::regclass"
  );
  assert.equal(rls.rows[0].relrowsecurity, true);

  console.log('Hosted invitation database integration tests passed');
}

run()
  .finally(async () => {
    await inspectionPool.end();
    await db.close();
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
