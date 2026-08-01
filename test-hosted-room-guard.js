const assert = require('node:assert/strict');
const {
  HOSTED_ROOM_LIMIT_CODE,
  assertHostedRoomAvailable,
  shouldEnforceSingleOpenRoom
} = require('./hosted-room-guard');

async function run() {
  assert.equal(
    shouldEnforceSingleOpenRoom({ hostedMode: true, admin: { id: 7, role: 'admin' } }),
    true,
    'ordinary hosted accounts should have one open-room slot'
  );
  assert.equal(
    shouldEnforceSingleOpenRoom({ hostedMode: true, admin: { id: 1, role: 'master' } }),
    false,
    'the trusted master account should bypass the hosted concurrency guard'
  );
  assert.equal(
    shouldEnforceSingleOpenRoom({ hostedMode: false, admin: { id: 7, role: 'admin' } }),
    false,
    'self-hosted deployments should remain unrestricted'
  );

  const availableQueries = [];
  await assertHostedRoomAvailable({
    async query(sql, params) {
      availableQueries.push({ sql, params });
      return { rows: [] };
    }
  }, 7);
  assert.match(availableQueries[0].sql, /pg_advisory_xact_lock/);
  assert.deepEqual(availableQueries[0].params, ['markdown_mash_hosted_room', 7]);
  assert.match(availableQueries[1].sql, /status IN \('created', 'active'\)/);

  let queryCount = 0;
  await assert.rejects(
    () => assertHostedRoomAvailable({
      async query() {
        queryCount++;
        if (queryCount === 1) return { rows: [{ pg_advisory_xact_lock: '' }] };
        return {
          rows: [{ code: 'ROOM42', status: 'active', quiz_title: 'Existing quiz' }]
        };
      }
    }, 12),
    error => {
      assert.equal(error.code, HOSTED_ROOM_LIMIT_CODE);
      assert.equal(error.existingSession.code, 'ROOM42');
      assert.match(error.message, /end, recover, or delete/i);
      return true;
    }
  );

  await assert.rejects(
    () => assertHostedRoomAvailable({ query: async () => ({ rows: [] }) }, null),
    /valid room owner/i
  );

  console.log('Hosted room concurrency guard tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
