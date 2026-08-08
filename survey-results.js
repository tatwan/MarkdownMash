// Pure survey summaries: anonymous counts in, presentation-ready results out.

function normalizeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function summarizeSurveyQuestion(question, participantCount = 0, index = 0) {
  const options = Array.isArray(question?.options) ? question.options : [];
  const counts = options.map((_, optionIndex) => normalizeCount(question?.counts?.[optionIndex]));
  const responseCount = counts.reduce((sum, count) => sum + count, 0);
  const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
  const topOptionIndices = maxCount > 0
    ? counts.reduce((indices, count, optionIndex) => {
        if (count === maxCount) indices.push(optionIndex);
        return indices;
      }, [])
    : [];

  return {
    index,
    displayNumber: question?.displayNumber ?? index + 1,
    text: String(question?.text || ''),
    options,
    counts,
    responseCount,
    responseRate: participantCount > 0
      ? Math.round((responseCount * 100) / participantCount)
      : 0,
    topOptionIndices,
    topOptions: topOptionIndices.map(optionIndex => options[optionIndex]),
    optionDistribution: counts.map((count, optionIndex) => ({
      optionIndex,
      count,
      percent: responseCount > 0 ? Math.round((count * 100) / responseCount) : 0
    }))
  };
}

function buildSurveySummary(questions, participantCount = 0) {
  const safeParticipantCount = normalizeCount(participantCount);
  const summarizedQuestions = (Array.isArray(questions) ? questions : [])
    .map((question, index) => summarizeSurveyQuestion(question, safeParticipantCount, index));
  const responseCount = summarizedQuestions
    .reduce((sum, question) => sum + question.responseCount, 0);
  const possibleResponses = safeParticipantCount * summarizedQuestions.length;

  return {
    participantCount: safeParticipantCount,
    questionCount: summarizedQuestions.length,
    responseCount,
    responseRate: possibleResponses > 0
      ? Math.round((responseCount * 100) / possibleResponses)
      : 0,
    questions: summarizedQuestions
  };
}

module.exports = {
  summarizeSurveyQuestion,
  buildSurveySummary
};
