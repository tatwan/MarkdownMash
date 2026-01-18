const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// IN-MEMORY DATA STORE
// ============================================
const store = {
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  quiz: null,           // Current loaded quiz
  participants: {},     // { odksxn: { id, name, score, answers: {} } }
  quizState: {
    isRunning: false,
    currentQuestionIndex: -1,
    questionEndTime: null,
    showingResults: false
  }
};

// ============================================
// MARKDOWN QUIZ PARSER
// ============================================
function parseQuizMarkdown(markdown) {
  const lines = markdown.split('\n');
  const quiz = { title: '', questions: [], totalScore: 100, passingPercent: 70 };
  let currentQuestion = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Score setting (# Score 100)
    const scoreMatch = trimmed.match(/^#\s*Score\s+(\d+)$/i);
    if (scoreMatch) {
      quiz.totalScore = parseInt(scoreMatch[1], 10);
      continue;
    }

    // Quiz title (# Title) - but not # Score
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ') && !trimmed.toLowerCase().startsWith('# score')) {
      quiz.title = trimmed.slice(2).trim();
      continue;
    }

    // Question (## Q1: Question text)
    if (trimmed.startsWith('## ')) {
      if (currentQuestion) {
        quiz.questions.push(currentQuestion);
      }
      const questionText = trimmed.slice(3).replace(/^Q\d+:\s*/, '').trim();
      currentQuestion = {
        id: quiz.questions.length + 1,
        text: questionText,
        options: [],
        correctIndices: [],
        timeLimit: 20 // default
      };
      continue;
    }

    // Option (- [ ] or - [x])
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

    // Time metadata (::time=20)
    const timeMatch = trimmed.match(/^::time=(\d+)$/);
    if (timeMatch && currentQuestion) {
      currentQuestion.timeLimit = parseInt(timeMatch[1], 10);
      continue;
    }
  }

  // Push last question
  if (currentQuestion) {
    quiz.questions.push(currentQuestion);
  }

  return quiz;
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function generateId() {
  return Math.random().toString(36).substring(2, 8);
}

function getQuestionForParticipants(question) {
  // Send question without correct answers
  return {
    id: question.id,
    text: question.text,
    options: question.options,
    timeLimit: question.timeLimit
  };
}

function calculateStats(questionId) {
  const question = store.quiz.questions.find(q => q.id === questionId);
  if (!question) return null;

  const stats = question.options.map(() => 0);
  let totalAnswered = 0;

  for (const participant of Object.values(store.participants)) {
    const answer = participant.answers[questionId];
    if (answer !== undefined && answer !== null) {
      stats[answer]++;
      totalAnswered++;
    }
  }

  return {
    counts: stats,
    totalAnswered,
    totalParticipants: Object.keys(store.participants).length
  };
}

// ============================================
// REST API ENDPOINTS
// ============================================

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === store.adminPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

// Upload quiz markdown
app.post('/api/admin/quiz', (req, res) => {
  const { markdown } = req.body;
  try {
    store.quiz = parseQuizMarkdown(markdown);
    store.quizState = {
      isRunning: false,
      currentQuestionIndex: -1,
      questionEndTime: null,
      showingResults: false
    };
    store.participants = {};
    res.json({ success: true, quiz: store.quiz });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get current quiz (admin view with answers)
app.get('/api/admin/quiz', (req, res) => {
  res.json({ quiz: store.quiz, state: store.quizState });
});

// Get participants list
app.get('/api/admin/participants', (req, res) => {
  const list = Object.values(store.participants).map(p => ({
    id: p.id,
    name: p.name,
    score: p.score,
    answeredCount: Object.keys(p.answers).length
  }));
  res.json({ participants: list });
});

// Get final results
app.get('/api/admin/results', (req, res) => {
  if (!store.quiz) {
    return res.json({ results: [] });
  }

  const results = Object.values(store.participants).map(p => {
    let correctCount = 0;
    for (const question of store.quiz.questions) {
      const answer = p.answers[question.id];
      if (answer !== undefined && question.correctIndices.includes(answer)) {
        correctCount++;
      }
    }
    return {
      name: p.name,
      score: correctCount,
      total: store.quiz.questions.length
    };
  }).sort((a, b) => b.score - a.score);

  res.json({ results });
});

// Participant join
app.post('/api/join', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Name is required' });
  }
  if (!store.quiz) {
    return res.status(400).json({ success: false, error: 'No quiz is loaded' });
  }

  const id = generateId();
  store.participants[id] = {
    id,
    name: name.trim(),
    score: 0,
    answers: {}
  };

  io.to('admin').emit('participant_joined', {
    id,
    name: name.trim(),
    count: Object.keys(store.participants).length
  });

  res.json({ success: true, participantId: id, quizTitle: store.quiz.title });
});

// ============================================
// SOCKET.IO EVENTS
// ============================================
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Admin joins admin room
  socket.on('admin_join', () => {
    socket.join('admin');
    console.log('Admin joined');
  });

  // Presenter joins admin room (receives same events, no controls)
  socket.on('presenter_join', () => {
    socket.join('admin');
    console.log('Presenter joined');

    // Send current participant count
    socket.emit('participant_joined', {
      count: Object.keys(store.participants).length
    });

    // If quiz is loaded, send title
    if (store.quiz) {
      socket.emit('quiz_loaded', {
        title: store.quiz.title,
        questionCount: store.quiz.questions.length
      });
    }
  });

  // Participant joins with their ID
  socket.on('participant_join', (participantId) => {
    const participant = store.participants[participantId];
    if (participant) {
      socket.join('participants');
      socket.participantId = participantId;
      participant.socketId = socket.id; // Track socket for individual messaging
      console.log('Participant joined:', participant.name);

      // If quiz is in progress, send current state
      if (store.quizState.isRunning && store.quizState.currentQuestionIndex >= 0) {
        const question = store.quiz.questions[store.quizState.currentQuestionIndex];
        const timeRemaining = Math.max(0, Math.ceil((store.quizState.questionEndTime - Date.now()) / 1000));

        if (store.quizState.showingResults) {
          socket.emit('question_ended', {
            questionId: question.id,
            correctIndices: question.correctIndices,
            stats: calculateStats(question.id),
            yourAnswer: participant.answers[question.id]
          });
        } else if (timeRemaining > 0) {
          socket.emit('question_started', {
            question: getQuestionForParticipants(question),
            timeRemaining,
            questionNumber: store.quizState.currentQuestionIndex + 1,
            totalQuestions: store.quiz.questions.length
          });
        }
      }
    }
  });

  // Admin starts quiz
  socket.on('start_quiz', () => {
    if (!store.quiz || store.quiz.questions.length === 0) return;

    store.quizState.isRunning = true;
    store.quizState.currentQuestionIndex = -1;
    store.quizState.showingResults = false;

    // Reset all participant answers and scores
    for (const p of Object.values(store.participants)) {
      p.answers = {};
      p.score = 0;
      p.correctCount = 0;
    }

    io.to('participants').emit('quiz_started', {
      title: store.quiz.title,
      totalQuestions: store.quiz.questions.length
    });

    io.to('admin').emit('quiz_started', {
      title: store.quiz.title,
      totalQuestions: store.quiz.questions.length
    });
  });

  // Admin advances to next question
  socket.on('next_question', () => {
    if (!store.quiz || !store.quizState.isRunning) return;

    store.quizState.currentQuestionIndex++;
    store.quizState.showingResults = false;

    if (store.quizState.currentQuestionIndex >= store.quiz.questions.length) {
      // Quiz ended
      store.quizState.isRunning = false;
      const pointsPerQuestion = store.quiz.totalScore / store.quiz.questions.length;

      // Send final results to each participant
      for (const participant of Object.values(store.participants)) {
        if (participant.socketId) {
          const finalScore = Math.round((participant.correctCount || 0) * pointsPerQuestion);
          const percentage = Math.round(((participant.correctCount || 0) / store.quiz.questions.length) * 100);
          const passed = percentage >= store.quiz.passingPercent;

          io.to(participant.socketId).emit('quiz_ended', {
            finalScore,
            totalScore: store.quiz.totalScore,
            correctCount: participant.correctCount || 0,
            totalQuestions: store.quiz.questions.length,
            percentage,
            passed,
            passingPercent: store.quiz.passingPercent
          });
        }
      }

      io.to('admin').emit('quiz_ended');
      return;
    }

    const question = store.quiz.questions[store.quizState.currentQuestionIndex];
    store.quizState.questionEndTime = Date.now() + (question.timeLimit * 1000);

    io.to('participants').emit('question_started', {
      question: getQuestionForParticipants(question),
      timeRemaining: question.timeLimit,
      questionNumber: store.quizState.currentQuestionIndex + 1,
      totalQuestions: store.quiz.questions.length
    });

    io.to('admin').emit('question_started', {
      question: question,
      timeRemaining: question.timeLimit,
      questionNumber: store.quizState.currentQuestionIndex + 1,
      totalQuestions: store.quiz.questions.length
    });

    // Auto-end question when time expires
    setTimeout(() => {
      if (store.quizState.currentQuestionIndex === store.quiz.questions.indexOf(question)) {
        endCurrentQuestion();
      }
    }, question.timeLimit * 1000);
  });

  // Admin manually ends current question
  socket.on('end_question', () => {
    endCurrentQuestion();
  });

  // Participant submits answer
  socket.on('submit_answer', (data) => {
    const { participantId, questionId, answerIndex } = data;
    const participant = store.participants[participantId];

    if (!participant) return;
    if (!store.quizState.isRunning) return;
    if (store.quizState.showingResults) return;

    const question = store.quiz.questions.find(q => q.id === questionId);
    if (!question) return;

    // Check if already answered
    if (participant.answers[questionId] !== undefined) return;

    // Check if time expired
    if (Date.now() > store.quizState.questionEndTime) return;

    participant.answers[questionId] = answerIndex;

    // Notify admin of answer received
    io.to('admin').emit('answer_received', {
      participantId,
      participantName: participant.name,
      questionId,
      answeredCount: Object.values(store.participants).filter(p => p.answers[questionId] !== undefined).length,
      totalParticipants: Object.keys(store.participants).length
    });

    // Confirm to participant
    socket.emit('answer_confirmed', { questionId, answerIndex });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

function endCurrentQuestion() {
  if (!store.quiz || store.quizState.currentQuestionIndex < 0) return;
  if (store.quizState.showingResults) return;

  store.quizState.showingResults = true;
  const question = store.quiz.questions[store.quizState.currentQuestionIndex];
  const stats = calculateStats(question.id);
  const pointsPerQuestion = store.quiz.totalScore / store.quiz.questions.length;

  // Update scores
  for (const participant of Object.values(store.participants)) {
    const answer = participant.answers[question.id];
    if (answer !== undefined && question.correctIndices.includes(answer)) {
      participant.correctCount = (participant.correctCount || 0) + 1;
    }
  }

  // Build results for each participant
  const participantResults = {};
  for (const participant of Object.values(store.participants)) {
    const currentScore = Math.round((participant.correctCount || 0) * pointsPerQuestion);
    participantResults[participant.id] = {
      yourAnswer: participant.answers[question.id],
      currentScore,
      correctCount: participant.correctCount || 0
    };
  }

  // Broadcast to all participants - they'll look up their own data
  io.to('participants').emit('question_ended', {
    questionId: question.id,
    correctIndices: question.correctIndices,
    stats,
    participantResults,
    totalScore: store.quiz.totalScore,
    questionsAnswered: store.quizState.currentQuestionIndex + 1,
    totalQuestions: store.quiz.questions.length
  });

  // Send to admin
  io.to('admin').emit('question_ended', {
    questionId: question.id,
    correctIndices: question.correctIndices,
    stats
  });
}

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Markdown Mash server running on http://localhost:${PORT}`);
  console.log(`Admin password: ${store.adminPassword}`);
});
