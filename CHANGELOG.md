# Changelog

All notable changes to Markdown Mash are documented here.

## [1.6.0] - 2026-08-08

### Added

- A collection-first survey flow: participants receive a neutral response acknowledgement between questions, while distributions stay hidden until the survey is complete.
- A dedicated presenter finale with overall response rate, most-popular choice (including ties), full option distributions, and previous/next navigation across every survey question.
- Survey-aware host results and analytics summaries with session-type badges, quiz/survey filtering, response totals, and response rates.
- Pure, dependency-free modules for anonymous survey summaries and Base64 Markdown transport, plus survey preview-drift and client-contract regression coverage.

### Changed

- Survey participant and presenter screens no longer reuse quiz result, score, difficulty, ranking, or podium UI.
- Platform average score now uses quiz sessions only; surveys report participation signals separately.
- Section curtains use a layered stage treatment and animate open into the next question, with reduced-motion support.
- Logout, cancellation, session ending, recovery, kicking, template replacement, and deletion use one accessible styled dialog with focus trapping, Escape handling, and action-specific copy.
- Quiz Markdown is Base64-encoded in the host request to avoid false-positive hosting WAF rules on technical content such as shell commands, while the server retains backward compatibility for older clients.

### Fixed

- Survey question close no longer reaches quiz-only `correctIndices` handling in the host studio.
- Survey finales and analytics no longer render empty quiz scores, participant rankings, or blank reports.
- Trial rooms can be cancelled before starting, and cancellation errors no longer reset the host UI as if the request succeeded.
- Participant refresh and presenter/admin reconnect restore the correct survey pause or finale state.

### Notes

- No database migration is required for v1.6.0.
- Guest trial remains quiz-only in the product; custom survey trial payloads are accepted only when the local runtime-verification flag is enabled.

## [1.5.0] - 2026-08-08

### Added

- **Survey sessions** as a separate session type from quizzes. Host Home includes **Host a survey** with its own studio and Markdown format (plain `- Option` lists; checkbox marks ignored).
- Session-level anonymity: answers are held in memory until the question ends, then written as a shuffled batch with `participant_id` and `is_correct` null. Live `answer_received` events carry counts only — never names or ids.
- Survey results and analytics show **option distributions**, not scores, difficulty, or leaderboards. CSV export is aggregated (no participant column).
- Survey starter templates: food, movies, and sports under `templates/survey-*.md`, loaded by the studio like quiz starters.
- Example Mashes gallery in `templates/` (from the post-v1.4.0 gallery work): quiz starters plus the classroom-modules showcase, served at `/templates` so GitHub and the product stay in sync.
- `survey-structure.js` pure parser and `sessions.session_type` column (`quiz` | `survey`, default `quiz`).

### Notes

- Guest trial remains quiz-only.
- Sections and Autopilot work in survey sessions the same way as in quizzes.
- Migration: `20260808120000_add_session_type.sql` (also applied via startup self-host migrations when the column is missing).

## [1.4.0] - 2026-08-07

### Added

- **Sections** via `# Section: Name`, with an optional `>` subtitle. Each section is announced by a curtain screen on the participant device, the presenter, and the host studio before its questions begin.
- **Ungraded questions** via `::type=ungraded` (or as a section default under a section heading). Correctness is still captured and celebrated, but these questions award no points and never touch streaks.
- Section hold under Autopilot: a fixed five-second curtain, then automatic advance into the section's first question.
- Host studio preview for section cards and ungraded badges, plus starter-template examples of the new syntax.
- `quiz-structure.js`, a pure parser module that returns parallel `questions[]` and `steps[]` views, with a dedicated suite and a browser-preview drift guard.

### Changed

- The live flow walks a `steps[]` array that interleaves sections and questions. `answers.question_index` remains the dense index into `questions[]` for analytics compatibility.
- Total score is divided among **graded** questions only. Visible "Question X of N" counters, scores, and pass/fail use graded counts.
- Analytics and CSV export keep ungraded rows in the raw data while excluding them from scored totals, streak math, and the hardest-questions recap. CSV includes a `Question Type` column.
- New sessions store `total_questions` as the graded count so average-score denominators match what the room saw.
- Reconnect and resume restore a mid-curtain section with the true remaining Autopilot hold time.

### Security

- Every admin, including the deployment master, is scoped to their own sessions for history, analytics, and export. Live-room emergency control by the master is retained on purpose.
- Migration `20260807143000_backfill_legacy_session_owner.sql` assigns pre-multi-admin sessions (`owner_id IS NULL`) to the master account.

### Notes

- Legacy quizzes without sections or `::type=` parse and run as before.
- An all-ungraded quiz completes with a score of 0 and no pass/fail verdict.
- The host studio preview parser remains a browser-side copy of the server parser for this release; a drift test keeps them aligned.

## [1.3.1] - 2026-08-06

### Added

- **Autopilot**, an optional hands-free flow for the whole quiz. Once the host starts the quiz, the first question appears on its own, each question closes two seconds after the last participant answers, and the next question follows after a pause the host chooses (3-30 seconds, default 8).
- "Everyone's in!" and "Next question in 5…" cues on both the participant device and the presenter screen, so a question ending before its timer reads as intentional rather than as a glitch.
- An Autopilot toggle and pause control in the host studio, with a live countdown on the Next question button.
- Autopilot state and the true remaining countdown are restored when a host reloads or reconnects mid-pause.
- `autopilot.js`, a dependency-free decision module, with a dedicated regression suite.

### Changed

- Manual control stays available at all times while Autopilot is engaged; End question and Next question pre-empt any pending timer, and switching Autopilot off cancels it.
- Advancing to the next question is now handled by a shared routine used by both the host action and the Autopilot timer.

### Notes

- Autopilot is off by default, and quizzes run exactly as before when it is never enabled.
- If a participant leaves without answering, questions run their full clock instead of closing early. Automatic advancing continues, so the quiz still completes unattended.

## [1.3.0] - 2026-08-03

### Added

- Optional hosted-account identity with verified email sign-in.
- Self-service registration and transactional verification email through Resend.
- Stripe Checkout, annual subscriptions, webhook synchronization, Customer Portal access, and promotion-code support.
- Master-created invitations and permanent or date-limited complimentary access.
- Hosted guardrails for 50 participants and one open room per account, with an unrestricted deployment master.
- Twenty Sidekick avatars with participant assignment, one-time shuffle, live-room integration, and finale podium artwork.
- Friendly lead-change animations: swoop, high-five, spring swap, and rocket pass.
- A signed-in Host Home with direct access to the studio, analytics, and account settings.
- Six editable starter templates covering math, Python, data science, Marvel, music, and history.
- Public Terms of Service, Privacy Policy, Refund Policy, and support links.
- Dedicated regression coverage for hosted identity, billing, email, Sidekicks, guardrails, legal pages, and cross-account Settings privacy.

### Changed

- Updated customer-facing language from “Instructor” to “Host” and “Course” to “Mash group” where appropriate.
- Added a friendly empty state for new-host analytics.
- Adopted Apache License 2.0 for source code and CC BY 4.0 for the Sidekick artwork.

### Security

- Hosted authorization is checked for authenticated HTTP and Socket.IO operations.
- Stripe webhook signatures are verified against the raw request body and processed idempotently.
- Switching accounts in the same browser now closes Settings, clears master-only host records, resets the selected panel, and recalculates permitted tabs.

## [1.2.3] - 2026-07-30

### Added

- Projector-ready presenter lobby with an always-visible QR code and join destination.
- Responsive presenter layouts and live participant-count celebrations.

### Changed

- Unified the presenter display with the Markdown Mash product visual system.
- Replaced the unsecured presenter code form with signed room access launched from the host studio.
