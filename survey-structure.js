// Pure survey structure: markdown text in, a validated survey object out.
// Surveys are a separate session type (v1.5.0). No correctness, no score.

const { stepAt, questionForStep } = require('./quiz-structure');
const { parseSurveyMarkdown } = require('./public/js/mash-parser');

function assignDisplayNumbers(survey) {
  let counter = 0;
  for (const question of survey.questions) {
    counter += 1;
    question.displayNumber = counter;
    question.gradedNumber = null;
    question.type = 'survey';
    question.correctIndices = [];
  }
}

function normalizeStoredSurvey(data) {
  if (!data || !Array.isArray(data.questions)) {
    return {
      title: '',
      totalScore: 0,
      passingPercent: 0,
      sessionKind: 'survey',
      questions: [],
      steps: []
    };
  }

  const survey = {
    ...data,
    sessionKind: 'survey',
    totalScore: 0,
    passingPercent: 0,
    questions: data.questions.map((question, index) => ({
      ...question,
      index,
      type: 'survey',
      correctIndices: [],
      gradedNumber: null,
      sectionTitle: question.sectionTitle === undefined ? null : question.sectionTitle
    }))
  };

  survey.steps = Array.isArray(data.steps) && data.steps.length > 0
    ? data.steps
    : survey.questions.map(question => ({ kind: 'question', questionIndex: question.index }));

  assignDisplayNumbers(survey);
  return survey;
}

function questionCount(survey) {
  if (!survey || !Array.isArray(survey.questions)) return 0;
  return survey.questions.length;
}

function isSurveyPayload(data) {
  return Boolean(
    data
    && (data.sessionKind === 'survey'
      || (Array.isArray(data.questions)
        && data.questions.length > 0
        && data.questions.every(q => q && q.type === 'survey')))
  );
}

module.exports = {
  parseSurveyMarkdown,
  normalizeStoredSurvey,
  questionCount,
  isSurveyPayload,
  stepAt,
  questionForStep
};
