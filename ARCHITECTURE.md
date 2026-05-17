# Architecture Notes

## Channel Design

Each incident maps to one PubNub channel:

- `incident.checkout-latency`
- `incident.iot-disconnects`
- `incident.lab-results`

When `NEXT_PUBLIC_DEMO_RUN_ID` is set, the UI appends that run ID to each incident channel, for example `incident.checkout-latency.demo-001`. This gives each demo run clean PubNub channels without deleting previous history.

This keeps fanout, history, presence, and authorization boundaries aligned with the operational room. Production deployments would namespace channels by tenant and environment, for example `tenant.acme.prod.incident.checkout-latency`.

## Presence Design

The client subscribes to the active incident channel with presence events enabled. It sets presence state with display name, role, initials, and last activity, then calls `hereNow` to populate the active participant panel.

If Presence is unavailable, the UI shows a non-blocking fallback notice. The incident workflow still works as a message-driven experience.

## Message Schema

Messages use a shared operational envelope:

```ts
type IncidentMessage = {
  id: string;
  channel: string;
  type:
    | "user_message"
    | "system_event"
    | "ai_summary"
    | "ai_next_actions"
    | "ai_customer_update"
    | "status_change";
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean | null>;
};
```

The `customMessageType` on PubNub publish is set to the event type, which makes it easier to reason about event categories downstream.

## AI Route Design

The local Next.js route `POST /api/ai` receives:

- AI action requested.
- Current incident metadata.
- Recent incident messages.

If `OPENAI_API_KEY` is present, the route calls the OpenAI Responses API from the server. If the key is absent or the request fails, it returns deterministic mock output so the demo remains usable offline or in a no-secret environment.

The browser never receives an LLM key. AI output is published back into the active PubNub channel as `ai_summary`, `ai_next_actions`, or `ai_customer_update`.

## Security Model

This POC does not implement full authentication. It uses local user switching to demonstrate roles and message attribution.

Production would add:

- Authenticated user sessions.
- A backend token service.
- Server-issued PubNub Access Manager tokens.
- Tenant and incident membership checks.
- Backend validation for sensitive operational commands.

## Access Manager Production Approach

Access Manager should grant short-lived, scoped tokens:

- Read access to incident channels where the user is a participant.
- Write access only for allowed roles and event types.
- Presence permissions for eligible incident rooms.
- Admin or manager access for status changes only where authorized.
- No browser access to PubNub secret keys.

Tokens should be refreshed by a backend after validating the user's identity, role, tenant, and incident membership.

## Backend Validation

User chat updates can be client-published when tokens are properly scoped. Higher-risk actions should go through backend validation:

- Status changes.
- Customer-facing updates.
- Operational commands.
- External ticket or paging actions.
- AI-generated recommendations that trigger workflow automation.

The backend can validate the action, publish to PubNub, and write an audit record.

## Audit And Observability

Production should capture:

- Message publish success and failure rates.
- Subscriber connection status.
- Presence occupancy trends.
- AI route latency and fallback rate.
- Status change history.
- User, role, tenant, and incident identifiers.
- Message Persistence retrieval errors.

These events should be correlated with incident IDs and PubNub timetokens.

## Persistence Strategy

PubNub Message Persistence is well-suited for restoring incident room timelines and replaying recent operational context. An application database should still hold authoritative incident records:

- Incident title, severity, status, and owner.
- Customer and tenant references.
- SLA timers.
- Links to tickets, alerts, traces, or dashboards.
- Audit and compliance records.

Message Persistence restores the collaboration stream; the database owns the durable incident model.

For demo resets, changing `NEXT_PUBLIC_DEMO_RUN_ID` is safer than deleting history because it moves the app to new channels. True PubNub history deletion requires Message Persistence with Delete-From-History enabled, and it should be performed by a server-side or admin script that uses privileged credentials outside browser code.

## Multi-Tenant Considerations

For customer-facing incident rooms:

- Namespace channels by tenant and environment.
- Never expose one tenant's channel names or membership to another tenant.
- Scope Access Manager tokens by tenant and incident.
- Validate every server-side AI and status action against tenant membership.
- Consider payload encryption for regulated or sensitive environments.

## Customer Use Cases

- Support command center.
- Digital health care-team collaboration.
- Live commerce incident handling.
- IoT operations monitoring.
- Real-time field service coordination.
- AI-assisted customer support handoff.

## App Context

PubNub App Context could store user metadata, channel metadata, and channel membership relationships. This POC keeps metadata local to reduce setup friction, but the production path is straightforward:

- User metadata for display name, role, avatar initials, and team.
- Channel metadata for incident title, severity, customer, and status.
- Memberships for incident participants.

App Context should be paired with Access Manager so metadata reads and writes are tenant-safe.
