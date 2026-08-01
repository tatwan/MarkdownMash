# Markdown Mash: what comes after v1.2.3

**Decision memo — 1 August 2026**

## Recommendation in one page

Move ahead with all three ideas, but reshape two of them:

| Idea | Decision | Product form |
|---|---|---|
| Hosted subscription | **Go, as an invite-only beta first** | One **Markdown Mash Hosted** plan at **$15/year**, billed yearly through the existing Ensemble Methods Stripe account. Keep self-hosting free and open source. |
| Student avatars | **Go** | Launch 12–16 neutral, object/creature “Sidekicks.” Assign one per participant per room, allow one pre-quiz shuffle, and require no student account. |
| Lead-change animation | **Go with a redesign** | Celebrate the handoff with playful, non-aggressive actions. Do **not** ship kicking, stomping, crushing, or humiliating animations tied to named students. |

The product promise should be:

> Markdown Mash stays free to own. Markdown Mash Hosted is the $15/year easy button.

The next named release should be **v1.3 “Sidekicks”**, followed by an invite-only **Hosted Beta**. Start provider, privacy, and account groundwork immediately, while the smaller Sidekicks release is designed and tested.

## Why this direction fits Markdown Mash

Markdown Mash wins on simplicity: Markdown in, room code out, no participant accounts. The hosted offer should remove deployment work without weakening that simplicity or turning the community edition into a teaser.

The repository is closer to a hosted product than the current UI suggests:

- `admins` already supports multiple rows and roles.
- `sessions.owner_id` and authorization helpers already isolate ordinary admins' sessions.
- active rooms are keyed by session code, and guest rooms already support a participant limit.
- the current login, recovery, copy, and bootstrap flow still assume one admin per deployment.
- live room state is held in one Node process, so horizontal scaling is not safe yet.

This is a credible foundation, not a production-ready multi-tenant service. Billing is not the hardest part; identity, tenant isolation, lifecycle handling, privacy, email delivery, recovery, observability, backups, and capacity protection are the real hosted-product work.

## Idea 1: the hosted subscription

### The plan

Offer exactly one plan:

**Markdown Mash Hosted — $15/year**

- equivalent to $1.25/month, billed once each year
- up to **50 participants in a live room** at launch
- **one live room at a time per instructor**
- unlimited quiz launches under a simple fair-use policy
- presenter mode, analytics, exports, avatars, and transitions included
- participant accounts are never required
- self-hosted Markdown Mash remains free with the same classroom features

Do not impose a monthly quiz count. It is hard for teachers to predict, adds anxiety at the moment of teaching, and does not protect the server as directly as concurrent-room and per-room participant limits do.

Treat 50 as a safe public-beta promise, not a permanent product ceiling. Before launch, load-test 60 simulated participants in each of three concurrent rooms. Raise the public limit only after measured capacity supports it.

### Keep the price quiz

The quiz card is memorable and on-brand:

> **How much does a full year of hosted Markdown Mash cost?**
>
> - A. $150/year
> - B. $50/year
> - C. $15/year ✓

Follow the answer immediately with unambiguous billing copy:

> **Correct — an entire year for $15.** That is $1.25 per month, billed annually. Cancel before renewal from your billing portal.

Randomize the answer order so the correct choice is not always the third button. Make the card a pricing reveal, not a knowledge test: every choice should remain keyboard accessible, and a wrong choice should respond playfully without blocking checkout.

### Why annual billing is the right version of “$1”

Microtransactions are dominated by fixed processing fees.

| Stripe cost assumption | $1.25 charged monthly | $15 charged yearly | What it means |
|---|---:|---:|---|
| U.S. domestic card at 2.9% + $0.30, plus Stripe Billing at 0.7% | about **$0.91 net/month** | about **$14.16 net/year** | About 8 monthly-billed subscribers or 6 annual subscribers cover $84/year of hosting, before tax, support, international-card fees, refunds, disputes, and other costs. |

Annual billing preserves the simple $15/year message, reduces failures and cancellation churn, and turns twelve fixed payment fees into one. It covers infrastructure at small scale; it does **not** price the founder's development or support time. Call it a founding price and review it for new customers after the first year.

### Payment-provider decision

Use the existing U.S. **Ensemble Methods Stripe account** that already operates AtolloScout. Create a separate Stripe Product named **Markdown Mash Hosted** and a single recurring yearly Price of **$15 USD**. A Product represents the service and its Price defines amount, currency, and billing interval, so the existing products can remain separate in the same account.

Keep application identity separate even though the Stripe account is shared. Create and store a dedicated Stripe Customer for each Markdown Mash instructor rather than looking up or reusing a Customer by email. Add `app=markdown_mash` and the internal account ID as metadata to Checkout and subscription objects. The webhook handler must validate the expected Price ID or metadata before changing access, so AtolloScout and the other products cannot affect Markdown Mash entitlements.

Use Stripe-hosted Checkout and Stripe's Customer Portal. Never collect or store card details in Markdown Mash. Configure the portal to allow payment-method changes, invoices, and cancellation at the end of the paid period; plan switching and quantities remain off because there is only one plan.

Stripe Tax is a separate decision from ordinary U.S. income-tax filing. Before enabling automatic tax, Ensemble Methods should determine with its tax professional where it is registered or required to collect sales tax. Stripe only calculates and collects tax in jurisdictions configured with registrations.

### Stripe inputs needed for implementation

Business decisions and public values:

- **$15/year USD**, no free trial, 50 participants per room, and one concurrent room per instructor. The Ensemble Methods master account is exempt from the participant limit for administration, support, and demonstrations.
- product name, short Checkout description, product image, support email, statement descriptor, and customer-facing business name
- production app URL plus success, cancel, privacy, terms, and support URLs
- cancellation policy: access continues to the end of the paid year
- tax behavior and whether Stripe Tax should be enabled, based on Ensemble Methods' registrations

Stripe objects and configuration:

- create the Product and recurring yearly Price in a Stripe sandbox first; provide the non-secret `price_...` ID
- enable and brand the Customer Portal
- enable receipts, failed-payment emails, and Smart Retries as desired
- register the production HTTPS webhook URL when the route exists
- subscribe only to the events the application handles: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, and `invoice.payment_action_required`

Secrets must be entered directly into the deployment's encrypted environment settings, never pasted into chat or committed to the repository:

```text
STRIPE_SECRET_KEY=sk_...       # preferably a least-privilege restricted key
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
APP_BASE_URL=https://...
```

The hosted Checkout approach does not require a publishable key in the browser. Keep separate sandbox and live values. Stripe requires the raw HTTP request body for webhook signature verification, webhook deliveries can arrive more than once or out of order, and access provisioning must therefore be signature-verified and idempotent.

### Where Stripe code and secrets live

AtolloScout's Supabase Edge Function pattern is valid: Supabase supports encrypted Edge Function secrets and publishes an official signed Stripe-webhook example. Markdown Mash has a different boundary, however. Its instructor authentication, authorization, room creation, and API already run in a trusted Node/Express backend on Render; Supabase is currently used as PostgreSQL rather than as the application's API and authentication layer.

For the first hosted release, keep the Stripe integration in the existing Express backend:

- Stripe secrets live in Render's encrypted environment settings.
- Express creates hosted Checkout and Customer Portal sessions.
- `POST /api/stripe/webhook` receives the raw body and verifies the Stripe signature.
- Supabase PostgreSQL stores only non-secret Stripe identifiers, subscription state, and processed event IDs.
- Browser code never receives a Stripe secret or Supabase privileged key.

This avoids duplicating account authorization between Render and Supabase or sharing an internal signing secret between two backends. Do not put Stripe secrets in an ordinary PostgreSQL table. If the application later moves instructor auth and its API to Supabase, or billing needs an independently deployed boundary, the three billing operations can move cleanly into `create-checkout`, `create-portal`, and `stripe-webhook` Edge Functions using Supabase Function Secrets.

### Open-source boundary

Monetize operations, not classroom features:

- **Community:** run it yourself, modify it, deploy anywhere, all quiz features included.
- **Hosted:** no server, database, updates, backups, or security maintenance for the instructor.

This keeps the project's goodwill intact and gives the paid product a durable advantage: convenience and trust. The code can remain open; service credentials, production configuration, support operations, and customer data do not belong in the public repository.

The repository now uses **Apache License 2.0 for the code**, **CC BY 4.0 for the Sidekick artwork**, and `TRADEMARKS.md` reserves the Markdown Mash name, logo, and brand identity. Apache 2.0 remains permissive like MIT but adds an explicit contributor patent grant and an express trademark limitation. Preserve the provenance record for each final artwork asset. This is a legal-readiness structure, not legal advice.

### Hosted account and data model

Only instructors create accounts. Students continue to join with a room code and a display name.

Minimum schema additions:

```text
accounts
  id, email, password_hash, email_verified_at, status, created_at

subscriptions
  account_id, provider, provider_customer_id, provider_subscription_id,
  status, current_period_end, cancel_at_period_end, updated_at

billing_events
  provider_event_id UNIQUE, event_type, received_at, processed_at, payload_digest

participants
  + avatar_id
```

The current `admins` table can be migrated into `accounts`, or retained and carefully generalized. Do not keep a global “master sees every teacher's data” rule for routine support. Separate operator/support capabilities from instructor roles, make exceptional access auditable, and default support to metadata rather than student results.

Required hosted behavior:

- verified email and email-based password reset; retire security questions for hosted accounts
- server-side entitlements; never trust a plan flag from the browser
- signed, idempotent, replay-safe billing webhooks
- grace period for failed renewal, then read-only history and no new rooms
- self-service cancellation and account deletion
- tenant ID on every owned record and an automated cross-tenant test suite
- formal, ordered database migrations instead of startup-time best-effort `ALTER TABLE` checks
- automatic backups and a restore drill
- logs, uptime checks, error tracking, and alerts for join/answer failures

### Student privacy baseline

The safest product design is also the simplest:

- no student email, birth date, profile, or cross-room account
- encourage nicknames or first name plus initial rather than full legal names
- do not use student data for ads, marketing profiles, or model training
- default-delete participant answers and names after **90 days**; let instructors delete sooner
- publish privacy, retention, subprocessors, security, and deletion information before public signup
- give a school/instructor a way to export and delete its data
- keep avatars local product assets, not third-party trackers or remote profile services

For U.S. K–12 use, COPPA can permit school consent only for the school-authorized educational purpose and not a separate commercial use; the operator remains responsible for its own compliance. FERPA obligations fall primarily on covered institutions, but schools will expect appropriate vendor terms, access controls, and deletion practices. Other countries and U.S. states add their own requirements, so a public K–12 launch needs jurisdiction-specific review.

## Idea 2: Sidekick avatars

### Assessment of the attached concepts

The visual direction is excellent for Markdown Mash: high-contrast silhouettes, sticker outlines, friendly expressions, and a palette that already belongs beside the lightning-bolt brand.

The two sheets are concept boards, not production assets. Shipping needs separate transparent files, consistent safe areas, verified rights/provenance, small-size tests, and a documented animation vocabulary. Do not crop the cards and call that the avatar library.

Launch with this first set of 16:

- Shades, Boo, Zap, Stella
- Byte, Nimbus, Zog, Pixel
- Rocketo, Luna, Booky, Fitzy
- Comet, Heartbeat, Popstar, Chestie

Hold the remaining four for naming or context review:

- **Dicey**: “dicey” means risky and the visual can read as gambling.
- **Shroomie**: “shrooms” can carry a drug association.
- **Prickles**: can sound like an insult when attached to a student.
- **Regal**: visually safe, but the crown overlaps with the leaderboard's winner language.

The held visuals can return with different names. Run the final set past 5–10 educators from different cultures and age groups before freezing it.

### Assignment rules

1. The server shuffles the avatar pool for each room and assigns an avatar when a new participant joins.
2. The participant sees “You’re Nimbus!” and may shuffle once before the quiz starts.
3. Rejoining with the existing participant credential restores the same avatar.
4. Duplicates are allowed after the pool is exhausted; color or accessory variants can distinguish them later.
5. The instructor has one **Sidekicks on/off** setting for the room.
6. The participant's text name always remains visible. Color or avatar shape is never the only identity cue.

Do not add user-uploaded images, generative prompts, body/skin customization, chat, or a permanent student profile in this phase. Each creates moderation, safety, privacy, or onboarding work that does not improve the live quiz.

### Asset specification

- transparent WebP plus PNG fallback
- 512 × 512 master; export 256 and 128 variants
- consistent baseline, 10% internal safe area, strong silhouette at 48 px
- no embedded text in the art
- source/provenance record for every asset
- total launch payload target under 1.5 MB after compression, with lazy loading where practical
- decorative images hidden from screen readers when the adjacent name supplies identity

## Idea 3: lead-change transitions

### The part to keep

Using the two avatars to dramatize a genuine lead change is a natural extension of the existing “Live Momentum Highlights.” It makes the leaderboard event legible before the numbers settle and gives the Sidekicks a reason to exist beyond decoration.

### The part to change

Do not attach kicking, stomping, crushing, exploding, or mocking to named students. The animation would publicly cast one child as the aggressor and another as the humiliated loser, on the classroom projector. What feels funny in an anonymous fighting game lands differently when the labels are Jack and Zack and the teacher controls the screen.

Use a **friendly takeover pack** instead:

- **High-five handoff:** the former leader passes a glowing bolt.
- **Crown toss:** one avatar tosses the crown; the new leader catches it.
- **Rocket pass:** the new leader zooms past on a comet trail; both celebrate.
- **Portal swap:** the two positions flip through playful portals.
- **Photo finish:** both race through a line; the winner lands one step ahead.
- **Book page turn:** Booky flips the scene and reveals the new leader.

Copy should say “Zack takes the lead” or “A new leader!”—not “Zack defeats Jack.” A tie should put both avatars in the spotlight.

### Motion contract

- trigger only when first place genuinely changes after a question
- at most one takeover animation per question
- 1.2–1.8 seconds, never delaying the instructor's controls
- no sound by default
- instructor-level **Celebrations on/off** control
- honor `prefers-reduced-motion`; replace movement with a short crossfade and static result
- no rapid flashing, screen shake, collision sound, or forced full-screen movement
- ensure the final ranking is available immediately to assistive technology, independent of animation timing

Use CSS transforms/opacity for the first release, not a game engine. Build a small action matrix from avatar traits so the animation fits the characters while all actions share the same event payload.

```text
lead_changed {
  sessionCode,
  previousLeader: { participantId, displayName, avatarId },
  newLeader:      { participantId, displayName, avatarId },
  isTie,
  occurredAtQuestion
}
```

The server decides that a lead change occurred; the presenter chooses an eligible visual treatment. This keeps every connected screen consistent and prevents the client from inventing game state.

## Release plan

### Phase 0 — validate the business before billing code (week 1)

- preserve the generation/source provenance for every final Sidekick asset
- publish a hosted waitlist page with the price-reveal quiz
- create the Markdown Mash Product and annual Price in a Stripe sandbox
- interview 5 current instructors about deployment pain, expected class size, and school approval
- capture current server cost and usage as a monthly baseline
- write the first privacy/retention/data-flow inventory

**Go gate:** at least 10 qualified instructor emails or 5 explicit “I would pay $15/year” commitments. If the signal is weaker, keep the waitlist and ship Sidekicks without building subscriptions yet.

### Phase 1 — v1.3 “Sidekicks” (weeks 2–3)

- finalize and export the first 16 assets
- add `avatar_id` to persistent and trial participants
- server assignment, one pre-start shuffle, rejoin persistence
- show Sidekicks in lobby, live momentum card, leaderboard, podium, and participant result
- add instructor toggle and reduced-motion tests
- ship one gentle lead-change transition behind a feature flag

**Acceptance:** no layout regression at 1280 × 720, keyboard flow is intact, reduced-motion removes travel animation, and avatar identity survives reconnect.

### Phase 2 — hosted foundation (weeks 3–5)

- introduce email accounts and verified reset flow
- finish tenant ownership and remove the single-admin assumptions
- add ordered migrations and hosted environment configuration
- implement quota/entitlement service: 50 per room, one live room per account
- add 90-day default retention and deletion jobs
- add cross-tenant authorization and webhook security tests
- add transactional email, backups, health metrics, error alerts, and operator runbooks

**Acceptance:** no instructor can read, control, export, recover, or delete another instructor's session; a restored backup is tested; failed email and database dependencies fail visibly and safely.

### Phase 3 — paid invite-only beta (weeks 6–7)

- one annual product in hosted checkout
- idempotent subscription webhooks and billing portal
- subscription grace, cancellation, renewal, and deletion paths
- invite 10–20 instructors
- load-test 3 concurrent 60-participant rooms before advertising the 50-person cap
- keep a manual kill switch for new room creation if the server is unhealthy

**Go gate for public beta:** zero tenant-boundary failures, zero lost accepted answers in the load test, p95 answer acknowledgement under 250 ms in the test environment, at least 5 paid instructors, and at least half of activated instructors host a second real room within 30 days.

### Phase 4 — public beta and learning loop (weeks 8–10)

- publish status, privacy, terms, refund/cancellation, retention, and subprocessor pages
- add a simple in-product feedback link for instructors
- measure activation, repeat hosting, peak concurrent sockets, database growth, support minutes per account, refunds, and avatar/celebration opt-out
- review the $15 founding price only after 90 days of evidence

Do not add teams, school purchasing, multiple tiers, AI quiz generation, or a student account system during this beta.

## Success metrics

### Hosted

- visitor → hosted waitlist conversion
- paid → first real room with at least 3 participants within 7 days
- second real room within 30 days
- payment failure/refund rate
- infrastructure cost and support minutes per active instructor
- join failure rate, accepted-answer loss rate, and p95 answer acknowledgement

### Sidekicks and transitions

- percentage of instructors who leave Sidekicks enabled
- celebration disable/skip rate
- reduced-motion behavior verified in automated and manual QA
- teacher-reported distraction, embarrassment, or cultural concern
- reconnects that restore the correct avatar

Do not use student-level engagement tracking for product marketing. Aggregate operational events without retaining more student identity than the classroom feature needs.

## Risks and controls

| Risk | Control |
|---|---|
| Annual renewal surprises an instructor | Show “$15 billed annually” on the reveal card, CTA, checkout handoff, and receipt context, and enable renewal reminders. |
| One noisy classroom harms everyone | 50-person room cap, one concurrent room/account, system admission control, load tests, and monitoring. |
| Cross-tenant data leak | Tenant key on owned records, centralized authorization, negative tests on every read/write/export/recovery path. |
| Server restart ends a live room | Document beta limitation first; then externalize live state before multi-instance scaling. Do not pretend recovery is seamless. |
| Payment tax/compliance burden | Prefer an approved merchant of record and hosted checkout; obtain professional advice for the operator's own business/tax obligations. |
| Student privacy objection | No student accounts, no ads/profiling, minimal fields, published retention, deletion/export, school-oriented terms. |
| Avatars create stereotypes | Abstract objects/creatures, educator review, no body/skin builder, no uploaded images. |
| Transition feels like bullying | No target-directed violence or humiliation; positive handoff language, instructor off switch, reduced motion. |
| Artwork cannot be cleanly distributed | Preserve generation/source records, verify rights, and explicitly license assets. |
| License notices drift as the project grows | Keep `LICENSE`, `NOTICE`, the README badge, asset licensing, and contribution guidance aligned. |

## Sources checked

- [Render pricing and July 2026 small-app cost discussion](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses)
- [Stripe Payments pricing](https://stripe.com/pricing) and [Stripe Billing pricing change](https://support.stripe.com/questions/changes-to-the-stripe-billing-starter-and-scale-plans)
- [Stripe Checkout subscriptions](https://docs.stripe.com/payments/checkout/build-subscriptions), [Customer Portal](https://docs.stripe.com/customer-management), [API key practices](https://docs.stripe.com/keys-best-practices), and [webhook requirements](https://docs.stripe.com/webhooks)
- [Stripe Tax setup](https://docs.stripe.com/tax/set-up)
- [Kahoot participant limits](https://support.kahoot.com/hc/en-us/articles/115003072287-How-many-participants-can-play-a-kahoot) and [school plan comparison](https://kahoot.com/schools/edu-school-and-district/)
- [FTC COPPA guidance for schools and ed-tech operators](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [U.S. Department of Education guidance for third-party providers under FERPA](https://studentprivacy.ed.gov/resources/responsibilities-third-party-service-providers-under-ferpa)
- [W3C reduced-motion technique](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)
- [2023 educational gamification meta-analysis](https://pubmed.ncbi.nlm.nih.gov/37876838/) and [review noting negative feelings around low leaderboard placement](https://pmc.ncbi.nlm.nih.gov/articles/PMC10448467/)
- [GitHub guidance on licensing a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
