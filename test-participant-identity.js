const assert = require('assert');
const {
  canReuseParticipant,
  normalizeParticipantName
} = require('./participant-identity');
const {
  createParticipantStore
} = require('./public/js/participant-storage');

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

assert.strictEqual(normalizeParticipantName('  Lina   Haddad '), 'lina haddad');
assert.strictEqual(canReuseParticipant({ name: 'Lina Haddad' }, ' lina  haddad '), true);
assert.strictEqual(canReuseParticipant({ name: 'Lina' }, 'Omar'), false);
assert.strictEqual(canReuseParticipant(null, 'Lina'), false);

const sharedLocalStorage = new MemoryStorage();
const firstTab = createParticipantStore(new MemoryStorage(), sharedLocalStorage);
const secondTab = createParticipantStore(new MemoryStorage(), sharedLocalStorage);

firstTab.setActive('MASH42', 'participant-a', 'Lina', 'token-a');
firstTab.rememberRecovery('MASH42', 'participant-a', 'Lina', 'token-a');

assert.deepStrictEqual(firstTab.getActive('MASH42'), {
  id: 'participant-a',
  accessToken: 'token-a',
  sessionCode: 'MASH42',
  name: 'Lina'
});
assert.strictEqual(secondTab.getActive('MASH42'), null);
assert.deepStrictEqual(secondTab.getRecoveries('MASH42').map(entry => entry.name), ['Lina']);

secondTab.setActive('MASH42', 'participant-b', 'Omar', 'token-b');
secondTab.rememberRecovery('MASH42', 'participant-b', 'Omar', 'token-b');

assert.strictEqual(firstTab.getActive('MASH42').id, 'participant-a');
assert.strictEqual(secondTab.getActive('MASH42').id, 'participant-b');
assert.deepStrictEqual(
  firstTab.getRecoveries('MASH42').map(entry => entry.id),
  ['participant-b', 'participant-a']
);

firstTab.removeRecovery('MASH42', 'participant-a');
assert.deepStrictEqual(
  secondTab.getRecoveries('MASH42').map(entry => entry.id),
  ['participant-b']
);

console.log('Participant identity isolation passed');
