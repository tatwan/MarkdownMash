A simple, robust approach is a thin “host dashboard + real‑time quiz engine + participant UI” built on plain web tech (HTTP + WebSockets) plus a Markdown/CSV ingestion step to populate questions and participants. Below is a concrete architecture you could implement with minimal moving parts.
​

Core components
Admin/host UI:

Uploads a Markdown file containing questions, choices, and correct answers.

Uploads a CSV with participant emails.

Starts quiz, advances questions, controls timers, and views aggregated stats per question.
​

Backend service (e.g., Node.js/Express, Django, or FastAPI):

Parses Markdown into an internal quiz model.

Parses CSV into a participant list and generates login tokens or passwords.

Manages quiz state (current question, remaining time, answers received).

Exposes REST endpoints for admin actions and authentication.

Hosts a WebSocket endpoint for real‑time events (question start/end, countdown, live stats).
​

Participant UI (single‑page web client):

Simple login by email + quiz code/token.

Receives push updates for current question and timer via WebSocket.

Sends answers back to the server.

Shows correct answer and bar‑chart stats once a question closes.
​

Data store (could be very simple):

A relational DB or even an in‑memory store + periodic persistence, holding users, quizzes, questions, and answers.
​

Data formats
Markdown quiz template (inspired by existing markdown quiz generators):
​

One file per quiz:

text
# Quiz Title

## Q1: What is the capital of France?
- [ ] London
- [x] Paris
- [ ] Berlin
- [ ] Madrid
::time=20

## Q2: True or False: The Earth is flat.
- [ ] True
- [x] False
::time=10
Parsing logic:

## starts a new question.

- [ ] / - [x] lines define options, with [x] marking the correct answer(s).

Optional metadata line like ::time=20 for per‑question timers.

Participants CSV:

Minimal columns: email, name.

Backend loads this and pre‑creates user accounts or temporary login codes.

Internal quiz model:

Quiz: id, title, list of questions.

Question: id, text, list of options, correct option index(es), time limit, order.

Option: id, text.

Request/response and real‑time flow
Authentication:

Admin: simple username/password or SSO, not the main complexity.

Participants:

Pre‑registered emails; each gets a one‑time code link, or

Email + quiz code + simple password stored in DB.

Quiz lifecycle:

Admin uploads Markdown/CSV → backend parses and stores quiz + participants.
​

When ready, admin clicks “Start Quiz”:

Backend sets quiz state to running, question index to 0.

Backend broadcasts via WebSocket QUESTION_STARTED with question payload and timeRemaining.
​

Each participant’s browser:

Receives event, renders the same question and a countdown timer.

On answer, sends ANSWER_SUBMITTED via WebSocket (or REST if you prefer) with questionId and selectedOption.

Backend:

Stores each answer (userId, questionId, choice, timestamp).

Optionally prevents changes after time expires.

When timer ends:

Marks question closed.

Computes counts per option and correctness.

Broadcasts QUESTION_ENDED with:

Correct option(s).

Aggregate counts per option for bar chart.
​

Participant UI:

On QUESTION_ENDED, highlights correct answer and renders a bar chart (e.g., Chart.js) using the aggregate counts.
​

Admin can move to next question or end quiz; at the end, a summary view (per participant score, per question stats).

Transport choices:

WebSocket is enough for this scale and gives you synchronized question start/stop and live stats.
​

If you want to simplify further, you can:

Use WebSocket only from server → clients; send answers back via REST POST.

Use a simple broadcast channel keyed by quizId (e.g., /ws/quiz/:id).

Minimal tech stack
Backend:

Option A: Node.js + Express + ws or Socket.IO (very common for quiz demos).
​

Option B: Python + FastAPI + uvicorn[standard] with WebSockets for real‑time.
​

Use a small ORM with SQLite/Postgres (SQLModel, Prisma, Sequelize, etc.).

Frontend:

Plain HTML/JS or a lightweight framework (React/Vue) for:

Admin dashboard with upload forms and control buttons.

Participant page with login and quiz screen.
​

Charting: Chart.js for bar charts of responses per question.
​

Markdown and CSV parsing:

Node: marked or remark for Markdown + csv-parse for CSV.
​

Python: markdown + csv or pandas.read_csv.

Keeping it “simple” in practice
To keep scope in check, consider these constraints:

Single quiz “room” at a time per deployment (no multi‑tenant support initially).

Only multiple‑choice questions (single‑correct or multi‑correct) as defined in Markdown, no free‑text.
​

No live leaderboard; just:

Per‑question bar chart.

Optional final total score per participant.

Single host/admin controlling the quiz from a dashboard; participants cannot navigate questions independently.

This gives you a straightforward mini‑Kahoot: upload Markdown + CSV, share a URL to participants, run the quiz with synchronized questions and timers, and show aggregated per‑question charts at the end of each round.