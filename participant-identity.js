function normalizeParticipantName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function canReuseParticipant(existingParticipant, submittedName) {
  if (!existingParticipant) return false;

  const existingName = normalizeParticipantName(existingParticipant.name);
  const incomingName = normalizeParticipantName(submittedName);
  return Boolean(existingName && incomingName && existingName === incomingName);
}

module.exports = {
  canReuseParticipant,
  normalizeParticipantName
};
