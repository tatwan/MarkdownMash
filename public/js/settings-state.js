(function exposeSettingsState(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MarkdownMashSettings = api;
})(typeof window !== 'undefined' ? window : globalThis, function createSettingsState() {
  const TAB_NAMES = Object.freeze(['password', 'billing', 'instructors', 'security', 'email']);

  function allowedTabs({ hostedAuthMode, billingEnabled, admin }) {
    const hostedAccount = Boolean(
      hostedAuthMode
      && admin?.authSource === 'hosted'
      && admin?.role !== 'master'
    );

    if (hostedAccount) {
      return new Set(['password', ...(billingEnabled ? ['billing'] : [])]);
    }

    return new Set([
      'password',
      ...(hostedAuthMode && admin?.role === 'master' ? ['instructors'] : []),
      'security',
      'email'
    ]);
  }

  function resetForAccount(elements, context) {
    const allowed = allowedTabs(context);
    elements.settingsModal?.classList.add('hidden');

    elements.settingsTabs.forEach(tab => {
      const tabName = tab.dataset.tab;
      const permitted = allowed.has(tabName);
      const selected = tabName === 'password';
      tab.classList.toggle('hidden', !permitted);
      tab.classList.toggle('active', selected);
      tab.setAttribute?.('aria-selected', String(selected));
    });

    TAB_NAMES.forEach(tabName => {
      elements.settingsPanels[tabName]?.classList.toggle('hidden', tabName !== 'password');
    });

    elements.instructorList?.replaceChildren();
  }

  return Object.freeze({ TAB_NAMES, allowedTabs, resetForAccount });
});
