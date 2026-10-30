// Allowlist the current question and its references. Never send the quiz or
// copy arbitrary question fields into a participant/presenter payload.
const { caseStudyForQuestion } = require('./public/js/mash-parser');

function getQuestionForParticipants(question, quiz) {
  const reference = caseStudyForQuestion(quiz, question);
  return {
    id: question.id,
    text: question.text,
    options: question.options,
    timeLimit: question.timeLimit,
    type: question.type,
    gradedNumber: question.gradedNumber,
    displayNumber: question.displayNumber ?? null,
    caseStudy: reference ? {
      id: reference.id,
      title: reference.title,
      panels: reference.panels.map(panel => ({ title: panel.title, text: panel.text }))
    } : null
  };
}

module.exports = { getQuestionForParticipants };
