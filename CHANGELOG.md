# Changelog

All notable changes to Markdown Mash are documented here.

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
