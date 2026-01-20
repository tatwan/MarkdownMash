/**
 * Simulates multiple participants for testing
 * Usage: node test-simulation.js <session-code> [count]
 * Example: node test-simulation.js ABC123 5
 */

const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const SESSION_CODE = process.argv[2];
const PARTICIPANT_COUNT = parseInt(process.argv[3]) || 3;

const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];

if (!SESSION_CODE) {
  console.log('\nUsage: node test-simulation.js <session-code> [count]');
  console.log('Example: node test-simulation.js ABC123 5\n');
  console.log('Steps:');
  console.log('  1. Start server: npm start');
  console.log('  2. Login to admin dashboard and create a session');
  console.log('  3. Copy the 6-character session code');
  console.log('  4. Run: node test-simulation.js <session-code> [count]\n');
  process.exit(1);
}

async function createParticipant(name, sessionCode) {
  // Join via REST API
  const res = await fetch(`${SERVER_URL}/api/session/${sessionCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });

  const data = await res.json();
  if (!data.success) {
    console.error(`Failed to join as ${name}:`, data.error);
    return null;
  }

  const participantId = data.participantId;
  console.log(`✓ ${name} joined session ${sessionCode} (ID: ${participantId})`);

  // Connect via WebSocket
  const socket = io(SERVER_URL);

  socket.on('connect', () => {
    socket.emit('participant_join', { participantId, sessionCode });
  });

  socket.on('session_invalid', (data) => {
    console.log(`  ${name}: Session invalid - ${data.message}`);
    socket.disconnect();
  });

  socket.on('session_ended', (data) => {
    console.log(`  ${name}: Session ended - ${data.message}`);
    socket.disconnect();
  });

  socket.on('question_started', (data) => {
    console.log(`  ${name} received question: \"${data.question.text.substring(0, 40)}...\"`);

    // Simulate thinking time (1-3 seconds), then answer CORRECTLY for test quiz
    const thinkTime = 1000 + Math.random() * 2000;
    setTimeout(() => {
      // For the Module 2 test quiz: Q1=B(1), Q2=C(2), Q3=B(1)
      let answerIndex;
      if (data.questionNumber === 1) answerIndex = 1;
      else if (data.questionNumber === 2) answerIndex = 2;
      else if (data.questionNumber === 3) answerIndex = 1;
      else answerIndex = Math.floor(Math.random() * data.question.options.length);

      socket.emit('submit_answer', {
        participantId,
        sessionCode,
        questionId: data.question.id,
        answerIndex
      });
      console.log(`  ${name} answered: ${String.fromCharCode(65 + answerIndex)}`);
    }, thinkTime);
  });

  socket.on('question_ended', (data) => {
    const myResults = data.participantResults ? data.participantResults[participantId] : null;
    if (myResults) {
      const wasCorrect = myResults.yourAnswer !== undefined && data.correctIndices.includes(myResults.yourAnswer);
      console.log(`  ${name}: ${wasCorrect ? '✓ Correct!' : '✗ Wrong'} (Score: ${myResults.currentScore})`);
    }
  });

  socket.on('quiz_ended', (data) => {
    console.log(`  ${name}: Quiz ended - Final score: ${data.finalScore}/${data.totalScore} (${data.percentage}%)`);
    socket.disconnect();
  });

  return { name, socket, participantId };
}

async function main() {
  console.log(`\nSimulating ${PARTICIPANT_COUNT} participants for session ${SESSION_CODE}...\n`);

  const participants = [];

  for (let i = 0; i < PARTICIPANT_COUNT; i++) {
    const name = names[i] || `Student${i + 1}`;
    const p = await createParticipant(name, sessionCode);
    if (p) participants.push(p);
    // Small delay between joins
    await new Promise(r => setTimeout(r, 200));
  }

  if (participants.length === 0) {
    console.log('\nNo participants could join. Check if the session code is correct and the server is running.\n');
    process.exit(1);
  }

  console.log(`\n${participants.length} participants ready. Start the quiz from admin dashboard.\n`);
  console.log('Press Ctrl+C to exit.\n');
}

main().catch(console.error);
