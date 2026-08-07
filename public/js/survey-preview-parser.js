// Browser survey preview parser — keep aligned with survey-structure.js
// Dual export: browser global + CommonJS for drift-style tests if needed.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.parseSurveyMarkdownLocal = api.parseSurveyMarkdown;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_TIME_LIMIT = 20;

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

  function parseSurveyMarkdown(markdown) {
    const lines = String(markdown === undefined || markdown === null ? '' : markdown).split('\n');
    const survey = {
      title: '',
      totalScore: 0,
      passingPercent: 0,
      sessionKind: 'survey',
      questions: [],
      steps: []
    };

    let currentQuestion = null;
    let pendingSection = null;
    let currentSectionTitle = null;

    function flushQuestion() {
      if (!currentQuestion) return;
      currentQuestion.text = currentQuestion.text.trim();
      currentQuestion.index = survey.questions.length;
      survey.questions.push(currentQuestion);
      survey.steps.push({ kind: 'question', questionIndex: currentQuestion.index });
      currentQuestion = null;
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^#\s*Score\s+\d+$/i.test(trimmed)) continue;

      const sectionMatch = trimmed.match(/^#\s*Section:\s*(.+)$/i);
      if (sectionMatch) {
        flushQuestion();
        pendingSection = { kind: 'section', title: sectionMatch[1].trim(), subtitle: null };
        currentSectionTitle = pendingSection.title;
        continue;
      }

      if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
        survey.title = trimmed.slice(2).trim();
        continue;
      }

      if (trimmed.startsWith('## ')) {
        flushQuestion();
        if (pendingSection) {
          survey.steps.push(pendingSection);
          pendingSection = null;
        }
        const questionText = trimmed.slice(3).replace(/^Q\d+:\s*/, '').trim();
        currentQuestion = {
          id: survey.questions.length + 1,
          index: null,
          text: questionText,
          options: [],
          correctIndices: [],
          timeLimit: DEFAULT_TIME_LIMIT,
          type: 'survey',
          gradedNumber: null,
          displayNumber: null,
          sectionTitle: currentSectionTitle
        };
        continue;
      }

      const checkboxOption = trimmed.match(/^-\s*\[[ xX]\]\s*(.+)$/);
      if (checkboxOption && currentQuestion) {
        currentQuestion.options.push(checkboxOption[1].trim());
        continue;
      }

      const plainOption = trimmed.match(/^-\s+(.+)$/);
      if (plainOption && currentQuestion) {
        currentQuestion.options.push(plainOption[1].trim());
        continue;
      }

      const timeMatch = trimmed.match(/^::time=(\d+)$/);
      if (timeMatch && currentQuestion) {
        currentQuestion.timeLimit = parseInt(timeMatch[1], 10);
        continue;
      }

      if (/^::type=/i.test(trimmed)) continue;

      if (pendingSection && !currentQuestion && trimmed.startsWith('> ')) {
        pendingSection.subtitle = trimmed.slice(2).trim();
        continue;
      }

      if (currentQuestion) {
        currentQuestion.text += '\n' + line;
      }
    }

    flushQuestion();
    assignDisplayNumbers(survey);
    return survey;
  }

  return { parseSurveyMarkdown };
}));
