import type { AiAction, Incident, IncidentMessage } from "./types";

export function getMockAiResponse(
  action: AiAction,
  incident: Pick<Incident, "title" | "customer">
) {
  if (action === "summary") {
    if (incident.title.includes("IoT")) {
      return `Current summary: ${incident.customer} is seeing intermittent IoT device disconnects concentrated around gateway-connected sensors. The team is comparing disconnect timing against heartbeat settings, gateway firmware, and network carrier behavior before selecting a mitigation.`;
    }

    if (incident.title.includes("lab")) {
      return `Current summary: ${incident.customer} is experiencing delayed lab result notifications. Results are available in the source system, but notification delivery is lagging, so the team is reviewing worker queue depth, tenant routing, and recent notification service changes.`;
    }

    return "Current summary: Acme Retail is experiencing elevated checkout latency affecting mobile users. The team has confirmed the issue is intermittent, customer impact is ongoing, and the next step is to isolate whether the delay is in the payment API, mobile client, or order service.";
  }

  if (action === "next_actions") {
    return [
      "Confirm current error rate and latency by endpoint.",
      "Compare mobile and web checkout paths.",
      "Check recent deployment and configuration changes.",
      "Publish a customer-facing status update within 15 minutes.",
      "Assign one owner for payment API investigation.",
    ].join("\n");
  }

  return "We are actively investigating elevated checkout latency affecting some mobile users. Our engineering team is reviewing recent service behavior and payment API response times. We will provide another update within 15 minutes or sooner if impact changes.";
}

export function buildAiPrompt(
  action: AiAction,
  incident: Incident,
  messages: IncidentMessage[]
) {
  const actionInstruction =
    action === "summary"
      ? "Summarize the incident in one concise paragraph for an incident channel."
      : action === "next_actions"
        ? "Return five crisp next actions as newline-separated bullets without markdown symbols."
        : "Draft a customer-facing update in one short paragraph with a clear next-update expectation.";

  const recentMessages = messages
    .slice(-12)
    .map(
      (message) =>
        `${message.senderName} (${message.senderRole}): ${message.text}`
    )
    .join("\n");

  return [
    "You are an AI incident assistant in a real-time operations command center.",
    actionInstruction,
    "Keep the response practical, calm, and suitable for a sales-engineering demo.",
    "",
    `Incident: ${incident.title}`,
    `Customer: ${incident.customer}`,
    `Severity: ${incident.severity}`,
    `Status: ${incident.status}`,
    `Impact: ${incident.impact}`,
    "",
    "Recent channel activity:",
    recentMessages || "No recent messages.",
  ].join("\n");
}
