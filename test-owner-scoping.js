const assert = require('node:assert/strict');
const {
  ownerFilterFor,
  canAdminAccessStoredSession,
  canControlSession
} = require('./controller-authorization');

// Roles come from the admins table: role TEXT DEFAULT 'admin' (db.js:65),
// with a single 'master' row for the deployment owner.
const master = { id: 1, role: 'master' };
const hostA = { id: 7, role: 'admin' };
const hostB = { id: 9, role: 'admin' };

// --- ownerFilterFor ---
//
// The return value feeds ($1::integer IS NULL OR owner_id = $1) in db.js.
// null disables the filter, so every account's sessions come back.

assert.equal(
  ownerFilterFor(hostA),
  7,
  'a hosted admin is scoped to their own owner_id'
);

assert.equal(
  ownerFilterFor(master),
  1,
  'the master is scoped to their own owner_id, not given an unfiltered view'
);

assert.notEqual(
  ownerFilterFor(master),
  null,
  'ownerFilterFor never returns null, which would disable the SQL owner filter'
);

// --- canAdminAccessStoredSession ---

assert.equal(
  canAdminAccessStoredSession(hostA, { owner_id: 7 }),
  true,
  'a host reaches their own stored session'
);

assert.equal(
  canAdminAccessStoredSession(hostA, { owner_id: 9 }),
  false,
  'a host cannot reach another host\'s stored session'
);

assert.equal(
  canAdminAccessStoredSession(master, { owner_id: 1 }),
  true,
  'the master reaches their own stored session'
);

assert.equal(
  canAdminAccessStoredSession(master, { owner_id: 7 }),
  false,
  'the master cannot reach another host\'s stored session, participants, or export'
);

// A null owner_id predates the owner_id column and therefore predates
// multi-admin: it can only be a session the master created when they were the
// only account. It is their own history, not another host's data.
assert.equal(
  canAdminAccessStoredSession(master, { owner_id: null }),
  true,
  'the master keeps access to their own pre-migration sessions'
);

assert.equal(
  canAdminAccessStoredSession(hostA, { owner_id: null }),
  false,
  'a hosted host is never handed a legacy unowned session'
);

// --- canControlSession ---
//
// Live-room control is the one cross-host power the master keeps, so an
// in-progress room can be rescued. Deliberate, and asserted so a future
// change to it is a decision rather than an accident.

const liveRoomOfHostA = {
  kind: 'persistent',
  controller: { type: 'admin', id: 7 }
};

assert.equal(
  canControlSession({ type: 'admin', id: 1, role: 'master' }, liveRoomOfHostA),
  true,
  'the master retains emergency control of a live room'
);

assert.equal(
  canControlSession({ type: 'admin', id: 9, role: 'admin' }, liveRoomOfHostA),
  false,
  'a host cannot control another host\'s live room'
);

assert.equal(
  canControlSession({ type: 'admin', id: 7, role: 'admin' }, liveRoomOfHostA),
  true,
  'a host controls their own live room'
);

console.log('All owner scoping tests passed.');
