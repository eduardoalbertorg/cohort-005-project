# Hosted in-app notification providers for Cadence

Research for [issue #3](https://github.com/eduardoalbertorg/cohort-005-project/issues/3).
Documentation and public USD pricing checked on November 24, 2026.
The findings are based on vendor documentation. Account behavior, latency, and migration fidelity still need verification.

## Shortlist

**Test Knock first.** It documents a signed user token with explicit feed read and write grants, a 24-hour trigger idempotency window, and indefinite in-app feed retention.
**Keep Novu Cloud on the shortlist** if 90 days of history meets the product requirement and API idempotency is enabled in the target environment. Its Pro tier has the lowest published entry price among the two.
**Keep Courier as a price comparison** if Cadence needs only a single feed per recipient. Its scoped tokens and custom UI cover that case. For tenant-scoped use, verify the server enforces the expected boundary when the client supplies a different tenant. [Knock authentication](https://docs.knock.app/in-app-ui/security-and-authentication) · [Knock API](https://docs.knock.app/api-reference/overview) · [Knock retention](https://docs.knock.app/manage-your-account/data-retention) · [Knock pricing](https://knock.app/pricing) · [Novu idempotency](https://docs.novu.co/api-reference/idempotency) · [Novu pricing](https://www.novu.co/pricing/) · [Courier authentication](https://www.courier.com/docs/in-app/authenticate-users) · [Courier tenant feeds](https://www.courier.com/docs/in-app/send-to-the-inbox)

## Cadence integration boundary

Cadence owns the transactional event, eligible recipient, notification type, and authorized destination.
Send an explicit stable Cadence user ID and a minimal notification payload from the backend.
Derive inbox credentials from the authenticated session and use environment-specific keys.
The provider stores the feed and its read state.
Treat a notification link as a pointer to a Cadence resource and enforce authorization again when the user opens it.
For reliable delivery, record the intent at the same transaction boundary as the business event, then dispatch asynchronously using a stable key per event and recipient.
Track attempts and provider request IDs so an ambiguous result can be reconciled before replaying outside the deduplication window.

## Provider comparison

### Knock

- **Identity and isolation.** Turn on enhanced security in production and sign an RS256 JWT server-side for the Cadence user ID.
  Use explicit feed-only read and write grants.
  Knock documents tenant-specific grants if Cadence needs user-plus-tenant isolation.
  The tenant display filter alone includes unscoped messages by default, so use explicit grants and test the expected scope. [Authentication and grants](https://docs.knock.app/in-app-ui/security-and-authentication) · [Feed filtering](https://docs.knock.app/in-app-ui/feeds/filtering-in-app-feeds)
- **Feed and UI.** The per-user channel feed supports pagination and unread or unseen counts, with reversible read, seen, and archive actions and real-time updates.
  Use the React components or build Cadence's UI against the feed SDK/API. [Feeds](https://docs.knock.app/in-app-ui/feeds/overview) · [Feed API](https://docs.knock.app/api-reference/users/feeds/list_items) · [Real-time and badges](https://docs.knock.app/in-app-ui/api-overview)
- **Reliability.** A backend workflow trigger takes an explicit recipient list.
  The trigger's idempotency key safely retries an identical request within 24 hours and rejects reuse with changed parameters.
  Feed reads have a documented per-user and per-environment rate limit. [Workflow trigger](https://docs.knock.app/api-reference/workflows/trigger) · [API retries and limits](https://docs.knock.app/api-reference/overview) · [Feed API](https://docs.knock.app/api-reference/users/feeds/list_items)
- **Pricing and portability.** Developer includes 10,000 messages monthly.
  Starter costs $250/month for 50,000, then $0.005 per additional message.
  One successful delivery to one recipient on one channel counts once.
  Paginate the feed for each known Cadence user and channel to evaluate history export.
  Feed items persist after message logs expire, so use the feed endpoint for older items.
  Read and archive webhook events provide another way to capture changes during a transition.
  Bulk export and exact history import remain unverified. [Pricing](https://knock.app/pricing) · [Data retention](https://docs.knock.app/manage-your-account/data-retention) · [Feed API](https://docs.knock.app/api-reference/users/feeds/list_items) · [Webhook event types](https://docs.knock.app/developer-tools/outbound-webhooks/event-types)

### Novu Cloud

- **Identity and isolation.** Trigger with an explicit `subscriberId`. Enable production HMAC and sign that ID server-side.
  If Cadence needs a tenant-specific inbox, Novu also documents signing the canonical context separately.
  The documented subscriber hash is a deterministic signature of the identifier. Verify captured-credential lifetime and tenant context behavior before adoption. [Trigger a workflow](https://docs.novu.co/platform/workflow/trigger-workflow) · [Secure the inbox](https://docs.novu.co/platform/inbox/prepare-for-production)
- **Feed and UI.** The prebuilt Inbox and headless React or JavaScript clients support paginated lists, unread counts, real-time updates, read actions, and archiving. [Headless inbox](https://docs.novu.co/platform/inbox/headless-mode)
- **Reliability.** API-layer `Idempotency-Key` caches completed responses for 24 hours, may require support to enable it, and has a separate in-progress response with `Retry-After`.
  Workflow `transactionId` deduplication has weaker guarantees than API-layer idempotency.
  The Inbox persists in Novu and updates connected clients via WebSocket. Third-party channel retry policies have no bearing on Inbox delivery. [Idempotency](https://docs.novu.co/api-reference/idempotency) · [Delivery retries](https://docs.novu.co/platform/developer/delivery-retries)
- **Pricing and portability.** Free covers 10,000 workflow runs monthly and retains the Inbox for 30 days.
  Pro starts at $30/month for 30,000 runs, and Team starts at $250/month for 250,000 runs. Both retain the Inbox for 90 days and list $1.20 per 1,000 extra runs.
  The paginated message API filters by subscriber and channel. Bulk export, expired history recovery, and preservation of archive state remain unverified. [Pricing](https://www.novu.co/pricing/) · [Platform limits](https://docs.novu.co/platform/developer/limits) · [List messages](https://docs.novu.co/api-reference/messages/list-all-messages)

### Courier

- **Identity and isolation.** Issue a short-lived JWT via Courier from Cadence's backend, scoped to one `user_id` and inbox read and event write.
  Courier documents sending to an explicit recipient and optional tenant, with the client signing in to that tenant's feed.
  The inbox JWT documentation shows user binding. Verify whether a caller can alter the tenant and access history for a tenant they no longer belong to. [JWT scopes](https://www.courier.com/docs/in-app/authenticate-users) · [Send to a tenant inbox](https://www.courier.com/docs/in-app/send-to-the-inbox)
- **Feed and UI.** The hosted feed syncs read and archive state across devices.
  The React component can be themed or partially replaced, and the SDK exposes paginated messages, unread counts and actions for a custom UI. [Inbox behavior](https://www.courier.com/docs/in-app/how-the-inbox-behaves) · [Custom inbox](https://www.courier.com/docs/in-app/build-a-custom-inbox)
- **Reliability.** Route `POST /send` explicitly to the inbox channel.
  The Send API supports a stable `Idempotency-Key` with a documented 24-hour response cache.
  The SDK retries transient request failures, and delivery webhooks are available for correlating accepted sends with delivery. [Send to the inbox](https://www.courier.com/docs/in-app/send-to-the-inbox) · [Idempotency window](https://www.courier.com/blog/customer-messaging-tools-without-engineers) · [SDK retries](https://www.courier.com/blog/design-studio-journeys-engineering-integration-guide) · [Delivery webhooks](https://www.courier.com/docs/guides/track-delivery)
- **Pricing and portability.** Developer includes up to 10,000 notifications monthly, and Pro advertises $0.005 per notification.
  Check actual billing for multi-channel or journey use if the scope grows.
  Inbox items persist without a per-message expiry. The pricing page separately lists 30-day logs on Developer and Pro.
  The SDK feed can paginate messages and there is a paginated message log API. Full historical extraction of inbox content and engagement state remains unverified. [Pricing](https://www.courier.com/pricing) · [Inbox behavior](https://www.courier.com/docs/in-app/how-the-inbox-behaves) · [Custom inbox](https://www.courier.com/docs/in-app/build-a-custom-inbox) · [List messages](https://www.courier.com/docs/api-reference/messages/list-messages)

## What the provider decision should verify

- Sign in as two Cadence users. Verify each can list and update only their own messages, including changed user IDs, copied message IDs, bulk actions, and the real-time connection.
  If tenants are required, repeat with one user in two tenants, including removal from one tenant.
- Trigger once and replay after an ambiguous timeout with the same key. Check for one feed item.
  Confirm what an accepted response guarantees and where to reconcile an accepted send that never appears.
- Mark an item read in one browser, refresh and reopen in a second browser, and check paging, unread counts and archive behavior.
  Open the destination after revoking access and verify Cadence enforces current permissions.
- Set the feed retention requirement and model pricing from committed events times eligible recipients. Confirm overage, branding and plan limits on the selected account.
- Decide whether a provider change must preserve old feed entries and read state.
  Keep stable IDs, event-to-recipient delivery references and the approved payload shape in Cadence.
  If historical fidelity is required, verify an export of content and state and an import that avoids notifying users again before choosing a provider.
