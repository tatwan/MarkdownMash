# Changelog

All notable changes to Markdown Mash are documented here.

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
