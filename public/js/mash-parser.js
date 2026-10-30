// One pure parser for server sessions and browser previews. Reference panels
// never enter steps[] or questions[], and fenced source is always literal.
(function attachMashParser(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MarkdownMashParser = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createMashParser() {
  const DEFAULT_TIME_LIMIT = 20;
  const DEFAULT_TOTAL_SCORE = 100;
  const DEFAULT_PASSING_PERCENT = 70;

  function normalizeType(value) {
    return String(value ?? '').trim().toLowerCase() === 'ungraded' ? 'ungraded' : 'graded';
  }

  function invalid(message) {
    const error = new Error(message);
    error.code = 'MARKDOWN_STRUCTURE_INVALID';
    throw error;
  }

  function parseMarkdown(markdown, survey = false) {
    const quiz = {
      title: '',
      totalScore: survey ? 0 : DEFAULT_TOTAL_SCORE,
      passingPercent: survey ? 0 : DEFAULT_PASSING_PERCENT,
      ...(survey ? { sessionKind: 'survey' } : {}),
      questions: [],
      steps: []
    };
    const cases = new Map();
    const references = new Map();
    let currentQuestion = null;
    let pendingSection = null;
    let currentSectionTitle = null;
    let sectionDefaultType = null;
    let currentCase = null;
    let currentPanel = null;
    let fence = null;

    function appendLiteral(line) {
      if (currentPanel) currentPanel.text += '\n' + line;
      else if (currentQuestion) currentQuestion.text += '\n' + line;
    }

    function flushQuestion() {
      if (!currentQuestion) return;
      currentQuestion.text = currentQuestion.text.trim();
      currentQuestion.index = quiz.questions.length;
      quiz.questions.push(currentQuestion);
      quiz.steps.push({ kind: 'question', questionIndex: currentQuestion.index });
      currentQuestion = null;
    }

    function flushPanel() {
      if (!currentPanel) return;
      currentPanel.text = currentPanel.text.trim();
      if (!currentPanel.text) invalid(`Case "${currentCase.id}" has an empty panel.`);
      currentCase.panels.push(currentPanel);
      currentPanel = null;
    }

    const lines = String(markdown ?? '').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (fence) {
        appendLiteral(line);
        const closing = line.match(/^ {0,3}(`+|~+)[ \t]*$/);
        if (closing && closing[1][0] === fence.character && closing[1].length >= fence.length) fence = null;
        continue;
      }
      const opening = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (opening && !(opening[1][0] === '`' && opening[2].includes('`'))) {
        if (currentCase && !currentPanel) invalid(`Start a :::panel inside case "${currentCase.id}" before adding content.`);
        fence = { character: opening[1][0], length: opening[1].length };
        appendLiteral(line);
        continue;
      }

      const caseStart = trimmed.match(/^:::case\s+([a-z][a-z0-9-]*)\s*\|\s*(.+)$/);
      if (caseStart) {
        if (currentCase) invalid('Close the current case with :::endcase before starting another.');
        flushQuestion();
        if (cases.has(caseStart[1])) invalid(`Duplicate case id "${caseStart[1]}".`);
        currentCase = { id: caseStart[1], title: caseStart[2].trim(), panels: [] };
        continue;
      }
      const panelStart = trimmed.match(/^:::panel\s+(.+)$/);
      if (panelStart) {
        if (!currentCase) invalid(':::panel must be inside a :::case block.');
        flushPanel();
        currentPanel = { title: panelStart[1].trim(), text: '' };
        continue;
      }
      if (trimmed === ':::endcase') {
        if (!currentCase) invalid(':::endcase has no matching :::case.');
        flushPanel();
        if (!currentCase.panels.length) invalid(`Case "${currentCase.id}" needs at least one panel.`);
        cases.set(currentCase.id, currentCase);
        currentCase = null;
        continue;
      }
      if (/^:::(case|panel|endcase)\b/.test(trimmed)) invalid('Check the :::case, :::panel, or :::endcase syntax.');
      if (currentCase) {
        if (!currentPanel && trimmed) invalid(`Start a :::panel inside case "${currentCase.id}" before adding content.`);
        appendLiteral(line);
        continue;
      }

      const scoreMatch = trimmed.match(/^#\s*Score\s+(\d+)$/i);
      if (scoreMatch) {
        if (!survey) quiz.totalScore = parseInt(scoreMatch[1], 10);
        continue;
      }
      const sectionMatch = trimmed.match(/^#\s*Section:\s*(.+)$/i);
      if (sectionMatch) {
        flushQuestion();
        pendingSection = { kind: 'section', title: sectionMatch[1].trim(), subtitle: null };
        currentSectionTitle = pendingSection.title;
        sectionDefaultType = null;
        continue;
      }
      if (trimmed.startsWith('# ')) {
        quiz.title = trimmed.slice(2).trim();
        continue;
      }
      if (trimmed.startsWith('## ')) {
        flushQuestion();
        if (pendingSection) {
          quiz.steps.push(pendingSection);
          pendingSection = null;
        }
        currentQuestion = {
          id: quiz.questions.length + 1,
          index: null,
          text: trimmed.slice(3).replace(/^Q\d+:\s*/, '').trim(),
          options: [],
          correctIndices: [],
          timeLimit: DEFAULT_TIME_LIMIT,
          type: survey ? 'survey' : normalizeType(sectionDefaultType),
          gradedNumber: null,
          ...(survey ? { displayNumber: null } : {}),
          sectionTitle: currentSectionTitle
        };
        continue;
      }
      const caseLink = trimmed.match(/^::case=([a-z][a-z0-9-]*)$/);
      if (caseLink) {
        if (!currentQuestion) invalid('Place ::case=id under a question heading.');
        if (references.has(currentQuestion)) invalid('A question can reference only one case.');
        references.set(currentQuestion, caseLink[1]);
        continue;
      }
      if (trimmed.startsWith('::case=')) invalid('Case ids must start with a lowercase letter and use lowercase letters, digits, or hyphens.');
      const checkbox = trimmed.match(/^-\s*\[([ xX])\]\s*(.+)$/);
      const plain = survey && trimmed.match(/^-\s+(.+)$/);
      if (currentQuestion && (checkbox || plain)) {
        const index = currentQuestion.options.length;
        currentQuestion.options.push((checkbox ? checkbox[2] : plain[1]).trim());
        if (!survey && checkbox[1].toLowerCase() === 'x') currentQuestion.correctIndices.push(index);
        continue;
      }
      const timeMatch = trimmed.match(/^::time=(\d+)$/);
      if (timeMatch && currentQuestion) {
        currentQuestion.timeLimit = parseInt(timeMatch[1], 10);
        continue;
      }
      const typeMatch = trimmed.match(/^::type=([A-Za-z]+)$/);
      if (survey && /^::type=/i.test(trimmed)) continue;
      if (typeMatch) {
        if (currentQuestion) currentQuestion.type = normalizeType(typeMatch[1]);
        else if (pendingSection) sectionDefaultType = normalizeType(typeMatch[1]);
        continue;
      }
      if (pendingSection && !currentQuestion && trimmed.startsWith('> ')) {
        pendingSection.subtitle = trimmed.slice(2).trim();
        continue;
      }
      appendLiteral(line);
    }

    if (currentCase) invalid(`Close case "${currentCase.id}" with :::endcase (outside any code fence).`);
    flushQuestion();
    let gradedNumber = 0;
    for (const question of quiz.questions) {
      if (survey) question.displayNumber = question.index + 1;
      else if (question.type === 'graded') question.gradedNumber = ++gradedNumber;
      const caseId = references.get(question);
      if (caseId) {
        if (!cases.has(caseId)) invalid(`Unknown case "${caseId}". Define it with :::case ${caseId} | Title.`);
        question.caseStudyId = caseId;
      }
    }
    if (cases.size) quiz.caseStudies = Array.from(cases.values());
    return quiz;
  }

  function caseStudyForQuestion(quiz, question) {
    return quiz?.caseStudies?.find(reference => reference.id === question?.caseStudyId) || null;
  }

  return {
    caseStudyForQuestion,
    DEFAULT_TIME_LIMIT,
    DEFAULT_TOTAL_SCORE,
    DEFAULT_PASSING_PERCENT,
    parseQuizMarkdown: markdown => parseMarkdown(markdown),
    parseSurveyMarkdown: markdown => parseMarkdown(markdown, true)
  };
}));
