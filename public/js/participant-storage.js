(function attachParticipantStorage(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.MarkdownMashParticipantStorage = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createApi() {
  const ACTIVE_ID_KEY = 'markdownMashActiveParticipantId';
  const ACTIVE_SESSION_KEY = 'markdownMashActiveSession';
  const ACTIVE_NAME_KEY = 'markdownMashActiveName';
  const ACTIVE_TOKEN_KEY = 'markdownMashActiveParticipantToken';
  const RECOVERY_KEY = 'markdownMashParticipantRecoveriesV2';
  const LEGACY_ID_KEY = 'markdownMashId';
  const LEGACY_SESSION_KEY = 'markdownMashSession';

  function read(storage, key) {
    try {
      return storage?.getItem(key) || null;
    } catch (err) {
      return null;
    }
  }

  function write(storage, key, value) {
    try {
      storage?.setItem(key, value);
    } catch (err) {
      // Storage can be unavailable in hardened/private browsing contexts.
    }
  }

  function remove(storage, key) {
    try {
      storage?.removeItem(key);
    } catch (err) {
      // Storage can be unavailable in hardened/private browsing contexts.
    }
  }

  function parseRecoveries(localStore) {
    try {
      const parsed = JSON.parse(read(localStore, RECOVERY_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function createParticipantStore(sessionStore, localStore) {
    function getActive(sessionCode) {
      const id = read(sessionStore, ACTIVE_ID_KEY);
      const storedSession = read(sessionStore, ACTIVE_SESSION_KEY);
      const name = read(sessionStore, ACTIVE_NAME_KEY);
      const accessToken = read(sessionStore, ACTIVE_TOKEN_KEY);

      if (!id || !accessToken || !storedSession || storedSession !== sessionCode) return null;
      return {
        id,
        accessToken,
        sessionCode: storedSession,
        name: name || ''
      };
    }

    function setActive(sessionCode, participantId, name, accessToken) {
      write(sessionStore, ACTIVE_ID_KEY, participantId);
      write(sessionStore, ACTIVE_SESSION_KEY, sessionCode);
      write(sessionStore, ACTIVE_NAME_KEY, name);
      write(sessionStore, ACTIVE_TOKEN_KEY, accessToken);
    }

    function clearActive(sessionCode = null) {
      if (sessionCode) {
        const storedSession = read(sessionStore, ACTIVE_SESSION_KEY);
        if (storedSession && storedSession !== sessionCode) return;
      }
      remove(sessionStore, ACTIVE_ID_KEY);
      remove(sessionStore, ACTIVE_SESSION_KEY);
      remove(sessionStore, ACTIVE_NAME_KEY);
      remove(sessionStore, ACTIVE_TOKEN_KEY);
    }

    function getRecoveries(sessionCode) {
      const recoveries = parseRecoveries(localStore);
      const entries = Array.isArray(recoveries[sessionCode]) ? recoveries[sessionCode] : [];
      return entries
        .filter(entry => entry && entry.id && entry.name && entry.accessToken)
        .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    }

    function rememberRecovery(sessionCode, participantId, name, accessToken) {
      const recoveries = parseRecoveries(localStore);
      const current = Array.isArray(recoveries[sessionCode]) ? recoveries[sessionCode] : [];
      const entry = {
        id: participantId,
        accessToken,
        name: String(name || '').trim(),
        updatedAt: Date.now()
      };

      recoveries[sessionCode] = [
        entry,
        ...current.filter(item => item?.id !== participantId)
      ].slice(0, 10);
      write(localStore, RECOVERY_KEY, JSON.stringify(recoveries));
    }

    function removeRecovery(sessionCode, participantId) {
      const recoveries = parseRecoveries(localStore);
      if (!Array.isArray(recoveries[sessionCode])) return;

      recoveries[sessionCode] = recoveries[sessionCode]
        .filter(entry => entry?.id !== participantId);
      if (recoveries[sessionCode].length === 0) {
        delete recoveries[sessionCode];
      }
      write(localStore, RECOVERY_KEY, JSON.stringify(recoveries));
    }

    function clearSessionRecoveries(sessionCode) {
      const recoveries = parseRecoveries(localStore);
      if (!recoveries[sessionCode]) return;
      delete recoveries[sessionCode];
      write(localStore, RECOVERY_KEY, JSON.stringify(recoveries));
    }

    function getLegacyIdentity(sessionCode) {
      const id = read(localStore, LEGACY_ID_KEY);
      const storedSession = read(localStore, LEGACY_SESSION_KEY);
      return id && storedSession === sessionCode ? { id, sessionCode: storedSession } : null;
    }

    function clearLegacyIdentity() {
      remove(localStore, LEGACY_ID_KEY);
      remove(localStore, LEGACY_SESSION_KEY);
    }

    return {
      clearActive,
      clearLegacyIdentity,
      clearSessionRecoveries,
      getActive,
      getLegacyIdentity,
      getRecoveries,
      rememberRecovery,
      removeRecovery,
      setActive
    };
  }

  return {
    createParticipantStore
  };
}));
