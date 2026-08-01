const assert = require('assert');
const {
  createPersistentSessionRepository,
  createTransientSessionRepository
} = require('./session-repository');
const {
  canAdminAccessStoredSession,
  canControlSession
} = require('./controller-authorization');
const { createTrialManager } = require('./trial-manager');

async function run() {
  let timestamp = 1_780_000_000_000;
  let idCounter = 0;
  const manager = createTrialManager({
    secret: 'test-secret-that-is-long-enough',
    ttlMs: 20 * 60 * 1000,
    maxConcurrent: 2,
    startsPerIpHour: 2,
    now: () => timestamp,
    idFactory: () => `trial-${++idCounter}`
  });

  const first = manager.create({ ipAddress: '127.0.0.1', sessionCode: 'TAAAAA' });
  const firstPrincipal = manager.authenticate(first.token);
  assert.equal(firstPrincipal.type, 'trial');
  assert.equal(firstPrincipal.id, 'trial-1');
  assert.equal(firstPrincipal.sessionCode, 'TAAAAA');

  const trialSession = {
    kind: 'trial',
    controller: { type: 'trial', id: firstPrincipal.id }
  };
  assert.equal(canControlSession(firstPrincipal, trialSession), true);
  assert.equal(
    canControlSession({ type: 'trial', id: 'someone-else' }, trialSession),
    false
  );
  assert.equal(
    canControlSession({ type: 'admin', id: 1, role: 'master' }, trialSession),
    false
  );

  const realSession = {
    kind: 'persistent',
    controller: { type: 'admin', id: 7 }
  };
  assert.equal(
    canControlSession({ type: 'admin', id: 7, role: 'admin' }, realSession),
    true
  );
  assert.equal(
    canControlSession({ type: 'admin', id: 8, role: 'admin' }, realSession),
    false
  );
  assert.equal(
    canControlSession({ type: 'admin', id: 1, role: 'master' }, realSession),
    true
  );
  assert.equal(canControlSession(firstPrincipal, realSession), false);

  assert.equal(
    canAdminAccessStoredSession({ id: 3, role: 'admin' }, { owner_id: 3 }),
    true
  );
  assert.equal(
    canAdminAccessStoredSession({ id: 3, role: 'admin' }, { owner_id: 4 }),
    false
  );
  assert.equal(
    canAdminAccessStoredSession({ id: 1, role: 'master' }, { owner_id: null }),
    true
  );

  let persistentCalls = 0;
  const fakeDb = new Proxy({}, {
    get() {
      return async () => {
        persistentCalls++;
        return { id: 'db-participant' };
      };
    }
  });
  const persistent = createPersistentSessionRepository(fakeDb, 44, 'REAL44');
  await persistent.createParticipant('Persisted', null, 'shades');
  await persistent.updateParticipantAvatar('db-participant', 'boo');
  await persistent.recordAnswer('db-participant', 0, 1, true, 1200);
  assert.equal(persistentCalls, 3);

  const transient = createTransientSessionRepository({
    idFactory: () => 'memory-participant'
  });
  const transientParticipant = await transient.createParticipant('Temporary', null, 'zap');
  assert.equal(transientParticipant.id, 'memory-participant');
  assert.equal(transientParticipant.avatarId, 'zap');
  await transient.updateParticipantAvatar('memory-participant', 'stella');
  await transient.recordAnswer('memory-participant', 0, 2, true, 900);
  await transient.updateParticipantScore('memory-participant', 20, 1);
  assert.equal(persistentCalls, 3, 'Transient activity must not call the database');

  await transient.kickParticipant('memory-participant');
  assert.equal(await transient.isParticipantKicked('memory-participant'), true);

  manager.create({ ipAddress: '127.0.0.2', sessionCode: 'TBBBBB' });
  assert.throws(
    () => manager.create({ ipAddress: '127.0.0.3', sessionCode: 'TCCCCC' }),
    error => error.code === 'TRIAL_CAPACITY_REACHED'
  );

  timestamp += 20 * 60 * 1000 + 1;
  const expired = manager.removeExpired();
  assert.equal(expired.length, 2);
  assert.throws(
    () => manager.authenticate(first.token),
    error => ['TRIAL_TOKEN_INVALID', 'TRIAL_EXPIRED'].includes(error.code)
  );

  console.log('Guest trial isolation tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
