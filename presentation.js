const { isScored, pointsPerQuestion } = require('./quiz-structure');

function getAverageResponseTime(participant) {
  const times = Object.values(participant.responseTimes || {})
    .filter(time => Number.isFinite(time) && time >= 0);

  if (times.length === 0) return Number.POSITIVE_INFINITY;
  return times.reduce((sum, time) => sum + time, 0) / times.length;
}

function rankParticipants(session) {
  const pointsPer = pointsPerQuestion(session.quiz);

  const ranked = Object.values(session.participants)
    .map(participant => ({
      id: participant.id,
      name: participant.name,
      avatarId: participant.avatarId || null,
      correctCount: participant.correctCount || 0,
      currentStreak: participant.currentStreak || 0,
      bestStreak: participant.bestStreak || 0,
      avgResponseTimeMs: getAverageResponseTime(participant)
    }))
    .sort((a, b) => {
      if (b.correctCount !== a.correctCount) {
        return b.correctCount - a.correctCount;
      }
      if (a.avgResponseTimeMs !== b.avgResponseTimeMs) {
        return a.avgResponseTimeMs - b.avgResponseTimeMs;
      }
      return a.name.localeCompare(b.name);
    });

  return ranked.map((participant, index) => {
    const rank = index + 1;
    const previousRank = session.rankSnapshot?.[participant.id] || null;

    return {
      ...participant,
      rank,
      previousRank,
      movement: previousRank ? previousRank - rank : 0,
      score: Math.round(participant.correctCount * pointsPer),
      avgResponseTimeMs: Number.isFinite(participant.avgResponseTimeMs)
        ? Math.round(participant.avgResponseTimeMs)
        : null
    };
  });
}

function createRankSnapshot(leaderboard) {
  return Object.fromEntries(leaderboard.map(entry => [entry.id, entry.rank]));
}

function selectLeadTransition(questionId) {
  const transitions = ['swoop', 'high-five', 'spring-swap', 'rocket-pass'];
  const seed = String(questionId || '')
    .split('')
    .reduce((total, character) => total + character.charCodeAt(0), 0);
  return transitions[seed % transitions.length];
}

function buildHighlights(leaderboard, correctParticipants, questionId) {
  const highlights = [];

  const currentLeader = leaderboard[0];
  const previousLeader = leaderboard.find(entry => entry.previousRank === 1);
  const leadChanged = Boolean(currentLeader
    && previousLeader
    && currentLeader.id !== previousLeader.id
    && currentLeader.previousRank
    && currentLeader.previousRank > 1);
  if (leadChanged) {
    highlights.push({
      type: 'lead-change',
      icon: 'trend-up',
      eyebrow: 'New leader',
      message: `${currentLeader.name} takes the lead from ${previousLeader.name}`,
      transition: selectLeadTransition(questionId),
      incoming: {
        name: currentLeader.name,
        avatarId: currentLeader.avatarId
      },
      outgoing: {
        name: previousLeader.name,
        avatarId: previousLeader.avatarId
      }
    });
  }

  const streakLeader = leaderboard
    .filter(entry => entry.currentStreak >= 2)
    .sort((a, b) => b.currentStreak - a.currentStreak || a.rank - b.rank)[0];

  if (streakLeader) {
    highlights.push({
      type: 'streak',
      icon: 'flame',
      eyebrow: 'Winning streak',
      message: `${streakLeader.name} has ${streakLeader.currentStreak} correct answers in a row`
    });
  }

  const biggestMover = leaderboard
    .filter(entry => entry.movement > 0 && (!leadChanged || entry.id !== currentLeader.id))
    .sort((a, b) => b.movement - a.movement || a.rank - b.rank)[0];

  if (biggestMover) {
    highlights.push({
      type: 'rising',
      icon: 'trend-up',
      eyebrow: 'Moving up',
      message: `${biggestMover.name} climbed ${biggestMover.movement} ${biggestMover.movement === 1 ? 'place' : 'places'}`
    });
  }

  const fastestCorrect = correctParticipants
    .filter(participant => Number.isFinite(participant.responseTimeMs))
    .sort((a, b) => a.responseTimeMs - b.responseTimeMs)[0];

  if (fastestCorrect) {
    highlights.push({
      type: 'speed',
      icon: 'stopwatch',
      eyebrow: 'Fastest correct answer',
      message: `${fastestCorrect.name} answered in ${(fastestCorrect.responseTimeMs / 1000).toFixed(1)} seconds`
    });
  }

  const topScore = leaderboard[0]?.correctCount;
  const tiedLeaders = leaderboard.filter(entry => entry.correctCount === topScore);
  if (leaderboard.length > 1 && tiedLeaders.length > 1) {
    highlights.push({
      type: 'tied',
      icon: 'equal',
      eyebrow: 'Close contest',
      message: `${tiedLeaders.length} participants are tied on correct answers`
    });
  }

  if (highlights.length === 0) {
    highlights.push({
      type: 'steady',
      icon: 'check-circle',
      eyebrow: 'Question complete',
      message: correctParticipants.length > 0
        ? `${correctParticipants.length} ${correctParticipants.length === 1 ? 'participant got' : 'participants got'} it right`
        : 'This one challenged the whole room'
    });
  }

  return highlights.slice(0, 3).map(highlight => ({ ...highlight, questionId }));
}

function buildQuestionPresentation(session, question) {
  const correctParticipants = Object.values(session.participants)
    .filter(participant => question.correctIndices.includes(participant.answers[question.id]))
    .map(participant => ({
      id: participant.id,
      name: participant.name,
      avatarId: participant.avatarId || null,
      responseTimeMs: participant.responseTimes?.[question.id] ?? null
    }))
    .sort((a, b) => {
      if (a.responseTimeMs == null) return 1;
      if (b.responseTimeMs == null) return -1;
      return a.responseTimeMs - b.responseTimeMs;
    });

  const leaderboard = rankParticipants(session);

  return {
    correctParticipants,
    leaderboard,
    highlights: buildHighlights(leaderboard, correctParticipants, question.id),
    rankSnapshot: createRankSnapshot(leaderboard)
  };
}

function buildHardestQuestions(session) {
  const participants = Object.values(session.participants);
  const participantCount = participants.length;

  // Hardest-question recap is about what the graded quiz revealed.
  return session.quiz.questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => isScored(question))
    .map(({ question, index }) => {
      let correctCount = 0;
      let answeredCount = 0;
      const wrongOptionCounts = new Map();

      for (const participant of participants) {
        const answer = participant.answers[question.id];
        if (answer === undefined || answer === null) continue;

        answeredCount++;
        if (question.correctIndices.includes(answer)) {
          correctCount++;
        } else {
          wrongOptionCounts.set(answer, (wrongOptionCounts.get(answer) || 0) + 1);
        }
      }

      const commonWrongEntry = [...wrongOptionCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0];
      const correctPercent = participantCount > 0
        ? Math.round((correctCount / participantCount) * 100)
        : 0;

      return {
        index,
        text: question.text,
        correctPercent,
        correctCount,
        answeredCount,
        missedCount: Math.max(0, participantCount - correctCount),
        skippedCount: Math.max(0, participantCount - answeredCount),
        commonWrongAnswer: commonWrongEntry
          ? question.options[commonWrongEntry[0]]
          : null,
        commonWrongCount: commonWrongEntry?.[1] || 0
      };
    })
    .sort((a, b) => (
      a.correctPercent - b.correctPercent
      || b.missedCount - a.missedCount
      || a.index - b.index
    ))
    .slice(0, 3);
}

function buildFinaleSummary(session) {
  return {
    quizTitle: session.quiz.title,
    totalScore: session.quiz.totalScore,
    participantCount: Object.keys(session.participants).length,
    leaderboard: rankParticipants(session),
    hardestQuestions: buildHardestQuestions(session)
  };
}

module.exports = {
  buildFinaleSummary,
  buildHardestQuestions,
  buildQuestionPresentation,
  createRankSnapshot,
  getAverageResponseTime,
  rankParticipants,
  selectLeadTransition
};
