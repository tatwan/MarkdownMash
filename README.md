# Markdown Mash

![Markdown Mash Time](images/Markdown%20Mash%20Time.png)

![Version](https://img.shields.io/github/v/release/tatwan/MarkdownMash?include_prereleases&style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-18+-success?logo=nodedotjs&style=flat-square)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Ready-336791?logo=postgresql&style=flat-square)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--time-black?logo=socketdotio&style=flat-square)
![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)

A lightweight, real-time quiz application for classrooms and events. Host interactive quizzes with live results, scoring, and pass/fail feedback - no accounts required for participants.

## What's New in v1.2.3

### The Projector-Ready Presenter Update

Version 1.2.3 brings the presenter lobby into the same polished visual system as the instructor and participant experiences, while ensuring the complete room invitation remains visible on common classroom projectors.

#### Key Highlights

- **Modern Presenter Lobby** - A new two-column composition gives the quiz title, session code, participant status, and joining instructions a clear projector-friendly hierarchy.
- **Always-Visible QR Code** - The QR card and join destination now remain fully visible without scrolling at a standard 1280×720 classroom resolution.
- **Live Room Energy** - Participant arrivals update the lobby counter in real time with a subtle celebration animation and singular/plural labels.
- **Consistent Product Identity** - The presenter now uses the same SVG brand lockup, icon system, color language, cards, and status treatments as the rest of Markdown Mash.
- **Clear Secure Access** - Opening the presenter without a signed room link now explains how to launch it securely from the instructor studio instead of showing an unusable code form.
- **Responsive and Accessible** - Compact-height, tablet, and mobile layouts are included, together with reduced-motion behavior for lobby animations.

This release does not change the PostgreSQL schema or existing classroom data.

## Features

- **Real-time Synchronization** - Questions, timers, and results sync instantly via WebSockets.
- **Markdown-based Quizzes** - Write and upload questions in a simple, portable Markdown format.
- **Comprehensive Scoring & Leaderboards** - Captures both correctness and speed. Automatically ranks winners, utilizing response times as tie-breakers.
- **Live Momentum Highlights** - Celebrates correct responders, fastest answers, winning streaks, and participants moving up the ranking after each question.
- **Animated Classroom Finale** - Reveals third, second, and first place on a projector-ready podium, followed by fourth/fifth place and the hardest questions.
- **Post-Quiz Analytics & Dashboard** - Dive deep into session data, review question difficulty (automatically identifying the hardest questions), and analyze participant performance.
- **Readable Response Boards** - Full answer text, response counts, and percentages remain visible without clipped chart labels.
- **Presenter Mode** - A dedicated, projector-safe display with a modern room lobby, live questions, momentum highlights, results, and an animated finale.
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

#### Presenter Screen

If needed to have a presenter view, there is one that you can share in class or remote setting 

![image-20260730124732857](images/image-20260730124732857.png)

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

#### Admin Screen (and Analytics)

![image-20260729231722369](images/image-20260729231722369.png)

#### Load questions 

![image-20260729231743718](images/image-20260729231743718.png)

#### Control the session and monitor progress

View progress, control flow (start, end early ..etc), and finally when done you can view summary 

![image-20260729231755155](images/image-20260729231755155.png)

#### Analytics detail 

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
GUEST_TRIAL_ENABLED=true
```

**Admin Password Setup:** The `ADMIN_PASSWORD` in your `.env` file acts as a one-time bootstrap password. During your first login to the Admin Dashboard, the system will use this variable to permanently create your Master Admin account in the PostgreSQL database. **Note:** Changing the `.env` variable after your first login will not change your password.

Generate the two secrets independently:

```bash
openssl rand -hex 32
```

Guest trials are enabled when `GUEST_TRIAL_ENABLED` is `true`. By default they last 20 minutes, allow up to eight participants, live only in server memory, and disappear on expiration or server restart. Set the value to `false` to remove the public **Try It Out** entry point.

**Get your DATABASE_URL from Supabase:**
1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Open the project and select **Connect**
4. For a persistent Render web service, copy the **Session pooler** connection string (port 5432). This is compatible with IPv4 networks.
5. Replace `[YOUR-PASSWORD]` with your actual database password

> **💡 Alternative PostgreSQL Providers:**
> - **Neon**: [neon.tech](https://neon.tech) - Serverless Postgres with generous free tier
> - **Railway**: [railway.app](https://railway.app) - Simple deployment with built-in Postgres
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

For local development only, the application falls back to `admin123` if `ADMIN_PASSWORD` is omitted. Always set a strong value in a deployed environment.

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
   - Select **Open presenter** from the instructor studio
   - Share this window with participants for a beautiful full-screen display
   - Participants can still use their own devices to answer
   - Presenter links contain a temporary signed capability; do not replace the link with a manually typed room code

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
3. Select **Connect** in the project dashboard
4. Copy the **Session pooler** connection string (port 5432) for a persistent Render web service
5. Note your database password

Supabase plan limits change over time, so review the current [Supabase pricing](https://supabase.com/pricing) before deploying.

> Markdown Mash connects directly to PostgreSQL. It does not require a Supabase anon key, service-role key, or Supabase Auth. Keep the application tables out of the public Data API unless you intentionally configure API access and Row Level Security.

For the smallest public attack surface, disable the Supabase Data API for this project. If the project shares its Data API with another application, place Markdown Mash tables in an unexposed schema or revoke `anon` and `authenticated` privileges and enable appropriate RLS. Supabase treats table grants and RLS as separate layers; configure both for every intentionally exposed object. See [Securing your Supabase API](https://supabase.com/docs/guides/api/securing-your-api).

#### Option 2: Neon (Serverless Postgres)

1. Create account at [neon.tech](https://neon.tech)
2. Create new project
3. Copy the connection string from dashboard

Review the current [Neon pricing](https://neon.com/pricing) for plan limits.

#### Option 3: Railway (Integrated Platform)

1. Create account at [railway.app](https://railway.app)
2. Create new Postgres database
3. Copy the connection URL

Review the current [Railway pricing](https://railway.com/pricing) for plan limits.

#### Option 4: Self-Hosted PostgreSQL

Any PostgreSQL 12+ instance will work. You'll need:
- Host, port, database name
- Username and password
- Format: `postgresql://username:password@host:port/database`

---

### Deploy to Render

**Prerequisites:**
- GitHub account with this repository forked/cloned
- PostgreSQL database from one of the options above

#### Option A: Existing GitHub Web Service

Use this method if, like the hosted Markdown Mash instance, you redeploy directly from a connected GitHub repository.

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
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Plan**: Free (or upgrade for better performance)

5. **Add Environment Variables**
   
   Click **Advanced** → **Add Environment Variable**:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | Your PostgreSQL connection string |
   | `ADMIN_PASSWORD` | A strong initial instructor password of at least 12 characters |
   | `JWT_SECRET` | A random value of at least 32 characters |
   | `GUEST_TRIAL_JWT_SECRET` | A different random value of at least 32 characters |
   | `GUEST_TRIAL_ENABLED` | `true` to show **Try It Out**, otherwise `false` |
   | `NODE_ENV` | `production` |

   Generate each secret separately with `openssl rand -hex 32`.
   
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
   
6. **Deploy**
   - Click **Create Web Service**
   - Wait for build to complete (~2-3 minutes)

7. **Verify Deployment**
   
   Check the deployment logs for:
```
Connected to PostgreSQL database
Database tables initialized
Markdown Mash server running on http://localhost:<port>
```

   Visit your app at the provided URL (e.g., `https://yourapp.onrender.com`)

#### Option B: Render Blueprint

The included `render.yaml` can create a new Blueprint-managed web service with generated admin/JWT secrets and conservative guest-trial limits. In Render, choose **New** → **Blueprint**, connect the repository, and provide `DATABASE_URL` when prompted.

`render.yaml` does not automatically update environment variables on a separately created GitHub Web Service; use Option A for that setup.

### Post-Deployment Checklist

1. Open `/admin.html` and confirm instructor sign-in works.
2. Select **Try It Out**, preview the sample quiz, and launch the temporary room.
3. Open the join page in another browser or private window and answer at least one question.
4. Open the presenter view and confirm live updates, results, and the finale work.
5. Confirm the trial does not appear in instructor history or analytics.
6. Run one signed-in session, redeploy the service, and confirm its history remains available from PostgreSQL.
7. Confirm `/present.html?session=ROOMCODE` cannot join without using **Open presenter** from the instructor studio.
8. Inspect the browser response headers and confirm `Content-Security-Policy` and `Strict-Transport-Security` are present.

---

### Alternative Deployment Options

#### Railway.app (All-in-One)

Railway can host both your app and database:

1. Connect GitHub repository
2. Add PostgreSQL service
3. Add the environment variables listed below
4. Deploy; Railway automatically provides the PostgreSQL connection URL

#### Heroku

1. Install Heroku Postgres add-on
2. Set the environment variables listed below
3. Deploy from GitHub

#### Self-Hosted / VPS

```bash
# Clone repository
git clone https://github.com/yourusername/MarkdownMash
cd MarkdownMash

# Install dependencies
npm install

# Create and edit the environment file
cp .env.example .env
# Add your database URL, admin password, and two independent random secrets.

# Run with PM2 (process manager)
npm install -g pm2
pm2 start server.js --name markdownmash
pm2 save
```

---

### Deployment Notes

**Render Free Tier:**
- Spins down after 15 minutes of inactivity
- A service can take about a minute to wake after it spins down
- Its local filesystem is ephemeral; persistent classroom data belongs in PostgreSQL
- Perfect for classroom use, demos, and low-traffic deployments

**Database Persistence:**
- All quiz sessions, participants, and analytics are stored in PostgreSQL
- Data survives server restarts and redeployments
- You can view/export data through your database provider's dashboard

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection string; use Supabase Session pooler for Render |
| `ADMIN_PASSWORD` | **Required for first setup** | `admin123` in development | Bootstrap instructor password; initial production setup requires at least 12 characters |
| `JWT_SECRET` | **Yes in production** | Development fallback | Signs instructor and presenter sessions; production requires at least 32 characters |
| `GUEST_TRIAL_JWT_SECRET` | **Yes in production** | Derived in development | Separately signs guest-trial access; production requires a different value of at least 32 characters |
| `GUEST_TRIAL_ENABLED` | No | `true` | Enables or disables public **Try It Out** |
| `GUEST_TRIAL_TTL_MINUTES` | No | `20` | Trial lifetime in minutes |
| `GUEST_TRIAL_MAX_PARTICIPANTS` | No | `8` | Participant limit per trial |
| `GUEST_TRIAL_MAX_CONCURRENT` | No | `25` | Maximum active trials per app instance |
| `GUEST_TRIAL_STARTS_PER_IP_HOUR` | No | `5` | Trial starts allowed per IP each hour |
| `HOSTED_MODE` | No | `false` | Enables hosted-service room guardrails; leave disabled for unrestricted self-hosting |
| `HOSTED_MAX_PARTICIPANTS` | No | `50` | Participant limit for persistent rooms when `HOSTED_MODE=true` |
| `HOSTED_INVITE_TTL_HOURS` | No | `72` | Lifetime of a master-created one-time instructor setup link; capped at 168 hours |
| `STRIPE_BILLING_ENABLED` | No | `false` | Enables annual hosted billing and subscription entitlements after all Stripe values are configured |
| `STRIPE_SECRET_KEY` | When billing is enabled | - | Stripe secret or restricted server key; store only in encrypted deployment settings |
| `STRIPE_WEBHOOK_SECRET` | When billing is enabled | - | Signing secret for this deployment's `/api/stripe/webhook` endpoint |
| `STRIPE_PRICE_ID` | When billing is enabled | - | Recurring yearly $15 USD Price for the Markdown Mash Hosted Product |
| `APP_BASE_URL` | For hosted invitations or billing | Request origin | Public application origin used for invitation links and Stripe return URLs; use HTTPS in production |
| `NODE_ENV` | **Yes in production** | - | Set to `production` on Render or another public host |
| `PORT` | No | `3000` | Server port (Render sets this automatically) |

The included Render blueprint enables hosted mode with a 50-participant limit and one open room at a time per instructor. Hosted instructors sign in with a verified, normalized email address; account lifecycle changes are checked on every authenticated API request and Socket.IO connection. Public account creation remains disabled: the deployment master provisions each beta instructor from **Settings → Instructors**.

The database-backed `master` account keeps the deployment-password login and is exempt from both hosted room guardrails. Self-hosted operators can leave `HOSTED_MODE=false` to retain the single-admin deployment login and unrestricted persistent rooms.

An open room is a database session with `created` or `active` status. Ending, recovering, or deleting that room releases the hosted slot. Room creation uses a transaction-scoped PostgreSQL advisory lock, so simultaneous launch requests cannot bypass the limit even if the service later runs in more than one process.

### Hosted Instructor Invitations

In hosted mode, sign in as the deployment master, open **Settings → Instructors**, enter the instructor's name and email, and create a setup link. Copy and share that link directly with the intended instructor. The raw one-time token is returned only in the URL fragment and is never stored in the database; PostgreSQL stores its SHA-256 digest. Activating the link sets the instructor's password, verifies the invited email, and consumes every outstanding link for that account atomically. Creating a replacement link invalidates the earlier one.

Email delivery is intentionally manual during the invite-only beta. Set `APP_BASE_URL` to the canonical public HTTPS origin so generated links do not depend on the request host. The master account can list invitation and billing states but remains exempt from the 50-participant and one-open-room guardrails.

### Stripe Hosted Billing

Markdown Mash uses Stripe-hosted Checkout and the Stripe Customer Portal; card details never pass through the application. Billing is deliberately off by default. To enable the $15/year plan:

1. In a Stripe sandbox, create a **Markdown Mash Hosted** Product and one recurring **$15 USD yearly** Price.
2. Configure and test the Customer Portal with payment-method updates, invoices, and cancellation at period end. Keep plan switching and quantity changes disabled.
3. Add an HTTPS webhook destination at `https://YOUR_HOST/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, and `invoice.payment_action_required`.
4. Apply the ordered SQL migrations, then add the five Stripe environment values above to Render's encrypted settings. Use sandbox values first and set `STRIPE_BILLING_ENABLED=true` last.

Webhook signatures are verified against the untouched request body. Processed event IDs are stored for idempotency, and subscriptions are accepted only when both `app=markdown_mash` metadata and the configured Price ID match. This prevents other Ensemble Methods products in the same Stripe account from changing Markdown Mash access.

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
├── security-utils.js      # Opaque tokens and safe CSV helpers
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
        ├── markdown.js    # Sanitized Markdown renderer
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

The Markdown Mash source code is licensed under the [Apache License 2.0](LICENSE).
Sidekick artwork is licensed separately under [CC BY 4.0](assets/sidekicks/LICENSE).
The Markdown Mash name, logo, lightning-bolt brand mark, and product identity are
covered by the [trademark policy](TRADEMARKS.md).
