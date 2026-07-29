# Markdown Mash

![Markdown Mash Time](images/Markdown%20Mash%20Time.png)

![Version](https://img.shields.io/github/v/release/tatwan/MarkdownMash?include_prereleases&style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-18+-success?logo=nodedotjs&style=flat-square)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Ready-336791?logo=postgresql&style=flat-square)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--time-black?logo=socketdotio&style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

A lightweight, real-time quiz application for classrooms and events. Host interactive quizzes with live results, scoring, and pass/fail feedback - no accounts required for participants.

## What's New in v1.2.1

### The Try It Out Update

Version 1.2.1 lets visitors experience the complete Markdown Mash workflow before deploying it themselves, while keeping real classroom data private and untouched.

#### Key Highlights

- **No-Account Guest Trial** - Select **Try It Out** to launch a preloaded practice Mash without credentials.
- **Complete Product Experience** - Visitors can preview, host, join, present, answer, view live momentum, and reach the animated podium and hardest-question recap.
- **Private by Design** - Trial rooms live only in server memory, expire automatically, and never appear in PostgreSQL, Supabase, instructor history, analytics, or exports.
- **Polished Question Preview** - A clearer eye-icon action opens a responsive participant-style preview with correct-answer indicators and improved navigation.
- **Open-Source Handoff** - The completed trial points visitors to GitHub so they can deploy their own persistent instance.

#### Fixes & Reliability

- Protected instructor HTTP routes and Socket.IO controls with session-aware authorization.
- Isolated participant identities by session so multiple browser contexts are counted correctly.
- Restored presenter access through a public, non-sensitive QR lookup while keeping admin endpoints protected.
- Added trial rate, duration, participant, and global-capacity limits.
- Removed participant names and answer details from routine server logs.

## Features

- **Real-time Synchronization** - Questions, timers, and results sync instantly via WebSockets.
- **Markdown-based Quizzes** - Write and upload questions in a simple, portable Markdown format.
- **Comprehensive Scoring & Leaderboards** - Captures both correctness and speed. Automatically ranks winners, utilizing response times as tie-breakers.
- **Live Momentum Highlights** - Celebrates correct responders, fastest answers, winning streaks, and participants moving up the ranking after each question.
- **Animated Classroom Finale** - Reveals third, second, and first place on a projector-ready podium, followed by fourth/fifth place and the hardest questions.
- **Post-Quiz Analytics & Dashboard** - Dive deep into session data, review question difficulty (automatically identifying the hardest questions), and analyze participant performance.
- **Readable Response Boards** - Full answer text, response counts, and percentages remain visible without clipped chart labels.
- **Presenter Mode** - A dedicated, full-screen view optimized for classroom projectors or remote screen sharing.
- **Premium, Mobile-Optimized UI** - Gradient backgrounds, circular timers, smooth animations, and a smart mobile interface for participants.
- **Multi-session Support** - Host multiple concurrent quiz sessions seamlessly with unique Kahoot-style 6-character codes.
- **Rich Markdown & Code Highlighting** - Format questions and answers with bold, italics, lists, and syntax-highlighted code blocks (`highlight.js`).
- **Inline Quiz Previews** - Test and preview your markdown formatting directly in the Admin Dashboard with a built-in mobile simulator.
- **Temporary Try It Out Mode** - A server-owned sample quiz lets visitors experience hosting, joining, live results, and the finale without an account. Trial rooms expire automatically and are never stored in PostgreSQL.
- **Course Metadata & Grouping** - Assign course tags to sessions to easily organize and filter your Analytics dashboard.
- **Test/Dry Runs** - Flag sessions as test runs to exclude them from your primary analytics, or permanently delete unwanted sessions.
- **Exportable Data** - Export full session results and analytics to CSV for external grading or record-keeping.
- **PostgreSQL Persistence** - Session histories, answers, and analytics survive server restarts. 
- **Frictionless Onboarding** - Zero setup for participants; students just enter their name and jump right in.
- **Self-hosted & Free-Tier Friendly** - Easily deployable to services like Render and Supabase for free.



## Screenshots

![image-20260729231715630](images/image-20260729231715630.png)

![image-20260729231722369](images/image-20260729231722369.png)

#### Load questions 

![image-20260729231743718](images/image-20260729231743718.png)

#### Presenter Screen

If needed to have a presenter view, there is one that you can share in class or remote setting 

![image-20260729231755155](images/image-20260729231755155.png)

![image-20260729231833097](images/image-20260729231833097.png)

![image-20260729231847314](images/image-20260729231847314.png)

#### Player Screen

![image-20260729231817132](images/image-20260729231817132.png)

Each player will have their own view 

![image-20260729231904889](images/image-20260729231904889.png)

![image-20260729231926007](images/image-20260729231926007.png)

A final score will be presented for each user 

![image-20260729231958412](images/image-20260729231958412.png)

![image-20260729232006220](images/image-20260729232006220.png)

![image-20260729232023418](images/image-20260729232023418.png)

#### Admin Screen (Analytics)

View progress, control flow (start, end early ..etc), and finally when done you can view summary 

![image-20260729232111905](images/image-20260729232111905.png)

![image-20260729232131647](images/image-20260729232131647.png)

## Tech Stack

- **Backend:** Node.js, Express, Socket.IO
- **Database:** PostgreSQL (Supabase)
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Charts:** Chart.js
- **Deployment:** Render.com + Supabase (free tiers compatible)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (we recommend [Supabase](https://supabase.com) free tier)

### Installation

```bash
git clone https://github.com/yourusername/markdown-mash.git
cd markdown-mash
npm install
```

### Configuration

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@host:port/your_db_name
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=replace-with-a-long-random-value
GUEST_TRIAL_JWT_SECRET=replace-with-a-different-long-random-value
```

**Admin Password Setup:** The `ADMIN_PASSWORD` in your `.env` file acts as a one-time bootstrap password. During your first login to the Admin Dashboard, the system will use this variable to permanently create your Master Admin account in the PostgreSQL database. **Note:** Changing the `.env` variable after your first login will not change your password.

Guest trials are enabled by default in `render.yaml`. They last 20 minutes, allow up to eight participants, live only in server memory, and disappear on expiration or server restart. Set `GUEST_TRIAL_ENABLED=false` to disable the public **Try It Out** entry point.

**Get your DATABASE_URL from Supabase:**
1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Project Settings** → **Database**
4. Copy the **"Connection pooling"** URI (uses port 6543, recommended for serverless)
5. Replace `[YOUR-PASSWORD]` with your actual database password

> **💡 Alternative PostgreSQL Providers:**
> - **Neon**: [neon.tech](https://neon.tech) - Serverless Postgres with generous free tier
> - **Railway**: [railway.app](https://railway.app) - Simple deployment with built-in Postgres
> - **ElephantSQL**: [elephantsql.com](https://elephantsql.com) - Managed PostgreSQL
> - **Self-hosted**: Any PostgreSQL 12+ instance

### Run

```bash
npm start
```

Open `http://localhost:3000` in your browser.

- **Admin Dashboard:** `http://localhost:3000/admin.html`
- **Guest Trial:** Open the Admin Dashboard and select **Try It Out**
- **Participant Join:** `http://localhost:3000/play.html`
- **Presenter View:** `http://localhost:3000/present.html`

Default admin password: `admin123` (change via `.env`)

## Quiz Format

Create quizzes in Markdown format:

````markdown
# Intro to Python
# Score 100

## Q1: What does the following code print?
```python
def greet(name):
    print(f"Hello, {name}!")

greet("Alice")
```
- [ ] Hello, name!
- [x] Hello, Alice!
- [ ] Error
::time=30

## Q2: Which of the following are **mutable** data types in Python? (Select one)
- [ ] Tuple
- [x] List
- [ ] String
- [ ] Integer
::time=15

## Q3: Is the Earth flat?
> "The Earth is a sphere." - Science
- [ ] True
- [x] False
::time=10
````

### Format Rules

| Element | Syntax | Description |
|---------|--------|-------------|
| Quiz title | `# Title` | Single `#` at the start |
| Total score | `# Score 100` | Points distributed across questions (default: 100) |
| Question | `## Q1: Text` | The `Q1:` prefix is optional. Any unmatched lines below this will be appended as multi-line text (e.g., code blocks) |
| Wrong answer | `- [ ] Option` | Unchecked checkbox |
| Correct answer | `- [x] Option` | Checked checkbox |
| Time limit | `::time=20` | Seconds per question (default: 20) |

### Scoring

- Set total points with `# Score X` (e.g., `# Score 1000`)
- Points are divided equally among questions
- Participants see their score after each question
- At the end: **Pass** (70%+) or motivating message to study more

## Hosting a Quiz

1. **Load the quiz**
   - Go to Admin Dashboard
   - Paste your Markdown quiz
   - Click "Load Quiz"

2. **Share the link**
   - Give participants the `/play.html` URL
   - They enter their name to join

3. **Screen sharing (optional)**
   - Open `/present.html` in a new window
   - Share this window with participants for a beautiful full-screen display
   - Participants can still use their own devices to answer

4. **Run the quiz**
   - Click "Start Quiz"
   - Click "Next Question" to advance
   - Use "End Question Early" if everyone answered
   - Participants and presenter view show results after each question

5. **Final results**
   - Keep the presenter view open for the animated podium and hardest-question recap
   - Click "Show Final Results" to inspect the instructor ranking table
   - Participants see their individual scores and pass/fail status

## Deployment

### Database Setup (Required)

This app requires a PostgreSQL database. Choose one of these options:

#### Option 1: Supabase (Recommended - Free Tier)

1. Create account at [supabase.com](https://supabase.com)
2. Create new project (choose region closest to your users)
3. Go to **Project Settings** → **Database** → **Connection pooling**
4. Copy the connection string (port 6543)
5. Note your database password

**Free tier includes:** 500MB database, 2GB bandwidth, unlimited API requests

#### Option 2: Neon (Serverless Postgres)

1. Create account at [neon.tech](https://neon.tech)
2. Create new project
3. Copy the connection string from dashboard

**Free tier includes:** 512MB storage, auto-suspend after inactivity

#### Option 3: Railway (Integrated Platform)

1. Create account at [railway.app](https://railway.app)
2. Create new Postgres database
3. Copy the connection URL

**Free tier includes:** $5/month credit

#### Option 4: Self-Hosted PostgreSQL

Any PostgreSQL 12+ instance will work. You'll need:
- Host, port, database name
- Username and password
- Format: `postgresql://username:password@host:port/database`

---

### Deploy to Render.com

**Prerequisites:**
- GitHub account with this repository forked/cloned
- PostgreSQL database from one of the options above

**Steps:**

1. **Push your code to GitHub** (if you haven't already)

2. **Go to Render Dashboard**
   - Visit [dashboard.render.com](https://dashboard.render.com)
   - Click **New** → **Web Service**

3. **Connect Repository**
   - Connect your GitHub account
   - Select your MarkdownMash repository

4. **Configure Service**
   - **Name**: `markdownmash` (or your choice)
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or upgrade for better performance)

   The included `render.yaml` also provisions separate generated secrets for admin and guest tokens and configures conservative guest-trial limits.

5. **Add Environment Variables**
   
   Click **Advanced** → **Add Environment Variable**:
   
   **Variable 1: DATABASE_URL**
   - Key: `DATABASE_URL`
   - Value: Your PostgreSQL connection string from database setup
   
   > ⚠️ **CRITICAL - Password Encoding**:
   > If your database password contains special characters (`!`, `@`, `#`, `$`, `%`, `&`, etc.), you MUST URL-encode them:
   > - `!` → `%21`
   > - `@` → `%40`
   > - `#` → `%23`
   > - `$` → `%24`
   > - `%` → `%25`
   > - `&` → `%26`
   > 
   > **Example:** Password `MyPass!@#` becomes `MyPass%21%40%23`
   > 
   > **Tool:** Use [urlencoder.org](https://www.urlencoder.org/) to encode your password
   
   **Variable 2: ADMIN_PASSWORD** (Optional)
   - Key: `ADMIN_PASSWORD`
   - Value: Your custom admin password (default is `admin123`)

6. **Deploy**
   - Click **Create Web Service**
   - Wait for build to complete (~2-3 minutes)

7. **Verify Deployment**
   
   Check the deployment logs for:
```
   ✅ Connected to PostgreSQL database
   ✅ Database tables initialized
   ✅ Markdown Mash server running
```

   Visit your app at the provided URL (e.g., `https://yourapp.onrender.com`)

---

### Alternative Deployment Options

#### Railway.app (All-in-One)

Railway can host both your app and database:

1. Connect GitHub repository
2. Add PostgreSQL service
3. Deploy automatically links DATABASE_URL

#### Heroku

1. Install Heroku Postgres add-on
2. Set `ADMIN_PASSWORD` config var
3. Deploy from GitHub

#### Self-Hosted / VPS

```bash
# Clone repository
git clone https://github.com/yourusername/MarkdownMash
cd MarkdownMash

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://user:password@localhost:5432/markdownmash
ADMIN_PASSWORD=your_secure_password
PORT=3000
EOF

# Run with PM2 (process manager)
npm install -g pm2
pm2 start server.js --name markdownmash
pm2 save
```

---

### Deployment Notes

**Render Free Tier:**
- Spins down after 15 minutes of inactivity
- First request after sleep takes ~30 seconds to wake up
- Perfect for classroom use, demos, and low-traffic deployments

**Database Persistence:**
- All quiz sessions, participants, and analytics are stored in PostgreSQL
- Data survives server restarts and redeployments
- You can view/export data through your database provider's dashboard

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection string (Supabase pooler) |
| `ADMIN_PASSWORD` | No | `admin123` | Admin login password (used for initial setup only) |
| `PORT` | No | `3000` | Server port (Render sets this automatically) |

## Development

### Local Database Setup
If you are running a local PostgreSQL instance (e.g., via Docker), the default database is usually named `postgres`. You can connect to it using:
\`\`\`env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/postgres
\`\`\`

*Note: The app is configured to automatically disable SSL for local development and enable it for production environments (like Render or Supabase) based on the `NODE_ENV` variable or the connection string.*

```bash
# Run with auto-reload
npm run dev

# Simulate participants for testing
npm run simulate      # 3 participants
npm run simulate 10   # 10 participants
```
## Analytics Dashboard

View detailed insights from completed quiz sessions:

- **Platform Overview**: Total sessions, participants, average scores
- **Question Difficulty**: Automatic difficulty ratings (easy/medium/hard)
- **Answer Distribution**: See which options players chose
- **Response Times**: Track how quickly participants answered
- **Performance Rankings**: Leaderboard with scores and speed
- **CSV Export**: Download session data for Excel/spreadsheet analysis

Access via Admin Dashboard → Session History → View Analytics

```
markdown-mash/
├── server.js              # Express + Socket.IO server
├── db.js                  # PostgreSQL database module
├── package.json           # Dependencies and scripts
├── .env.example           # Environment variables template
├── render.yaml            # Render.com deployment config
├── sample-quiz.md         # Example quiz
├── test-simulation.js     # Participant simulator for testing
└── public/
    ├── index.html         # Landing page
    ├── admin.html         # Host dashboard with analytics
    ├── play.html          # Participant view (mobile-optimized)
    ├── present.html       # Presenter view (for screen sharing)
    ├── css/
    │   └── style.css      # All styles
    └── js/
        ├── admin.js       # Admin client logic
        ├── play.js        # Participant client logic
        └── present.js     # Presenter client logic
```

## Database Schema

The app automatically creates these PostgreSQL tables:

- **sessions**: Quiz sessions with unique 6-character codes
- **participants**: Players who joined sessions (with scores)
- **answers**: Individual answer records (for analytics and response time tracking)

All data includes proper foreign keys and indexes for performance.

## Limitations

- No persistent user accounts (participants join per-session)
- No native image uploading (images must be hosted via external URL using standard Markdown `![alt](url)`)

## License

MIT
