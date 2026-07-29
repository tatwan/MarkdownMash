const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const TRIAL_AUDIENCE = 'markdown-mash-trial';
const TRIAL_ISSUER = 'markdown-mash';

function createTrialError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function createTrialManager(options) {
  const {
    secret,
    ttlMs = 20 * 60 * 1000,
    maxConcurrent = 25,
    startsPerIpHour = 5,
    now = () => Date.now(),
    idFactory = () => crypto.randomUUID()
  } = options || {};

  if (!secret) {
    throw new Error('A trial token secret is required');
  }

  const trials = new Map();
  const startsByIp = new Map();

  function pruneStarts(ipAddress) {
    const cutoff = now() - (60 * 60 * 1000);
    const recent = (startsByIp.get(ipAddress) || [])
      .filter(timestamp => timestamp > cutoff);

    if (recent.length > 0) {
      startsByIp.set(ipAddress, recent);
    } else {
      startsByIp.delete(ipAddress);
    }

    return recent;
  }

  function removeExpired() {
    const removed = [];
    for (const trial of trials.values()) {
      if (trial.expiresAt <= now()) {
        trials.delete(trial.id);
        removed.push(trial);
      }
    }
    return removed;
  }

  function create({ ipAddress, sessionCode }) {
    removeExpired();

    if (trials.size >= maxConcurrent) {
      throw createTrialError(
        'TRIAL_CAPACITY_REACHED',
        'All practice rooms are busy right now. Please try again shortly.'
      );
    }

    const normalizedIp = ipAddress || 'unknown';
    const recentStarts = pruneStarts(normalizedIp);
    if (recentStarts.length >= startsPerIpHour) {
      throw createTrialError(
        'TRIAL_RATE_LIMITED',
        'You have created several practice rooms recently. Please try again later.'
      );
    }

    const id = idFactory();
    const createdAt = now();
    const expiresAt = createdAt + ttlMs;
    const trial = {
      id,
      ipAddress: normalizedIp,
      sessionCode,
      createdAt,
      expiresAt,
      launched: false
    };

    trials.set(id, trial);
    startsByIp.set(normalizedIp, [...recentStarts, createdAt]);

    const token = jwt.sign(
      {
        type: 'trial',
        scope: ['trial:control'],
        sessionCode
      },
      secret,
      {
        subject: id,
        audience: TRIAL_AUDIENCE,
        issuer: TRIAL_ISSUER,
        expiresIn: Math.max(1, Math.floor(ttlMs / 1000))
      }
    );

    return {
      ...trial,
      token
    };
  }

  function authenticate(token) {
    let payload;
    try {
      payload = jwt.verify(token, secret, {
        audience: TRIAL_AUDIENCE,
        issuer: TRIAL_ISSUER
      });
    } catch (error) {
      throw createTrialError('TRIAL_TOKEN_INVALID', 'This practice room has expired.');
    }

    if (payload.type !== 'trial' || !Array.isArray(payload.scope)
      || !payload.scope.includes('trial:control')) {
      throw createTrialError('TRIAL_TOKEN_INVALID', 'This practice room is not valid.');
    }

    const trial = trials.get(payload.sub);
    if (!trial || trial.expiresAt <= now()) {
      if (trial) trials.delete(trial.id);
      throw createTrialError('TRIAL_EXPIRED', 'This practice room has expired.');
    }

    if (trial.sessionCode !== payload.sessionCode) {
      throw createTrialError('TRIAL_TOKEN_INVALID', 'This practice room is not valid.');
    }

    return {
      type: 'trial',
      id: trial.id,
      sessionCode: trial.sessionCode,
      expiresAt: trial.expiresAt
    };
  }

  function get(trialId) {
    const trial = trials.get(trialId);
    if (!trial || trial.expiresAt <= now()) return null;
    return trial;
  }

  function markLaunched(trialId) {
    const trial = get(trialId);
    if (!trial) return null;
    trial.launched = true;
    return trial;
  }

  function remove(trialId) {
    const trial = trials.get(trialId) || null;
    trials.delete(trialId);
    return trial;
  }

  return {
    authenticate,
    create,
    get,
    markLaunched,
    remove,
    removeExpired,
    size: () => trials.size
  };
}

module.exports = {
  TRIAL_AUDIENCE,
  TRIAL_ISSUER,
  createTrialManager
};
