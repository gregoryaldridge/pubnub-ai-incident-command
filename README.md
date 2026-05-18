# PulseOps AI Incident Command Center

PulseOps AI Incident Command Center is a same-day sales-engineering proof of concept for showing how PubNub can power a real-time, AI-assisted operational workflow.

The demo models an active customer incident room where support, customer contacts, engineering managers, and an AI assistant coordinate across internal and customer-visible live channels. Users can switch incidents, publish updates, view presence, restore history when Message Persistence is enabled, ask the AI assistant for summaries and next actions, and review customer-facing AI drafts before publishing them.

The UI uses a PubNub-inspired visual theme for the sales engineering demo, without official PubNub logo artwork or external brand assets.

## Why This Matters To PubNub

This is intentionally more than generic chat. It demonstrates PubNub as a managed real-time interaction layer for operational command centers:

- Each incident maps to internal and customer-visible PubNub channels.
- PubNub provides low-latency fanout to all active participants.
- Presence shows who is currently in the room.
- PubNub Signals provide ephemeral typing and AI activity indicators.
- Message Persistence can restore the incident timeline.
- AI assistance is generated server-side, then distributed through PubNub after the right audience is selected.
- The UI includes production notes for Access Manager, backend validation, tenant isolation, and auditability.

## Capabilities Demonstrated

- Publish/subscribe messaging with the current PubNub JavaScript SDK.
- Entity-based channel subscription with presence events.
- Message Persistence via `fetchMessages`, with graceful fallback to seeded local history.
- Presence via `hereNow` and presence state, with graceful fallback when the add-on is unavailable.
- Audience-scoped incident streams using `.internal` and `.customer` channels.
- PubNub Signals for lightweight typing and AI activity indicators.
- Browser-safe environment variables using only publish and subscribe keys.
- Optional server-side AI route with deterministic mock output when no LLM key is present.

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
copy .env.example .env.local
```

Fill in browser-safe PubNub keys if you want live messaging:

```bash
NEXT_PUBLIC_PUBNUB_PUBLISH_KEY=pub-c-...
NEXT_PUBLIC_PUBNUB_SUBSCRIBE_KEY=sub-c-...
NEXT_PUBLIC_PUBNUB_USER_ID=
NEXT_PUBLIC_DEMO_RUN_ID=demo-001
OPENAI_API_KEY=
```

`OPENAI_API_KEY` is optional. Without it, `/api/ai` returns deterministic mock AI responses so the demo still works.

`NEXT_PUBLIC_DEMO_RUN_ID` is optional but useful for live demos. When set, the app appends it to each incident channel, for example `incident.checkout-latency.demo-001`. Change the demo run ID, then restart the dev server, to reset the demo to clean PubNub channels without deleting existing PubNub history.

## Run Locally

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

## Demo Script

1. Start on the Checkout latency incident and point out the base incident channel.
2. Show that Support Engineer can send either an internal note or a customer-visible update.
3. Switch acting user to Customer Contact and show that only customer-visible messages are shown.
4. Open a second browser tab, select a different acting user, and show real-time fanout plus typing indicators when PubNub keys are configured.
5. Change status from Investigating to Identified and explain that status changes publish to the customer-visible stream.
6. Use Summarize incident and Suggest next actions, which publish internally.
7. Use Draft customer update, review the draft, then publish it to the customer-visible stream.
8. Expand Architecture Notes and discuss Access Manager and backend validation for production.

## PubNub Configuration Notes

Live messaging requires publish and subscribe keys.

Presence requires the PubNub Presence add-on. If Presence is not enabled, the app shows a fallback notice and continues running.

Message history requires Message Persistence. If Message Persistence is not enabled or returns no messages, the app falls back to seeded incident messages.

Typing and AI activity indicators are ephemeral PubNub Signals. They are intentionally not shown as normal incident messages and should not be treated as durable history.

No PubNub secret key is used in browser code. Access Manager token issuing belongs on a trusted backend.

## Architecture

The application is intentionally lightweight:

- Next.js App Router for the UI and local AI route.
- React client state for incident selection, status, and message rendering.
- PubNub JavaScript SDK `10.2.7` for publish, subscribe, presence, and history.
- Tailwind CSS for a restrained SaaS-style layout.
- Local seed data for incidents, users, and fallback messages.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for production hardening details.

See [PROJECT_NOTES.md](./PROJECT_NOTES.md) for a concise implementation summary, key files, configuration notes, known limitations, and suggested next changes.

## Production Hardening

- Add real authentication and issue PubNub Access Manager tokens server-side.
- Scope channel access by tenant, user, role, and incident.
- Validate operational commands on a backend before publishing.
- Persist incident metadata and authoritative status in a database.
- Add audit logs for AI output, user actions, status changes, and sensitive commands.
- Add observability for publish failures, subscriber health, AI latency, and channel volume.
- Encrypt sensitive payloads when required by the customer environment.

## What To Build Next

- Access Manager token service.
- Tenant-aware incident list from a backend API.
- Message actions for acknowledgements and pinned decisions.
- Webhook integration for ticketing or paging systems.
- AI output approval workflow for customer-facing updates.
- App Context metadata for users, channels, and memberships.
