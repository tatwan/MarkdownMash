# Markdown Mash

A lightweight, real-time quiz application for classrooms and events. Host interactive quizzes with live results, scoring, and pass/fail feedback - no accounts required for participants.

## Features

- **Real-time synchronization** - Questions, timers, and results sync instantly via WebSockets
- **Markdown-based quizzes** - Write questions in simple Markdown format
- **Scoring system** - Set total points, track progress, and show pass/fail results
- **Speed-based ranking** - Ties are broken by response time (faster players rank higher)
- **Live response charts** - Players and presenters see answer distribution after each question
- **Analytics dashboard** - Track question difficulty, participant performance, and export data as CSV
- **Presenter mode** - Beautiful full-screen view optimized for projection/screen sharing
- **Premium design** - Gradient backgrounds, circular timers, and smooth animations
- **Mobile-optimized** - Smart mobile UI hides redundant info when watching shared screen
- **Multi-session support** - Run multiple concurrent quiz sessions with unique codes
- **PostgreSQL persistence** - Session history and analytics survive server restarts
- **Zero setup for participants** - Students just enter their name and play
- **Self-hosted** - Deploy on Render with Supabase (free tiers available)



## Screen Shots

#### Presenter Screen

If needed to have a presenter view, there is one that you can share in class or remote setting 

![image-20260122143937116](images/image-20260122143937116.png)

![image-20260118134003432](images/image-20260118134003432.png)

![image-20260118134013515](images/image-20260118134013515.png)

#### Player Screen

Each player will have their own view 

![image-20260118134036398](images/image-20260118134036398.png)

![image-20260118134041703](images/image-20260118134041703.png)

![image-20260118134054989](images/image-20260118134054989.png)

A final score will be presented for each user 

![image-20260118134102050](images/image-20260118134102050.png)

![image-20260118134105576](images/image-20260118134105576.png)

#### Admin Screen 

Loading Questions using a Markdown Template 

![image-20260118133922012](images/image-20260118133922012.png)

View progress, control flow (start, end early ..etc), and finally when done you can view summary 

![image-20260118133941230](images/image-20260118133941230.png)

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
DATABASE_URL=postgresql://user:password@host:port/database
ADMIN_PASSWORD=your_secure_password
```

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
- **Participant Join:** `http://localhost:3000/play.html`
- **Presenter View:** `http://localhost:3000/present.html`

Default admin password: `admin123` (change via `.env`)

## Quiz Format

Create quizzes in Markdown format:

```markdown
# My Quiz Title
# Score 100

## Q1: What is the capital of France?
- [ ] London
- [x] Paris
- [ ] Berlin
- [ ] Madrid
::time=20

## Q2: Which language runs in web browsers?
- [ ] Java
- [ ] Python
- [x] JavaScript
- [ ] C++
::time=15

## Q3: Is the Earth flat?
- [ ] True
- [x] False
::time=10
```

### Format Rules

| Element | Syntax | Description |
|---------|--------|-------------|
| Quiz title | `# Title` | Single `#` at the start |
| Total score | `# Score 100` | Points distributed across questions (default: 100) |
| Question | `## Q1: Text` | The `Q1:` prefix is optional |
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
   - Click "Show Final Results" after the last question
   - Displays ranked leaderboard in admin view
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
| `ADMIN_PASSWORD` | No | `admin123` | Admin login password |
| `PORT` | No | `3000` | Server port (Render sets this automatically) |

## Development

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
- No image/media support in questions (text only)
- Active session state is in-memory (historical data persists in database)

## License

MIT
