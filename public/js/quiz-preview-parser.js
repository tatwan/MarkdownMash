// Local markdown parser for the admin studio's inline preview / mobile
// simulator. Mirrors quiz-structure.js's parseQuizMarkdown closely enough to
// preview sections and ungraded questions client-side, without a server
// round trip.
//
// This is a second, hand-maintained copy of the server's parsing rules
// (quiz-structure.js). Nothing enforces that the two stay identical except
// test-preview-parser-drift.js, which runs the same markdown through both
// and asserts they agree on every field they share. If you change either
// parser's directive handling, run that test — silent drift here means a
// host previews a quiz that looks right and the class sees something
// different. The intended long-term fix is a single shared module; this
// duplication is a deliberate, accepted-for-now shortcut, not an oversight.
//
// Deliberate differences from quiz-structure.js's output (not bugs, not
// covered by the drift test):
// - No `totalScore` / `passingPercent` — the preview never scores anything.
// - No `index` field on questions — `steps[].questionIndex` already encodes
//   position, and nothing in the preview reads `question.index` directly.

// Mirrors quiz-structure.js's DEFAULT_TIME_LIMIT so a question preview shows
// the same countdown a participant would see when no ::time= is set.
const PREVIEW_DEFAULT_TIME_LIMIT = 20;

function parseQuizMarkdownLocal(markdown) {
  const lines = markdown.split('\n');
  const quiz = { title: '', questions: [], steps: [] };
  let currentQuestion = null;
  let pendingSection = null;
  let sectionDefaultType = null;
  // Mirrors quiz-structure.js: once a section heading is seen, every
  // question from then on (even ones under a later, different section)
  // carries the most recently seen section title until another section
  // heading replaces it. There is no reset back to null.
  let currentSectionTitle = null;

  function flushQuestion() {
    if (!currentQuestion) return;
    // Mirrors quiz-structure.js: trim at flush time, not while accumulating,
    // so interior blank lines in a multi-line question survive untouched.
    currentQuestion.text = currentQuestion.text.trim();
    quiz.questions.push(currentQuestion);
    quiz.steps.push({ kind: 'question', questionIndex: quiz.questions.length - 1 });
    currentQuestion = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Section (# Section: Name). Checked before the title rule below, or a
    // section would silently overwrite quiz.title.
    const sectionMatch = trimmed.match(/^#\s*Section:\s*(.+)$/i);
    if (sectionMatch) {
      flushQuestion();
      pendingSection = { kind: 'section', title: sectionMatch[1].trim(), subtitle: null };
      currentSectionTitle = pendingSection.title;
      sectionDefaultType = null;
      continue;
    }

    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ') && !trimmed.toLowerCase().startsWith('# score')) {
      quiz.title = trimmed.slice(2).trim();
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushQuestion();
      // A section only enters the flow once a question follows it.
      if (pendingSection) {
        quiz.steps.push(pendingSection);
        pendingSection = null;
      }
      const questionText = trimmed.slice(3).replace(/^Q\d+:\s*/, '').trim();
      currentQuestion = {
        id: quiz.questions.length + 1,
        text: questionText,
        options: [],
        correctIndices: [],
        timeLimit: PREVIEW_DEFAULT_TIME_LIMIT,
        type: sectionDefaultType === 'ungraded' ? 'ungraded' : 'graded',
        gradedNumber: null,
        sectionTitle: currentSectionTitle
      };
      continue;
    }

    const optionMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.+)$/);
    if (optionMatch && currentQuestion) {
      const isCorrect = optionMatch[1].toLowerCase() === 'x';
      const optionText = optionMatch[2].trim();
      const optionIndex = currentQuestion.options.length;
      currentQuestion.options.push(optionText);
      if (isCorrect) {
        currentQuestion.correctIndices.push(optionIndex);
      }
      continue;
    }

    const timeMatch = trimmed.match(/^::time=(\d+)$/);
    if (timeMatch && currentQuestion) {
      currentQuestion.timeLimit = parseInt(timeMatch[1], 10);
      continue;
    }

    // Type metadata (::type=graded|ungraded). Binds to the open question
    // when there is one, otherwise becomes the pending section's default.
    const typeMatch = trimmed.match(/^::type=([A-Za-z]+)$/);
    if (typeMatch) {
      const normalized = typeMatch[1].trim().toLowerCase() === 'ungraded' ? 'ungraded' : 'graded';
      if (currentQuestion) {
        currentQuestion.type = normalized;
      } else if (pendingSection) {
        sectionDefaultType = normalized;
      }
      continue;
    }

    // Section subtitle (> line beneath a # Section: heading, before the
    // first question).
    if (pendingSection && !currentQuestion && trimmed.startsWith('> ')) {
      pendingSection.subtitle = trimmed.slice(2).trim();
      continue;
    }

    // If it doesn't match any directive, append it to the current question's text
    // We use the original 'line' to preserve indentation
    if (currentQuestion) {
      currentQuestion.text += '\n' + line;
    }
  }

  flushQuestion();

  // gradedNumber is what renders "Question 3 of 10" and must count scored
  // questions only, mirroring quiz-structure.js's assignGradedNumbers so the
  // preview's counter matches what the live studio will show.
  let gradedCounter = 0;
  for (const question of quiz.questions) {
    if (question.type === 'graded') {
      gradedCounter += 1;
      question.gradedNumber = gradedCounter;
    } else {
      question.gradedNumber = null;
    }
  }

  return quiz;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseQuizMarkdownLocal };
} else {
  window.parseQuizMarkdownLocal = parseQuizMarkdownLocal;
}
