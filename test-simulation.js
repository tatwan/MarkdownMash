/**
 * Simulates multiple participants for testing
 * Usage: node test-simulation.js [count]
 * Example: node test-simulation.js 3
 */

const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const PARTICIPANT_COUNT = parseInt(process.argv[2]) || 3;

const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];

async function createParticipant(name) {
  // Join via REST API
  const res = await fetch(`${SERVER_URL}/api/join`, {
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
  console.log(`✓ ${name} joined (ID: ${participantId})`);

  // Connect via WebSocket
  const socket = io(SERVER_URL);

  socket.on('connect', () => {
    socket.emit('participant_join', participantId);
  });

  socket.on('question_started', (data) => {
    console.log(`  ${name} received question: "${data.question.text.substring(0, 40)}..."`);

    // Simulate thinking time (1-3 seconds), then answer randomly
    const thinkTime = 1000 + Math.random() * 2000;
    setTimeout(() => {
      const answerIndex = Math.floor(Math.random() * data.question.options.length);
      socket.emit('submit_answer', {
        participantId,
        questionId: data.question.id,
        answerIndex
      });
      console.log(`  ${name} answered: ${String.fromCharCode(65 + answerIndex)}`);
    }, thinkTime);
  });

  socket.on('question_ended', (data) => {
    const wasCorrect = data.yourAnswer !== undefined && data.correctIndices.includes(data.yourAnswer);
    console.log(`  ${name}: ${wasCorrect ? '✓ Correct!' : '✗ Wrong'}`);
  });

  socket.on('quiz_ended', () => {
    console.log(`  ${name}: Quiz ended`);
    socket.disconnect();
  });

  return { name, socket, participantId };
}

async function main() {
  console.log(`\nSimulating ${PARTICIPANT_COUNT} participants...\n`);
  console.log('Make sure to:');
  console.log('  1. Start server: npm start');
  console.log('  2. Load a quiz in admin dashboard');
  console.log('  3. Then run this script\n');

  const participants = [];

  for (let i = 0; i < PARTICIPANT_COUNT; i++) {
    const name = names[i] || `Student${i + 1}`;
    const p = await createParticipant(name);
    if (p) participants.push(p);
  }

  console.log(`\n${participants.length} participants ready. Start the quiz from admin dashboard.\n`);
  console.log('Press Ctrl+C to exit.\n');
}

main().catch(console.error);
