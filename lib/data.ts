import type { DemoUser, Incident, IncidentMessage, MessageAudience } from "./types";

export const demoUsers: DemoUser[] = [
  {
    uuid: "support-engineer",
    displayName: "Jordan Lee",
    role: "Support Engineer",
    initials: "JL",
  },
  {
    uuid: "customer-contact",
    displayName: "Maya Patel",
    role: "Customer Contact",
    initials: "MP",
  },
  {
    uuid: "engineering-manager",
    displayName: "Sam Rivera",
    role: "Engineering Manager",
    initials: "SR",
  },
  {
    uuid: "ai-assistant",
    displayName: "PulseOps AI",
    role: "AI Assistant",
    initials: "AI",
  },
];

export const aiUser = demoUsers.find((user) => user.role === "AI Assistant")!;

export const demoRunId = process.env.NEXT_PUBLIC_DEMO_RUN_ID?.trim() ?? "";

export function applyDemoRunId(channel: string) {
  return demoRunId ? `${channel}.${demoRunId}` : channel;
}

export function getAudienceChannel(channel: string, audience: MessageAudience) {
  return `${channel}.${audience}`;
}

export function getAudienceFromChannel(channel: string): MessageAudience | null {
  if (channel.endsWith(".internal")) {
    return "internal";
  }

  if (channel.endsWith(".customer")) {
    return "customer";
  }

  return null;
}

function baseChannelFor(channel: string) {
  const withoutAudience = channel.replace(/\.(internal|customer)$/, "");

  return demoRunId && withoutAudience.endsWith(`.${demoRunId}`)
    ? withoutAudience.slice(0, -(demoRunId.length + 1))
    : withoutAudience;
}

const baseIncidents: Incident[] = [
  {
    id: "checkout-latency",
    title: "Checkout latency spike affecting mobile users",
    severity: "SEV-2",
    status: "Investigating",
    customer: "Acme Retail",
    started: "Today",
    channel: "incident.checkout-latency",
    description:
      "Mobile shoppers are reporting intermittent checkout delays during payment confirmation.",
    impact:
      "Elevated latency on mobile checkout, possible cart abandonment risk.",
  },
  {
    id: "iot-disconnects",
    title: "Intermittent IoT device disconnects",
    severity: "SEV-3",
    status: "Investigating",
    customer: "Northstar Manufacturing",
    started: "Today",
    channel: "incident.iot-disconnects",
    description:
      "A subset of gateway-connected sensors is dropping from telemetry channels for short intervals.",
    impact:
      "Operations team has reduced confidence in live equipment telemetry.",
  },
  {
    id: "lab-results",
    title: "Delayed lab result notifications",
    severity: "SEV-2",
    status: "Investigating",
    customer: "Summit Health",
    started: "Today",
    channel: "incident.lab-results",
    description:
      "Care-team notifications for completed lab results are delayed for some clinics.",
    impact:
      "Clinicians may need to refresh the EHR manually for urgent result visibility.",
  },
];

export const incidents: Incident[] = baseIncidents.map((incident) => ({
  ...incident,
  channel: applyDemoRunId(incident.channel),
}));

const baseDate = new Date("2026-05-15T20:35:00.000Z");
const minutesAgo = (minutes: number) =>
  new Date(baseDate.getTime() - minutes * 60_000).toISOString();

export const seedMessagesByChannel: Record<string, IncidentMessage[]> = {
  "incident.checkout-latency": [
    {
      id: "seed-checkout-1",
      channel: "incident.checkout-latency",
      audience: "customer",
      type: "system_event",
      senderId: "system",
      senderName: "PulseOps",
      senderRole: "Support Engineer",
      text: "Incident room opened for Acme Retail checkout latency.",
      timestamp: minutesAgo(28),
    },
    {
      id: "seed-checkout-2",
      channel: "incident.checkout-latency",
      audience: "customer",
      type: "user_message",
      senderId: "customer-contact",
      senderName: "Maya Patel",
      senderRole: "Customer Contact",
      text: "Mobile checkout confirmations are taking 20 to 40 seconds for a subset of customers.",
      timestamp: minutesAgo(24),
    },
    {
      id: "seed-checkout-3",
      channel: "incident.checkout-latency",
      audience: "internal",
      type: "user_message",
      senderId: "support-engineer",
      senderName: "Jordan Lee",
      senderRole: "Support Engineer",
      text: "We are comparing mobile and web checkout paths and checking payment API timing.",
      timestamp: minutesAgo(18),
    },
    {
      id: "seed-checkout-4",
      channel: "incident.checkout-latency",
      audience: "internal",
      type: "user_message",
      senderId: "engineering-manager",
      senderName: "Sam Rivera",
      senderRole: "Engineering Manager",
      text: "Please keep one owner on payment API and one on mobile client release diff.",
      timestamp: minutesAgo(12),
    },
  ],
  "incident.iot-disconnects": [
    {
      id: "seed-iot-1",
      channel: "incident.iot-disconnects",
      audience: "customer",
      type: "system_event",
      senderId: "system",
      senderName: "PulseOps",
      senderRole: "Support Engineer",
      text: "Incident room opened for Northstar Manufacturing telemetry disconnects.",
      timestamp: minutesAgo(36),
    },
    {
      id: "seed-iot-2",
      channel: "incident.iot-disconnects",
      audience: "customer",
      type: "user_message",
      senderId: "customer-contact",
      senderName: "Maya Patel",
      senderRole: "Customer Contact",
      text: "The issue appears concentrated in two facilities with the same gateway firmware.",
      timestamp: minutesAgo(31),
    },
    {
      id: "seed-iot-3",
      channel: "incident.iot-disconnects",
      audience: "internal",
      type: "user_message",
      senderId: "support-engineer",
      senderName: "Jordan Lee",
      senderRole: "Support Engineer",
      text: "We are checking disconnect frequency against heartbeat timeout and carrier changes.",
      timestamp: minutesAgo(19),
    },
  ],
  "incident.lab-results": [
    {
      id: "seed-lab-1",
      channel: "incident.lab-results",
      audience: "customer",
      type: "system_event",
      senderId: "system",
      senderName: "PulseOps",
      senderRole: "Support Engineer",
      text: "Incident room opened for Summit Health lab result notification delays.",
      timestamp: minutesAgo(42),
    },
    {
      id: "seed-lab-2",
      channel: "incident.lab-results",
      audience: "customer",
      type: "user_message",
      senderId: "customer-contact",
      senderName: "Maya Patel",
      senderRole: "Customer Contact",
      text: "Completed results are visible in the source system, but notifications arrive 10 to 15 minutes late.",
      timestamp: minutesAgo(34),
    },
    {
      id: "seed-lab-3",
      channel: "incident.lab-results",
      audience: "internal",
      type: "user_message",
      senderId: "engineering-manager",
      senderName: "Sam Rivera",
      senderRole: "Engineering Manager",
      text: "Check notification worker queue depth and recent changes to tenant routing rules.",
      timestamp: minutesAgo(21),
    },
  ],
};

export const getSeedMessages = (
  channel: string,
  audiences: MessageAudience[] = ["internal", "customer"]
) => {
  const messages = seedMessagesByChannel[baseChannelFor(channel)] ?? [];

  return messages
    .filter((message) => audiences.includes(message.audience))
    .map((message) => ({
      ...message,
      channel: getAudienceChannel(channel, message.audience),
    }));
};
