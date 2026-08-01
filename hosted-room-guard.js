const HOSTED_ROOM_LIMIT_CODE = 'HOSTED_ROOM_LIMIT';
const ADVISORY_LOCK_NAMESPACE = 'markdown_mash_hosted_room';

class HostedRoomLimitError extends Error {
  constructor(existingSession) {
    const code = existingSession?.code || 'your current room';
    super(`Room ${code} is still open. End, recover, or delete it before starting another room.`);
    this.name = 'HostedRoomLimitError';
    this.code = HOSTED_ROOM_LIMIT_CODE;
    this.existingSession = existingSession || null;
  }
}

function shouldEnforceSingleOpenRoom({ hostedMode, admin }) {
  return Boolean(hostedMode && admin && admin.role !== 'master');
}

async function assertHostedRoomAvailable(client, ownerId) {
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    throw new TypeError('A valid room owner is required for hosted concurrency enforcement.');
  }

  await client.query(
    'SELECT pg_advisory_xact_lock(hashtext($1), $2)',
    [ADVISORY_LOCK_NAMESPACE, ownerId]
  );

  const result = await client.query(
    `SELECT code, status, quiz_title
     FROM sessions
     WHERE owner_id = $1
       AND status IN ('created', 'active')
     ORDER BY created_at DESC
     LIMIT 1`,
    [ownerId]
  );

  if (result.rows[0]) {
    throw new HostedRoomLimitError({
      code: result.rows[0].code,
      status: result.rows[0].status,
      quizTitle: result.rows[0].quiz_title
    });
  }
}

module.exports = {
  ADVISORY_LOCK_NAMESPACE,
  HOSTED_ROOM_LIMIT_CODE,
  HostedRoomLimitError,
  assertHostedRoomAvailable,
  shouldEnforceSingleOpenRoom
};
