const assert = require('assert');
const {
  getParticipantAdmission,
  parsePositiveInteger,
  resolveParticipantLimitForAdmin,
  resolvePersistentParticipantLimit
} = require('./participant-capacity');

assert.equal(parsePositiveInteger('50', 10), 50);
assert.equal(parsePositiveInteger('0', 10), 10);
assert.equal(parsePositiveInteger('not-a-number', 10), 10);

assert.equal(
  resolvePersistentParticipantLimit({ hostedMode: false, configuredLimit: '50' }),
  null,
  'Self-hosted rooms must remain unrestricted by the hosted plan limit'
);
assert.equal(
  resolvePersistentParticipantLimit({ hostedMode: true, configuredLimit: '50' }),
  50
);
assert.equal(
  resolvePersistentParticipantLimit({ hostedMode: true, configuredLimit: 'invalid' }),
  50,
  'Hosted rooms default to 50 participants when configuration is invalid'
);
assert.equal(
  resolveParticipantLimitForAdmin({ id: 1, role: 'master' }, 50),
  null,
  'The trusted master account must remain unrestricted'
);
assert.equal(
  resolveParticipantLimitForAdmin({ id: 2, role: 'admin' }, 50),
  50,
  'Normal hosted instructor accounts must retain the plan limit'
);

const fullRoom = {
  participantLimit: 2,
  participants: {
    first: { id: 'first' },
    second: { id: 'second' }
  }
};

assert.deepStrictEqual(getParticipantAdmission(fullRoom), {
  allowed: false,
  code: 'ROOM_FULL',
  participantCount: 2,
  participantLimit: 2
});
assert.deepStrictEqual(
  getParticipantAdmission(fullRoom, { isValidRejoin: true }),
  { allowed: true, isRejoin: true },
  'A valid reconnect must not consume another room slot'
);

const availableRoom = {
  participantLimit: 2,
  participants: { first: { id: 'first' } }
};
assert.deepStrictEqual(getParticipantAdmission(availableRoom), {
  allowed: true,
  isRejoin: false,
  participantCount: 1,
  participantLimit: 2
});

const finalSeatReserved = {
  participantLimit: 2,
  pendingParticipantJoins: 1,
  participants: { first: { id: 'first' } }
};
assert.deepStrictEqual(getParticipantAdmission(finalSeatReserved), {
  allowed: false,
  code: 'ROOM_FULL',
  participantCount: 2,
  participantLimit: 2
}, 'An in-flight join must reserve its seat before the database write completes');

console.log('Participant capacity guardrail tests passed');
