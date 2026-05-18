export type IncidentStatus =
  | "Investigating"
  | "Identified"
  | "Mitigating"
  | "Resolved";

export type MessageType =
  | "user_message"
  | "system_event"
  | "ai_summary"
  | "ai_next_actions"
  | "ai_customer_update"
  | "status_change";

export type UserRole =
  | "Support Engineer"
  | "Customer Contact"
  | "Engineering Manager"
  | "AI Assistant";

export type MessageAudience = "internal" | "customer";

export type DemoUser = {
  uuid: string;
  displayName: string;
  role: UserRole;
  initials: string;
};

export type Incident = {
  id: string;
  title: string;
  severity: string;
  status: IncidentStatus;
  customer: string;
  started: string;
  channel: string;
  description: string;
  impact: string;
};

export type IncidentMessage = {
  id: string;
  channel: string;
  audience: MessageAudience;
  type: MessageType;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type PresenceParticipant = {
  uuid: string;
  displayName: string;
  role: UserRole;
  initials: string;
  lastActivity?: string;
};

export type AiAction = "summary" | "next_actions" | "customer_update";

export type AiSource = "openai" | "mock";

export type AiResponse = {
  text: string;
  source: AiSource;
  usedMock: boolean;
};

export type ActivityKind =
  | "typing"
  | "ai_summary"
  | "ai_next_actions"
  | "ai_customer_update";

export type ActivityIndicator = {
  id: string;
  userId: string;
  displayName: string;
  role: UserRole;
  audience: MessageAudience;
  kind: ActivityKind;
  expiresAt: number;
};
