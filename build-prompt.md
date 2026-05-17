You are building a same-day sales-engineering proof of concept for a Senior Solutions Architect interview with PubNub.



Build a polished but lightweight demo application called:



PulseOps AI Incident Command Center



Purpose:

This app should demonstrate how PubNub can power a real-time, AI-assisted operational workflow. It should be more meaningful than a generic chat app, but still small enough to understand quickly. The demo should show real-time messaging, presence, incident channels, AI-assisted summaries, AI-assisted next actions, and production-minded architecture.



Audience:

The primary audience is a PubNub Solution Architecture leader. The app should show that the developer understands PubNub’s value as a managed real-time interaction layer, not just a chat API.



Core concept:

A customer has an active production incident, such as elevated checkout latency or failed order submissions. Multiple people join an incident room: customer, support engineer, manager, and AI assistant. Everyone sees updates in real time. Presence shows who is online. The AI assistant can summarize the incident, suggest next actions, and draft a customer update. AI outputs should publish back into the PubNub incident channel as normal incident events.



Technology requirements:

\- Use Next.js with React and TypeScript.

\- Use Tailwind CSS for styling.

\- Use the current recommended PubNub JavaScript/React SDK pattern. Use the PubNub MCP Server to verify current docs and best practices.

\- Do not require a backend database.

\- Use local mock data where needed.

\- Use PubNub for live messaging.

\- Use PubNub Presence if enabled.

\- Use PubNub Message Persistence if enabled, but gracefully fall back to seeded local messages if persistence is not enabled.

\- Use PubNub App Context if reasonable and low effort, but do not let it block the demo. If App Context setup is too much for the first pass, include it as an architecture note and use local metadata.

\- Do not put PubNub secret keys in the browser.

\- Use only publish and subscribe keys in browser-side environment variables.

\- If Access Manager is not implemented, include a clear architecture note explaining how it would be used in production.

\- Include an optional server route for AI assistance. If no LLM API key is present, use deterministic mock AI responses so the demo still works.

\- Avoid overbuilding.



Environment variables:

Create `.env.example` with:



NEXT\_PUBLIC\_PUBNUB\_PUBLISH\_KEY=

NEXT\_PUBLIC\_PUBNUB\_SUBSCRIBE\_KEY=

NEXT\_PUBLIC\_PUBNUB\_USER\_ID=

OPENAI\_API\_KEY=



The app must work without OPENAI\_API\_KEY by using mock AI output.



The app should fail gracefully if PubNub keys are missing by showing a setup panel explaining what variables are needed.



Functional requirements:



1\. Incident room

Create a main page that shows a seeded incident:



Incident title:

Checkout latency spike affecting mobile users



Incident metadata:

\- Severity: SEV-2

\- Status: Investigating

\- Customer: Acme Retail

\- Started: Today

\- Channel: incident.checkout-latency



The user should be able to switch between at least two seeded incidents:

\- Checkout latency spike affecting mobile users

\- Intermittent IoT device disconnects

\- Delayed lab result notifications



Each incident should map to a unique PubNub channel:

\- incident.checkout-latency

\- incident.iot-disconnects

\- incident.lab-results



2\. User identity simulation

Provide a simple user selector at the top:

\- Support Engineer

\- Customer Contact

\- Engineering Manager

\- AI Assistant



Each selected user should have:

\- uuid

\- display name

\- role

\- avatar initials

\- color-neutral styling, do not hardcode custom colors unless Tailwind defaults are used



The selected user controls the PubNub UUID.



3\. Real-time message feed

Show a live message feed for the active incident channel.



Messages should include:

\- id

\- channel

\- type

\- senderId

\- senderName

\- senderRole

\- text

\- timestamp

\- optional metadata



Supported message types:

\- user\_message

\- system\_event

\- ai\_summary

\- ai\_next\_actions

\- ai\_customer\_update

\- status\_change



The UI should visually distinguish user messages, system events, and AI assistant messages.



4\. Publishing

Add a composer at the bottom:

\- text input

\- Send button

\- Enter-to-send support



When the user sends a message:

\- publish it to the active PubNub channel

\- optimistically show it only if appropriate, but avoid duplicate display if PubNub echoes it back

\- include sender metadata and timestamp



5\. Presence

Show a right-side presence panel:

\- Active participants

\- Online count

\- Role labels

\- Last activity if available



Use PubNub Presence if available.

If Presence is not enabled or fails, show a graceful fallback:

"Presence requires the PubNub Presence add-on. The app is running without live presence."



6\. Message history

On entering an incident room:

\- try to fetch message history through PubNub Message Persistence

\- if unavailable, show seeded messages for the incident

\- clearly indicate whether live history or demo seed history is being shown



Do not let missing Message Persistence break the app.



7\. AI assistant panel

Add a prominent AI Assistant panel with three buttons:



\- Summarize incident

\- Suggest next actions

\- Draft customer update



When clicked:

\- gather the current incident metadata and recent messages

\- call a local Next.js API route such as `/api/ai`

\- the API route should return either real LLM output if OPENAI\_API\_KEY exists or mock output if not

\- publish the AI result back into the PubNub channel as one of:

&#x20; - ai\_summary

&#x20; - ai\_next\_actions

&#x20; - ai\_customer\_update



AI outputs should be visible to all subscribers in real time.



8\. AI output behavior

Mock summary example:

"Current summary: Acme Retail is experiencing elevated checkout latency affecting mobile users. The team has confirmed the issue is intermittent, customer impact is ongoing, and the next step is to isolate whether the delay is in the payment API, mobile client, or order service."



Mock next actions:

\- Confirm current error rate and latency by endpoint.

\- Compare mobile and web checkout paths.

\- Check recent deployment and configuration changes.

\- Publish a customer-facing status update within 15 minutes.

\- Assign one owner for payment API investigation.



Mock customer update:

"We are actively investigating elevated checkout latency affecting some mobile users. Our engineering team is reviewing recent service behavior and payment API response times. We will provide another update within 15 minutes or sooner if impact changes."



9\. Status controls

Add simple incident status controls:

\- Investigating

\- Identified

\- Mitigating

\- Resolved



When changed:

\- publish a status\_change event to the channel

\- update the local incident status display



10\. Architecture explanation inside the app

Add a collapsible "Architecture Notes" section in the UI with concise bullets:



\- Each incident maps to a PubNub channel.

\- PubNub handles real-time fanout to subscribed clients.

\- Presence shows active participants.

\- Message Persistence can restore incident history.

\- AI assistance is generated server-side and then published back into the incident channel.

\- In production, Access Manager would grant scoped read/write access by user, role, tenant, and incident.

\- Sensitive actions would go through backend validation before publishing operational commands.

\- This POC demonstrates the real-time workflow pattern, not a complete production auth model.



11\. README

Create a high-quality README.md with:

\- app overview

\- why this is relevant to PubNub

\- what PubNub capabilities it demonstrates

\- setup steps

\- environment variables

\- how to run locally

\- demo script

\- architecture explanation

\- production hardening notes

\- what to build next



12\. Production hardening notes

Create ARCHITECTURE.md with:

\- channel design

\- presence design

\- message schema

\- AI route design

\- security model

\- Access Manager production approach

\- backend validation

\- audit and observability

\- persistence strategy

\- multi-tenant considerations

\- possible customer use cases:

&#x20; - support command center

&#x20; - digital health care-team collaboration

&#x20; - live commerce incident handling

&#x20; - IoT operations monitoring

&#x20; - real-time field service coordination

&#x20; - AI-assisted customer support handoff



13\. Styling requirements

Use a clean, professional SaaS-style interface:

\- left incident list

\- center message feed

\- right presence and AI assistant panels

\- responsive enough for laptop screen

\- good spacing

\- readable typography

\- no visual clutter

\- no excessive animation

\- avoid hardcoded custom color choices unless necessary



14\. Quality requirements

After implementation:

\- run type checking

\- run linting if available

\- run the dev server

\- fix compile errors

\- verify the app renders

\- verify messages publish and subscribe if keys exist

\- verify the app still runs in mock/no-key mode

\- create clear notes for anything that requires PubNub account-side configuration



15\. Do not overbuild

Do not implement:

\- full authentication

\- production Access Manager token service

\- external ticketing integration

\- full database

\- RAG

\- complex agent framework

\- complex role administration

\- deployment automation



Focus on a credible, working POC that can be built and explained today.



Implementation plan:

1\. Scaffold the Next.js app.

2\. Add dependencies.

3\. Create types for incidents, users, messages, AI actions.

4\. Create sample incidents and seed messages.

5\. Create PubNub client/provider layer.

6\. Build main layout.

7\. Implement incident selection.

8\. Implement message feed.

9\. Implement publish/subscribe.

10\. Implement presence with graceful fallback.

11\. Implement history with graceful fallback.

12\. Implement AI API route with real-or-mock behavior.

13\. Publish AI outputs back into PubNub.

14\. Implement status changes.

15\. Add architecture notes panel.

16\. Add README.md and ARCHITECTURE.md.

17\. Run and fix the app.



When done, summarize:

\- what was built

\- how to run it

\- what PubNub features it demonstrates

\- what requires PubNub configuration

\- any limitations

\- suggested demo script

