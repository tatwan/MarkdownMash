const assert = require('node:assert/strict');
const {
  buildFinaleSummary,
  buildHardestQuestions,
  buildQuestionPresentation,
  rankParticipants,
  selectLeadTransition
} = require('./presentation');

function makeSession() {
  return {
    quiz: {
      title: 'Presentation Test',
      totalScore: 100,
      questions: [
        { id: 1, text: 'Question one', options: ['A', 'B', 'C'], correctIndices: [0] },
        { id: 2, text: 'Question two', options: ['A', 'B', 'C'], correctIndices: [1] },
        { id: 3, text: 'Question three', options: ['A', 'B', 'C'], correctIndices: [2] }
      ]
    },
    rankSnapshot: { a: 3, b: 1, c: 2, d: 4, e: 5 },
    participants: {
      a: {
        id: 'a',
        name: 'Amina',
        avatarId: 'shades',
        correctCount: 3,
        currentStreak: 3,
        bestStreak: 3,
        answers: { 1: 0, 2: 1, 3: 2 },
        responseTimes: { 1: 1600, 2: 1800, 3: 1400 }
      },
      b: {
        id: 'b',
        name: 'Basil',
        avatarId: 'boo',
        correctCount: 2,
        currentStreak: 0,
        bestStreak: 2,
        answers: { 1: 0, 2: 0, 3: 2 },
        responseTimes: { 1: 1200, 2: 1300, 3: 1500 }
      },
      c: {
        id: 'c',
        name: 'Carla',
        correctCount: 2,
        currentStreak: 2,
        bestStreak: 2,
        answers: { 1: 1, 2: 1, 3: 2 },
        responseTimes: { 1: 900, 2: 2200, 3: 2100 }
      },
      d: {
        id: 'd',
        name: 'Dani',
        correctCount: 1,
        currentStreak: 1,
        bestStreak: 1,
        answers: { 1: 2, 2: 1 },
        responseTimes: { 1: 1100, 2: 1000 }
      },
      e: {
        id: 'e',
        name: 'Elias',
        correctCount: 0,
        currentStreak: 0,
        bestStreak: 0,
        answers: {},
        responseTimes: {}
      }
    }
  };
}

function run() {
  const session = makeSession();
  const ranked = rankParticipants(session);

  assert.deepEqual(
    ranked.map(entry => entry.name),
    ['Amina', 'Basil', 'Carla', 'Dani', 'Elias'],
    'ranking should prioritize correctness, then average response time'
  );
  assert.equal(ranked[0].movement, 2, 'rank movement should compare with the prior snapshot');
  assert.equal(ranked[0].score, 100, 'points should follow the quiz total score');
  assert.equal(ranked[0].avatarId, 'shades', 'ranking payloads should retain Sidekicks');

  const questionPresentation = buildQuestionPresentation(session, session.quiz.questions[2]);
  assert.deepEqual(
    questionPresentation.correctParticipants.map(entry => entry.name),
    ['Amina', 'Basil', 'Carla'],
    'correct responders should be ordered by response time'
  );
  assert.equal(questionPresentation.correctParticipants[0].avatarId, 'shades');
  assert.ok(
    questionPresentation.highlights.some(highlight => highlight.type === 'streak'),
    'a multi-answer streak should produce a streak highlight'
  );
  assert.ok(
    questionPresentation.highlights.some(highlight => highlight.type === 'speed'),
    'a correct response should produce a fastest-answer highlight'
  );
  const leadChange = questionPresentation.highlights.find(highlight => highlight.type === 'lead-change');
  assert.equal(leadChange.incoming.name, 'Amina');
  assert.equal(leadChange.incoming.avatarId, 'shades');
  assert.equal(leadChange.outgoing.name, 'Basil');
  assert.equal(leadChange.outgoing.avatarId, 'boo');
  assert.ok(['swoop', 'high-five', 'spring-swap', 'rocket-pass'].includes(leadChange.transition));
  assert.equal(selectLeadTransition(3), selectLeadTransition(3), 'lead transition selection should be deterministic');

  const initialSession = makeSession();
  initialSession.rankSnapshot = {};
  const initialPresentation = buildQuestionPresentation(initialSession, initialSession.quiz.questions[0]);
  assert.equal(
    initialPresentation.highlights.some(highlight => highlight.type === 'lead-change'),
    false,
    'the first ranking should establish a leader without announcing a takeover'
  );

  const hardest = buildHardestQuestions(session);
  assert.equal(hardest[0].index, 0, 'the lowest participant-wide correct rate should rank hardest');
  assert.equal(hardest[0].correctPercent, 40, 'skipped answers should count in the difficulty denominator');
  assert.equal(hardest[0].commonWrongAnswer, 'B', 'the most common wrong option should be retained');

  const finale = buildFinaleSummary(session);
  assert.equal(finale.leaderboard.length, 5);
  assert.equal(finale.leaderboard[0].name, 'Amina');
  assert.equal(finale.hardestQuestions.length, 3);

  console.log('Presentation calculations passed');
}

run();
