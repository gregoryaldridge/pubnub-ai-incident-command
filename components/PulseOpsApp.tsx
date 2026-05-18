"use client";

import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { aiUser, demoRunId, demoUsers, incidents } from "@/lib/data";
import { formatRelative, formatTime, makeId } from "@/lib/format";
import type {
  ActivityIndicator,
  AiAction,
  AiResponse,
  AiSource,
  DemoUser,
  Incident,
  IncidentMessage,
  IncidentStatus,
  MessageAudience,
  MessageType,
} from "@/lib/types";
import { useIncidentPubNub } from "@/hooks/useIncidentPubNub";

const statusOptions: IncidentStatus[] = [
  "Investigating",
  "Identified",
  "Mitigating",
  "Resolved",
];

const aiActions: Array<{
  action: AiAction;
  label: string;
  type: MessageType;
  icon: typeof Sparkles;
}> = [
  {
    action: "summary",
    label: "Summarize incident",
    type: "ai_summary",
    icon: FileText,
  },
  {
    action: "next_actions",
    label: "Suggest next actions",
    type: "ai_next_actions",
    icon: Sparkles,
  },
  {
    action: "customer_update",
    label: "Draft customer update",
    type: "ai_customer_update",
    icon: Bot,
  },
];

function buildUserMessage(
  incident: Incident,
  user: DemoUser,
  text: string,
  audience: MessageAudience
): IncidentMessage {
  return {
    id: makeId("msg"),
    channel: incident.channel,
    audience,
    type: "user_message",
    senderId: user.uuid,
    senderName: user.displayName,
    senderRole: user.role,
    text,
    timestamp: new Date().toISOString(),
  };
}

function buildStatusMessage(
  incident: Incident,
  user: DemoUser,
  status: IncidentStatus
): IncidentMessage {
  return {
    id: makeId("status"),
    channel: incident.channel,
    audience: "customer",
    type: "status_change",
    senderId: user.uuid,
    senderName: user.displayName,
    senderRole: user.role,
    text: `${user.displayName} changed incident status to ${status}.`,
    timestamp: new Date().toISOString(),
    metadata: { status },
  };
}

function canSelectAudience(user: DemoUser) {
  return (
    user.role === "Support Engineer" ||
    user.role === "Engineering Manager" ||
    user.role === "AI Assistant"
  );
}

function defaultAudienceForUser(user: DemoUser): MessageAudience {
  return canSelectAudience(user) ? "internal" : "customer";
}

function audienceLabel(audience: MessageAudience) {
  return audience === "internal" ? "Internal" : "Customer-visible";
}

function audienceComposerLabel(audience: MessageAudience) {
  return audience === "internal" ? "Internal note" : "Customer-visible update";
}

function audienceBadgeClass(audience: MessageAudience, inverted = false) {
  if (inverted) {
    return audience === "internal"
      ? "border-white/15 bg-white/10 text-white"
      : "border-pn-gold/50 bg-pn-gold/20 text-pn-gold";
  }

  return audience === "internal"
    ? "border-indigo-200 bg-indigo-50 text-pn-purple"
    : "border-cyan-200 bg-cyan-50 text-pn-teal";
}

function activityText(indicator: ActivityIndicator) {
  if (indicator.kind === "typing") {
    if (indicator.audience === "internal") {
      return `${indicator.displayName} is typing an internal note...`;
    }

    return indicator.role === "Customer Contact"
      ? `${indicator.displayName} is typing...`
      : `${indicator.displayName} is typing a customer-visible update...`;
  }

  if (indicator.kind === "ai_summary") {
    return "PulseOps AI is summarizing the incident...";
  }

  if (indicator.kind === "ai_next_actions") {
    return "PulseOps AI is suggesting next actions...";
  }

  return "PulseOps AI is drafting a customer update...";
}

function messageStyle(type: MessageType) {
  if (type.startsWith("ai_")) {
    return "border-pn-navyDark bg-pn-navyDark text-white shadow-[0_14px_32px_rgba(4,17,61,0.16)]";
  }

  if (type === "system_event" || type === "status_change") {
    return "border-pn-border bg-pn-bg text-pn-muted";
  }

  return "border-pn-border bg-pn-card text-pn-text";
}

function messageLabel(type: MessageType) {
  if (type === "ai_summary") return "AI summary";
  if (type === "ai_next_actions") return "AI next actions";
  if (type === "ai_customer_update") return "AI customer update";
  if (type === "status_change") return "Status change";
  if (type === "system_event") return "System event";
  return "Message";
}

function getMessageAiSource(message: IncidentMessage): AiSource | null {
  const source = message.metadata?.source;

  if (source === "openai" || source === "mock") {
    return source;
  }

  if (message.metadata?.usedMock === true) {
    return "mock";
  }

  if (message.metadata?.usedMock === false) {
    return "openai";
  }

  return null;
}

function aiSourceLabel(source: AiSource | null) {
  if (source === "openai") return "OpenAI";
  if (source === "mock") return "Mock fallback";
  return "No AI response yet";
}

function aiSourceBadgeClass(source: AiSource | null) {
  if (source === "openai") {
    return "border-cyan-200 bg-cyan-50 text-pn-teal";
  }

  if (source === "mock") {
    return "border-amber-200 bg-amber-50 text-pn-goldDark";
  }

  return "border-pn-border bg-pn-bg text-pn-muted";
}

function SetupPanel({ configured }: { configured: boolean }) {
  if (configured) {
    return null;
  }

  return (
    <section className="border-b border-pn-border bg-pn-bg px-6 py-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-lg border border-pn-border bg-pn-card p-4 text-sm text-pn-muted shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-semibold text-pn-text">PubNub keys are not configured.</p>
          <p>
            The interface is running with local demo history. Add browser-safe publish and
            subscribe keys to enable live messaging, history, and presence.
          </p>
        </div>
        <div className="grid gap-1 font-mono text-xs text-pn-muted sm:grid-cols-2">
          <span>NEXT_PUBLIC_PUBNUB_PUBLISH_KEY</span>
          <span>NEXT_PUBLIC_PUBNUB_SUBSCRIBE_KEY</span>
          <span>NEXT_PUBLIC_PUBNUB_USER_ID</span>
          <span>OPENAI_API_KEY optional</span>
        </div>
      </div>
    </section>
  );
}

function Header({
  selectedUserId,
  setSelectedUserId,
  connectionMode,
}: {
  selectedUserId: string;
  setSelectedUserId: (value: string) => void;
  connectionMode: string;
}) {
  const connectionLabel =
    connectionMode === "connected"
      ? "Live"
      : connectionMode === "connecting"
        ? "Connecting"
        : connectionMode === "issue"
          ? "Connection issue"
          : "Local preview";

  return (
    <header className="border-b border-pn-navyDark bg-pn-navy px-6 py-4 text-white shadow-[0_14px_36px_rgba(4,17,61,0.18)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-pn-navyDark">
              <Activity className="h-5 w-5 text-pn-gold" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-pn-gold">
                PubNub sales engineering POC
              </p>
              <h1 className="text-2xl font-semibold text-white">
                PulseOps AI Incident Command Center
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">
            <Radio className="h-4 w-4 text-pn-gold" aria-hidden="true" />
            {connectionLabel}
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-white/90">
            Acting as
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="rounded-lg border border-white/20 bg-white px-3 py-2 text-sm text-pn-text shadow-sm"
            >
              {demoUsers.map((user) => (
                <option key={user.uuid} value={user.uuid}>
                  {user.role}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}

function IncidentList({
  activeIncidentId,
  incidentStatuses,
  setActiveIncidentId,
}: {
  activeIncidentId: string;
  incidentStatuses: Record<string, IncidentStatus>;
  setActiveIncidentId: (value: string) => void;
}) {
  return (
    <aside className="border-r border-pn-border bg-pn-bg p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-pn-muted">
          Incidents
        </h2>
        <span className="rounded-full border border-pn-border bg-pn-card px-2 py-1 text-xs font-medium text-pn-muted">
          {incidents.length}
        </span>
      </div>

      <div className="space-y-3">
        {incidents.map((incident) => {
          const active = incident.id === activeIncidentId;
          const status = incidentStatuses[incident.id] ?? incident.status;

          return (
            <button
              key={incident.id}
              type="button"
              onClick={() => setActiveIncidentId(incident.id)}
              className={`w-full rounded-lg border p-4 text-left shadow-sm transition ${
                active
                  ? "border-pn-navyDark bg-pn-navyDark text-white shadow-[0_14px_28px_rgba(4,17,61,0.18)]"
                  : "border-pn-border bg-pn-card text-pn-text hover:border-cyan-200 hover:bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold leading-5">{incident.title}</p>
                  <p className={`mt-2 text-xs ${active ? "text-white/70" : "text-pn-muted"}`}>
                    {incident.customer}
                  </p>
                </div>
                <ChevronRight
                  className={`mt-1 h-4 w-4 shrink-0 ${active ? "text-pn-gold" : "text-pn-muted"}`}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span
                  className={`rounded-full px-2 py-1 ${
                    active ? "bg-white/10 text-white" : "bg-pn-bg text-pn-muted"
                  }`}
                >
                  {incident.severity}
                </span>
                <span
                  className={`rounded-full px-2 py-1 ${
                    active ? "bg-white/10 text-white" : "bg-pn-bg text-pn-muted"
                  }`}
                >
                  {status}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function IncidentHeader({
  incident,
  onStatusChange,
}: {
  incident: Incident;
  onStatusChange: (status: IncidentStatus) => void;
}) {
  return (
    <section className="border-b border-pn-border bg-pn-card p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-pn-muted">
            <span className="rounded-full border border-pn-border bg-pn-bg px-2 py-1">
              {incident.severity}
            </span>
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-pn-teal">
              {incident.status}
            </span>
            <span className="rounded-full border border-pn-border bg-pn-bg px-2 py-1">
              {incident.started}
            </span>
          </div>
          <h2 className="text-xl font-semibold text-pn-text">{incident.title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-pn-muted">{incident.description}</p>
          <div className="mt-4 grid gap-3 text-sm text-pn-muted sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-pn-muted">Customer</p>
              <p className="font-medium text-pn-text">{incident.customer}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-pn-muted">Started</p>
              <p className="font-medium text-pn-text">{incident.started}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-pn-muted">Channel</p>
              <p className="font-mono text-xs font-medium text-pn-teal">{incident.channel}</p>
            </div>
          </div>
        </div>

        <div className="min-w-[260px]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-pn-muted">
            Status controls
          </p>
          <div className="grid grid-cols-2 gap-2">
            {statusOptions.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onStatusChange(status)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  incident.status === status
                    ? "border-pn-navyDark bg-pn-navyDark text-white shadow-sm"
                    : "border-pn-border bg-pn-card text-pn-muted hover:border-cyan-200 hover:bg-cyan-50/50 hover:text-pn-teal"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MessageFeed({ messages }: { messages: IncidentMessage[] }) {
  return (
    <div className="flex-1 overflow-y-auto bg-pn-bg p-5">
      <div className="space-y-4">
        {messages.map((message) => {
          const ai = message.type.startsWith("ai_");
          const aiSource = ai ? getMessageAiSource(message) : null;

          return (
            <article
              key={message.id}
              className={`rounded-lg border p-4 shadow-sm ${messageStyle(message.type)}`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${
                      ai ? "bg-white text-pn-navyDark" : "bg-pn-navy text-white"
                    }`}
                  >
                    {message.senderName
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{message.senderName}</p>
                    <p className={`text-xs ${ai ? "text-white/70" : "text-pn-muted"}`}>
                      {message.senderRole}
                    </p>
                  </div>
                </div>
                <div
                  className={`flex items-center gap-2 text-xs ${ai ? "text-white/70" : "text-pn-muted"}`}
                >
                  <span
                    className={`rounded-full border px-2 py-0.5 font-medium ${audienceBadgeClass(
                      message.audience,
                      ai
                    )}`}
                  >
                    {audienceLabel(message.audience)}
                  </span>
                  <span>{messageLabel(message.type)}</span>
                  {aiSource ? <span>{aiSourceLabel(aiSource)}</span> : null}
                  <span>{formatTime(message.timestamp)}</span>
                </div>
              </div>
              <p className="whitespace-pre-line text-sm leading-6">{message.text}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Composer({
  onSend,
  onTyping,
  disabled,
  audience,
  canChooseAudience,
  onAudienceChange,
}: {
  onSend: (text: string, audience: MessageAudience) => Promise<void>;
  onTyping: (audience: MessageAudience, isTyping: boolean) => void;
  disabled: boolean;
  audience: MessageAudience;
  canChooseAudience: boolean;
  onAudienceChange: (audience: MessageAudience) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const lastTypingAt = useRef(0);
  const activeTypingAudience = useRef<MessageAudience | null>(null);

  const publishTyping = useCallback(
    (nextAudience: MessageAudience, isTyping: boolean, force = false) => {
      if (!isTyping) {
        const currentAudience = activeTypingAudience.current;
        if (currentAudience) {
          onTyping(currentAudience, false);
          activeTypingAudience.current = null;
        }
        lastTypingAt.current = 0;
        return;
      }

      const now = Date.now();
      if (!force && now - lastTypingAt.current < 1_500) {
        return;
      }

      if (
        activeTypingAudience.current &&
        activeTypingAudience.current !== nextAudience
      ) {
        onTyping(activeTypingAudience.current, false);
      }

      activeTypingAudience.current = nextAudience;
      lastTypingAt.current = now;
      onTyping(nextAudience, true);
    },
    [onTyping]
  );

  function updateText(value: string) {
    setText(value);

    if (value.trim()) {
      publishTyping(audience, true);
    } else {
      publishTyping(audience, false, true);
    }
  }

  function changeAudience(nextAudience: MessageAudience) {
    if (nextAudience === audience) {
      return;
    }

    publishTyping(audience, false, true);
    onAudienceChange(nextAudience);

    if (text.trim()) {
      activeTypingAudience.current = nextAudience;
      lastTypingAt.current = Date.now();
      onTyping(nextAudience, true);
    }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();

    const trimmed = text.trim();
    if (!trimmed || sending) {
      return;
    }

    setSending(true);
    try {
      publishTyping(audience, false, true);
      await onSend(trimmed, audience);
      setText("");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      void submit();
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-pn-border bg-pn-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {canChooseAudience ? (
          <div className="inline-flex rounded-lg border border-pn-border bg-pn-bg p-1">
            {(["internal", "customer"] as MessageAudience[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => changeAudience(item)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  audience === item
                    ? "bg-pn-navy text-white shadow-sm"
                    : "text-pn-muted hover:bg-white hover:text-pn-teal"
                }`}
              >
                {audienceComposerLabel(item)}
              </button>
            ))}
          </div>
        ) : (
          <span
            className={`rounded-full border px-2 py-1 text-xs font-medium ${audienceBadgeClass(
              audience
            )}`}
          >
            {audienceComposerLabel(audience)}
          </span>
        )}
        <span className="text-xs text-pn-muted">
          Publishing to {audienceLabel(audience).toLowerCase()} stream
        </span>
      </div>
      <div className="flex gap-3">
        <input
          value={text}
          onChange={(event) => updateText(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => publishTyping(audience, false, true)}
          disabled={disabled}
          placeholder="Send an incident update"
          className="min-w-0 flex-1 rounded-lg border border-pn-border bg-white px-4 py-3 text-sm text-pn-text shadow-sm placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={disabled || sending || !text.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-pn-navy px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-pn-navyDark disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Send
        </button>
      </div>
    </form>
  );
}

function PresencePanel({
  onlineCount,
  participants,
  notice,
}: {
  onlineCount: number;
  participants: Array<{
    uuid: string;
    displayName: string;
    role: string;
    initials: string;
    lastActivity?: string;
  }>;
  notice: string;
}) {
  return (
    <section className="border-b border-pn-border bg-pn-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-pn-teal" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-pn-text">Active participants</h2>
        </div>
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-medium text-pn-teal">
          {onlineCount} online
        </span>
      </div>
      <p className="mb-4 text-sm text-pn-muted">{notice}</p>
      <div className="space-y-3">
        {participants.length === 0 ? (
          <p className="rounded-lg border border-pn-border bg-pn-bg p-3 text-sm text-pn-muted">
            No live occupants reported yet.
          </p>
        ) : (
          participants.map((participant) => (
            <div key={participant.uuid} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pn-navy text-xs font-semibold text-white">
                {participant.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-pn-text">
                  {participant.displayName}
                </p>
                <p className="truncate text-xs text-pn-muted">{participant.role}</p>
              </div>
              <span className="text-right text-xs text-pn-muted">
                {formatRelative(participant.lastActivity)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ActivityIndicators({
  indicators,
  localAiAction,
}: {
  indicators: ActivityIndicator[];
  localAiAction: AiAction | null;
}) {
  const localIndicator = localAiAction
    ? ({
        id: `local-ai-${localAiAction}`,
        userId: aiUser.uuid,
        displayName: aiUser.displayName,
        role: aiUser.role,
        audience: localAiAction === "customer_update" ? "customer" : "internal",
        kind:
          localAiAction === "summary"
            ? "ai_summary"
            : localAiAction === "next_actions"
              ? "ai_next_actions"
              : "ai_customer_update",
        expiresAt: Date.now() + 1_000,
      } satisfies ActivityIndicator)
    : null;
  const visibleIndicators = localIndicator
    ? [localIndicator, ...indicators]
    : indicators;

  if (visibleIndicators.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-pn-border bg-pn-bg px-5 py-2">
      <div className="flex flex-wrap gap-2 text-xs text-pn-muted">
        {visibleIndicators.map((indicator) => (
          <span
            key={indicator.id}
            className="inline-flex items-center gap-2 rounded-full border border-pn-border bg-pn-card px-3 py-1"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-pn-teal" aria-hidden="true" />
            {activityText(indicator)}
          </span>
        ))}
      </div>
    </div>
  );
}

function AiPanel({
  incident,
  messages,
  latestAiSource,
  onPublishAi,
  onAiActivity,
}: {
  incident: Incident;
  messages: IncidentMessage[];
  latestAiSource: AiSource | null;
  onPublishAi: (message: IncidentMessage) => Promise<void>;
  onAiActivity: (
    action: AiAction,
    audience: MessageAudience,
    isActive: boolean
  ) => Promise<void>;
}) {
  const [loadingAction, setLoadingAction] = useState<AiAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerDraft, setCustomerDraft] = useState<{
    text: string;
    source: AiSource;
  } | null>(null);

  useEffect(() => {
    setCustomerDraft(null);
    setError(null);
  }, [incident.id]);

  async function runAiAction(action: AiAction, type: MessageType) {
    const audience: MessageAudience =
      action === "customer_update" ? "customer" : "internal";

    setLoadingAction(action);
    setError(null);
    await onAiActivity(action, audience, true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          incident,
          messages: messages.slice(-15),
        }),
      });

      if (!response.ok) {
        throw new Error("AI route returned an error.");
      }

      const result = (await response.json()) as AiResponse;
      const source =
        result.source === "openai" || result.source === "mock"
          ? result.source
          : result.usedMock
            ? "mock"
            : "openai";

      if (action === "customer_update") {
        setCustomerDraft({
          text: result.text,
          source,
        });
        return;
      }

      await onPublishAi({
        id: makeId("ai"),
        channel: incident.channel,
        audience,
        type,
        senderId: aiUser.uuid,
        senderName: aiUser.displayName,
        senderRole: aiUser.role,
        text: result.text,
        timestamp: new Date().toISOString(),
        metadata: {
          action,
          source,
          usedMock: source === "mock",
        },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI action failed.");
    } finally {
      await onAiActivity(action, audience, false);
      setLoadingAction(null);
    }
  }

  async function publishCustomerDraft() {
    if (!customerDraft) {
      return;
    }

    setError(null);

    try {
      await onPublishAi({
        id: makeId("ai"),
        channel: incident.channel,
        audience: "customer",
        type: "ai_customer_update",
        senderId: aiUser.uuid,
        senderName: aiUser.displayName,
        senderRole: aiUser.role,
        text: customerDraft.text,
        timestamp: new Date().toISOString(),
        metadata: {
          action: "customer_update",
          source: customerDraft.source,
          usedMock: customerDraft.source === "mock",
        },
      });
      setCustomerDraft(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI publish failed.");
    }
  }

  return (
    <section className="border-b border-pn-border bg-pn-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-pn-purple" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-pn-text">AI Assistant</h2>
        </div>
        <span
          className={`rounded-full border px-2 py-1 text-xs font-medium ${aiSourceBadgeClass(
            latestAiSource
          )}`}
        >
          {aiSourceLabel(latestAiSource)}
        </span>
      </div>
      <div className="space-y-2">
        {aiActions.map((item) => {
          const Icon = item.icon;
          const loading = loadingAction === item.action;

          return (
            <button
              key={item.action}
              type="button"
              onClick={() => void runAiAction(item.action, item.type)}
              disabled={Boolean(loadingAction)}
              className="flex w-full items-center justify-between rounded-lg border border-pn-border bg-pn-card px-3 py-3 text-left text-sm font-medium text-pn-text shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50/50 disabled:cursor-wait disabled:text-slate-400"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-pn-teal" aria-hidden="true" />
                {item.label}
              </span>
              <span className="text-xs text-pn-muted">
                {loading
                  ? "Working"
                  : item.action === "customer_update"
                    ? "Draft"
                    : "Publish"}
              </span>
            </button>
          );
        })}
      </div>
      {customerDraft ? (
        <div className="mt-4 rounded-lg border border-pn-border bg-pn-bg p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-pn-muted">
              Customer update draft
            </span>
            <span
              className={`rounded-full border px-2 py-1 text-xs font-medium ${aiSourceBadgeClass(
                customerDraft.source
              )}`}
            >
              {aiSourceLabel(customerDraft.source)}
            </span>
          </div>
          <p className="whitespace-pre-line text-sm leading-6 text-pn-text">
            {customerDraft.text}
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => void publishCustomerDraft()}
              className="rounded-lg bg-pn-navy px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-pn-navyDark"
            >
              Publish customer update
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-pn-red">{error}</p> : null}
    </section>
  );
}

function ArchitectureNotes() {
  return (
    <section className="bg-pn-card p-5">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-pn-text">
          Architecture Notes
          <ChevronRight
            className="h-4 w-4 text-pn-teal transition group-open:rotate-90"
            aria-hidden="true"
          />
        </summary>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-pn-muted">
          <li>Each incident uses separate internal and customer-visible PubNub channels.</li>
          <li>Internal participants subscribe to both channels; customer contacts subscribe only to customer-visible updates.</li>
          <li>Role separation is simulated in this POC and would be enforced with Access Manager in production.</li>
          <li>Presence shows active participants.</li>
          <li>Message Persistence can restore incident history.</li>
          <li>Typing indicators use ephemeral PubNub Signals and are not durable incident history.</li>
          <li>AI assistance is generated server-side; customer-visible AI updates are drafted for human review before publishing.</li>
          <li>In production, Access Manager would grant scoped read/write access by user, role, tenant, and incident.</li>
          <li>Sensitive actions would go through backend validation before publishing operational commands.</li>
          <li>This POC demonstrates the real-time workflow pattern, not a complete production auth model.</li>
        </ul>
      </details>
    </section>
  );
}

export function PulseOpsApp() {
  const [selectedUserId, setSelectedUserId] = useState(demoUsers[0].uuid);
  const [activeIncidentId, setActiveIncidentId] = useState(incidents[0].id);
  const [incidentStatuses, setIncidentStatuses] = useState<Record<string, IncidentStatus>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [composerAudience, setComposerAudience] =
    useState<MessageAudience>("internal");
  const [localAiActivity, setLocalAiActivity] = useState<AiAction | null>(null);

  const selectedUser = useMemo(
    () => demoUsers.find((user) => user.uuid === selectedUserId) ?? demoUsers[0],
    [selectedUserId]
  );

  const activeIncident = useMemo(() => {
    const incident = incidents.find((item) => item.id === activeIncidentId) ?? incidents[0];
    return {
      ...incident,
      status: incidentStatuses[incident.id] ?? incident.status,
    };
  }, [activeIncidentId, incidentStatuses]);

  const applyStatusFromChannel = useCallback(
    (status: IncidentStatus) => {
      setIncidentStatuses((current) => ({
        ...current,
        [activeIncidentId]: status,
      }));
    },
    [activeIncidentId]
  );

  const {
    messages,
    pubnubConfigured,
    connectionMode,
    historyMode,
    historyNotice,
    presenceNotice,
    participants,
    onlineCount,
    lastError,
    activityIndicators,
    publishIncidentMessage,
    publishTypingSignal,
    publishAiActivitySignal,
  } = useIncidentPubNub({
    incident: activeIncident,
    selectedUser,
    onStatusChange: applyStatusFromChannel,
  });

  const canChooseAudience = canSelectAudience(selectedUser);
  const activeComposerAudience = canChooseAudience ? composerAudience : "customer";

  useEffect(() => {
    setComposerAudience(defaultAudienceForUser(selectedUser));
  }, [selectedUser]);

  const latestAiSource = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].type.startsWith("ai_")) {
        return getMessageAiSource(messages[index]);
      }
    }

    return null;
  }, [messages]);

  function handleTyping(audience: MessageAudience, isTyping: boolean) {
    void publishTypingSignal(audience, isTyping);
  }

  async function sendMessage(text: string, audience: MessageAudience) {
    setActionError(null);
    try {
      await publishIncidentMessage(
        buildUserMessage(activeIncident, selectedUser, text, audience)
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Message publish failed.");
    }
  }

  async function changeStatus(status: IncidentStatus) {
    setIncidentStatuses((current) => ({
      ...current,
      [activeIncident.id]: status,
    }));
    setActionError(null);

    try {
      await publishIncidentMessage(buildStatusMessage(activeIncident, selectedUser, status));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Status publish failed.");
    }
  }

  async function publishAiMessage(message: IncidentMessage) {
    setActionError(null);
    try {
      await publishIncidentMessage(message);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "AI publish failed.");
    }
  }

  async function handleAiActivity(
    action: AiAction,
    audience: MessageAudience,
    isActive: boolean
  ) {
    setLocalAiActivity(isActive ? action : null);
    await publishAiActivitySignal(action, audience, isActive);
  }

  return (
    <main className="min-h-screen bg-pn-bg">
      <Header
        selectedUserId={selectedUserId}
        setSelectedUserId={setSelectedUserId}
        connectionMode={connectionMode}
      />
      <SetupPanel configured={pubnubConfigured} />

      <div className="mx-auto grid max-w-7xl grid-cols-1 border-x border-pn-border bg-pn-card shadow-[0_18px_48px_rgba(6,27,90,0.08)] lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <IncidentList
          activeIncidentId={activeIncident.id}
          incidentStatuses={incidentStatuses}
          setActiveIncidentId={setActiveIncidentId}
        />

        <section className="flex min-h-[760px] min-w-0 flex-col bg-pn-bg">
          <IncidentHeader incident={activeIncident} onStatusChange={changeStatus} />

          <div className="border-b border-pn-border bg-pn-bg px-5 py-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-pn-muted">
              <span className="inline-flex items-center gap-1 rounded-full border border-pn-border bg-pn-card px-2 py-1 font-medium text-pn-teal">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                {historyMode === "live" ? "Live history" : "Demo history"}
              </span>
              <span>{historyNotice}</span>
            </div>
            {actionError || lastError ? (
              <p className="mt-2 text-xs text-pn-red">{actionError ?? lastError}</p>
            ) : null}
          </div>

          <MessageFeed messages={messages} />
          <ActivityIndicators
            indicators={activityIndicators}
            localAiAction={localAiActivity}
          />
          <Composer
            onSend={sendMessage}
            onTyping={handleTyping}
            disabled={false}
            audience={activeComposerAudience}
            canChooseAudience={canChooseAudience}
            onAudienceChange={setComposerAudience}
          />
        </section>

        <aside className="border-l border-pn-border bg-pn-card">
          <PresencePanel
            onlineCount={onlineCount}
            participants={participants}
            notice={presenceNotice}
          />
          <AiPanel
            incident={activeIncident}
            messages={messages}
            latestAiSource={latestAiSource}
            onPublishAi={publishAiMessage}
            onAiActivity={handleAiActivity}
          />
          <section className="border-b border-pn-border bg-pn-card p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-pn-teal" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-pn-text">Production posture</h2>
                <p className="mt-2 text-sm leading-6 text-pn-muted">
                  Browser code uses only publish and subscribe keys. Secret keys and
                  Access Manager grants belong on a trusted backend.
                </p>
              </div>
            </div>
          </section>
          <ArchitectureNotes />
        </aside>
      </div>

      <footer className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 text-xs text-pn-muted">
        <span>
          Demo channel: {activeIncident.channel}
          <span className="ml-3">Run: {demoRunId || "default"}</span>
        </span>
        <span className="inline-flex items-center gap-1 text-pn-teal">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Latest AI source: {aiSourceLabel(latestAiSource)}
        </span>
      </footer>
    </main>
  );
}
