const assert = require('assert');
const { TAB_NAMES, resetForAccount } = require('./public/js/settings-state');

function classList(...initial) {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    contains: name => values.has(name),
    toggle(name, force) {
      if (force === undefined ? !values.has(name) : force) values.add(name);
      else values.delete(name);
    }
  };
}

function tab(name) {
  return {
    dataset: { tab: name },
    classList: classList(name === 'password' ? 'active' : 'hidden'),
    attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; }
  };
}

function panel(name) {
  return { classList: classList(name === 'password' ? undefined : 'hidden') };
}

const settingsTabs = TAB_NAMES.map(tab);
const settingsPanels = Object.fromEntries(TAB_NAMES.map(name => [name, panel(name)]));
const settingsModal = { classList: classList() };
const instructorList = {
  children: [{ email: 'subscriber@example.com' }],
  replaceChildren() { this.children = []; }
};
const elements = { settingsModal, settingsTabs, settingsPanels, instructorList };

resetForAccount(elements, {
  hostedAuthMode: true,
  billingEnabled: true,
  admin: { role: 'master', authSource: 'deployment' }
});

const hostTab = settingsTabs.find(item => item.dataset.tab === 'instructors');
assert.equal(hostTab.classList.contains('hidden'), false, 'master can access Hosts');

// Recreate the state that previously leaked when a master selected Hosts,
// closed Settings, logged out, and a hosted account signed in in the same tab.
settingsModal.classList.toggle('hidden', false);
settingsTabs.forEach(item => item.classList.toggle('active', item === hostTab));
Object.entries(settingsPanels).forEach(([name, item]) => item.classList.toggle('hidden', name !== 'instructors'));
instructorList.children = [{ email: 'subscriber@example.com' }];

resetForAccount(elements, {
  hostedAuthMode: true,
  billingEnabled: true,
  admin: { role: 'admin', authSource: 'hosted' }
});

const passwordTab = settingsTabs.find(item => item.dataset.tab === 'password');
const billingTab = settingsTabs.find(item => item.dataset.tab === 'billing');
assert.equal(settingsModal.classList.contains('hidden'), true, 'account switch closes Settings');
assert.deepEqual(instructorList.children, [], 'account switch purges master-loaded host data');
assert.equal(hostTab.classList.contains('hidden'), true, 'hosted accounts cannot see Hosts');
assert.equal(hostTab.classList.contains('active'), false, 'hidden Hosts tab cannot remain active');
assert.equal(billingTab.classList.contains('hidden'), false, 'hosted accounts retain Billing');
assert.equal(passwordTab.classList.contains('active'), true, 'account switch resets to Password');
assert.equal(settingsPanels.password.classList.contains('hidden'), false, 'Password is the only visible panel');
for (const name of TAB_NAMES.filter(name => name !== 'password')) {
  assert.equal(settingsPanels[name].classList.contains('hidden'), true, `${name} panel is hidden`);
}

console.log('Cross-account Settings privacy reset passed');
