# Project Notes

## What Was Built

PulseOps AI Incident Command Center is a lightweight Next.js proof of concept for a PubNub-powered incident room. It demonstrates real-time operational collaboration around seeded customer incidents, with AI-generated summaries and updates published back into the same incident channel.

Implemented capabilities:

- Three seeded incidents with unique PubNub channels.
- User identity simulation for Support Engineer, Customer Contact, Engineering Manager, and AI Assistant.
- Real-time message feed with typed incident events.
- PubNub publish/subscribe for live updates.
- PubNub Presence panel with graceful fallback.
- PubNub Message Persistence fetch with seeded-history fallback.
- Status controls that publish `status_change` events.
- Server-side AI route at `/api/ai` with OpenAI support and deterministic mock fallback.
- Collapsible in-app architecture notes.
- README and architecture documentation.

## How To Run

Install dependencies:

```bash
npm install
```

Create `.env.local` from the example:

```bash
copy .env.example .env.local
```

Run the local dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Key Files

- `app/page.tsx`: app entry point.
- `components/PulseOpsApp.tsx`: main UI, incident layout, composer, AI panel, presence panel, status controls.
- `hooks/useIncidentPubNub.ts`: PubNub client setup, subscription, publish, history, and presence behavior.
- `app/api/ai/route.ts`: server-side AI endpoint with OpenAI-or-mock behavior.
- `lib/data.ts`: seeded users, incidents, and fallback messages.
- `lib/types.ts`: shared incident, message, user, presence, and AI types.
- `lib/ai.ts`: AI prompt construction and deterministic mock responses.
- `README.md`: setup, demo script, and overview.
- `ARCHITECTURE.md`: production architecture and hardening notes.

## PubNub Configuration

Browser-side environment variables:

```bash
NEXT_PUBLIC_PUBNUB_PUBLISH_KEY=
NEXT_PUBLIC_PUBNUB_SUBSCRIBE_KEY=
NEXT_PUBLIC_PUBNUB_USER_ID=
```

Server-side optional variable:

```bash
OPENAI_API_KEY=
```

PubNub account-side capabilities:

- Publish/Subscribe: required for live incident events.
- Presence: required for live participant occupancy and presence state.
- Message Persistence: required to restore stored incident history.
- Access Manager: not implemented in this POC, but recommended for production.
- App Context: documented as a production extension, but local metadata is used for this POC.

No PubNub secret key is used in browser code.

## Known Limitations

- No production authentication or role enforcement.
- No Access Manager token service.
- Incident status is local UI state plus channel event, not persisted in a database.
- Incident metadata is local seed data.
- AI outputs are published directly after generation; there is no approval workflow.
- Message history depends on PubNub Message Persistence and will fall back to seeded messages when no history exists.
- Presence depends on the Presence add-on and gracefully falls back when unavailable.
- No external ticketing, paging, observability, or audit integration.
- App Context is not wired into the first-pass implementation.

## Suggested Next Changes

- Add a backend Access Manager token endpoint with short-lived scoped grants.
- Persist incident records and authoritative status in a database.
- Store user, channel, and membership metadata in PubNub App Context.
- Add a customer-update approval step before publishing AI-generated external messages.
- Add message actions for acknowledgements, pinned decisions, and owner assignment.
- Add audit logging for status changes, AI outputs, and operational commands.
- Add tenant-aware channel naming and membership checks.
- Add integration hooks for ticketing, paging, or observability systems.
- Add automated end-to-end tests for no-key mode, live PubNub mode, and AI fallback behavior.
