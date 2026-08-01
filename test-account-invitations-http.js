const assert = require('node:assert/strict');
const { createOpaqueToken } = require('./security-utils');

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3109';
const masterPassword = process.env.TEST_MASTER_PASSWORD;
if (!masterPassword) throw new Error('TEST_MASTER_PASSWORD is required');

async function request(path, { token, body, method = body ? 'POST' : 'GET' } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  return { response, data };
}

async function run() {
  const config = await request('/api/admin/auth/config');
  assert.equal(config.response.status, 200);
  assert.equal(config.data.invitationActivation, true);

  const masterLogin = await request('/api/admin/login', {
    body: { email: '', password: masterPassword }
  });
  assert.equal(masterLogin.response.status, 200);
  assert.equal(masterLogin.data.admin.role, 'master');
  const masterToken = masterLogin.data.token;

  const suffix = createOpaqueToken(8).toLowerCase();
  const email = `http-${suffix}@example.com`;
  const created = await request('/api/admin/invitations', {
    token: masterToken,
    body: { email, displayName: 'HTTP Test Instructor' }
  });
  assert.equal(created.response.status, 201);
  const inviteUrl = new URL(created.data.invitation.inviteUrl);
  const invitationToken = new URLSearchParams(inviteUrl.hash.slice(1)).get('invite');
  assert.ok(invitationToken);
  assert.equal(inviteUrl.search, '');

  const inspected = await request('/api/admin/invite/inspect', {
    body: { token: invitationToken }
  });
  assert.equal(inspected.response.status, 200);
  assert.notEqual(inspected.data.invitation.maskedEmail, email);

  const shortPassword = await request('/api/admin/invite/activate', {
    body: { token: invitationToken, password: 'too-short' }
  });
  assert.equal(shortPassword.response.status, 400);

  const password = 'a memorable hosted password';
  const activated = await request('/api/admin/invite/activate', {
    body: { token: invitationToken, password }
  });
  assert.equal(activated.response.status, 200);
  assert.equal(activated.data.email, email);

  const reused = await request('/api/admin/invite/inspect', {
    body: { token: invitationToken }
  });
  assert.equal(reused.response.status, 404);

  const instructorLogin = await request('/api/admin/login', {
    body: { email, password }
  });
  assert.equal(instructorLogin.response.status, 200);
  assert.equal(instructorLogin.data.admin.authSource, 'hosted');
  const instructorToken = instructorLogin.data.token;

  const forbiddenCreate = await request('/api/admin/invitations', {
    token: instructorToken,
    body: { email: `forbidden-${suffix}@example.com`, displayName: 'Forbidden' }
  });
  assert.equal(forbiddenCreate.response.status, 403);
  const forbiddenList = await request('/api/admin/instructors', { token: instructorToken });
  assert.equal(forbiddenList.response.status, 403);

  const billing = await request('/api/admin/billing', { token: instructorToken });
  assert.equal(billing.response.status, 200);
  assert.equal(billing.data.subscription, null);

  const markdown = '# Integration Quiz\n\n## Q1: Ready?\n- [x] Yes\n- [ ] No';
  const blockedRoom = await request('/api/admin/session', {
    token: instructorToken,
    body: { markdown }
  });
  assert.equal(blockedRoom.response.status, 402);

  const masterRoom = await request('/api/admin/session', {
    token: masterToken,
    body: { markdown }
  });
  assert.equal(masterRoom.response.status, 200);
  await request(`/api/admin/session/${masterRoom.data.session.code}/end`, {
    token: masterToken,
    method: 'POST'
  });

  const instructors = await request('/api/admin/instructors', { token: masterToken });
  assert.equal(instructors.response.status, 200);
  const account = instructors.data.instructors.find(item => item.email === email);
  assert.equal(account.emailVerified, true);
  assert.equal(account.subscriptionStatus, null);
  assert.ok(account.invitationExpiresAt);
  assert.ok(account.invitationUsedAt);

  const duplicate = await request('/api/admin/invitations', {
    token: masterToken,
    body: { email, displayName: 'Duplicate' }
  });
  assert.equal(duplicate.response.status, 409);

  console.log('Hosted invitation HTTP integration tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
