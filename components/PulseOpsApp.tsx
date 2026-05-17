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
import { FormEvent, KeyboardEvent, useCallback, useMemo, useState } from "react";
import { aiUser, demoRunId, demoUsers, incidents } from "@/lib/data";
import { formatRelative, formatTime, makeId } from "@/lib/format";
import type {
  AiAction,
  AiResponse,
  AiSource,
  DemoUser,
  Incident,
  IncidentMessage,
  IncidentStatus,
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
  text: string
): IncidentMessage {
  return {
    id: makeId("msg"),
    channel: incident.channel,
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
    type: "status_change",
    senderId: user.uuid,
    senderName: user.displayName,
    senderRole: user.role,
    text: `${user.displayName} changed incident status to ${status}.`,
    timestamp: new Date().toISOString(),
    metadata: { status },
  };
}

function messageStyle(type: MessageType) {
  if (type.startsWith("ai_")) {
    return "border-slate-800 bg-slate-900 text-white";
  }

  if (type === "system_event" || type === "status_change") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  return "border-slate-200 bg-white text-slate-950";
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
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (source === "mock") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-500";
}

function SetupPanel({ configured }: { configured: boolean }) {
  if (configured) {
    return null;
  }

  return (
    <section className="border-b border-slate-200 bg-white px-6 py-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-semibold text-slate-950">PubNub keys are not configured.</p>
          <p>
            The interface is running with local demo history. Add browser-safe publish and
            subscribe keys to enable live messaging, history, and presence.
          </p>
        </div>
        <div className="grid gap-1 font-mono text-xs text-slate-600 sm:grid-cols-2">
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
    <header className="border-b border-slate-200 bg-white px-6 py-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
              <Activity className="h-5 w-5 text-slate-700" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                PubNub sales engineering POC
              </p>
              <h1 className="text-2xl font-semibold text-slate-950">
                PulseOps AI Incident Command Center
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <Radio className="h-4 w-4" aria-hidden="true" />
            {connectionLabel}
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            Acting as
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"
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
    <aside className="border-r border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Incidents
        </h2>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
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
              className={`w-full rounded-lg border p-4 text-left transition ${
                active
                  ? "border-slate-900 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-950 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold leading-5">{incident.title}</p>
                  <p className={`mt-2 text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
                    {incident.customer}
                  </p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span
                  className={`rounded-full px-2 py-1 ${
                    active ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {incident.severity}
                </span>
                <span
                  className={`rounded-full px-2 py-1 ${
                    active ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"
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
    <section className="border-b border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
            <span className="rounded-full bg-slate-100 px-2 py-1">{incident.severity}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1">{incident.status}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1">{incident.started}</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-950">{incident.title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{incident.description}</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Customer</p>
              <p className="font-medium text-slate-950">{incident.customer}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Started</p>
              <p className="font-medium text-slate-950">{incident.started}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Channel</p>
              <p className="font-mono text-xs font-medium text-slate-950">{incident.channel}</p>
            </div>
          </div>
        </div>

        <div className="min-w-[260px]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
    <div className="flex-1 overflow-y-auto p-5">
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
                      ai ? "bg-white text-slate-900" : "bg-slate-900 text-white"
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
                    <p className={`text-xs ${ai ? "text-slate-300" : "text-slate-500"}`}>
                      {message.senderRole}
                    </p>
                  </div>
                </div>
                <div
                  className={`flex items-center gap-2 text-xs ${ai ? "text-slate-300" : "text-slate-500"}`}
                >
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
  disabled,
}: {
  onSend: (text: string) => Promise<void>;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event?: FormEvent) {
    event?.preventDefault();

    const trimmed = text.trim();
    if (!trimmed || sending) {
      return;
    }

    setSending(true);
    try {
      await onSend(trimmed);
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
    <form onSubmit={submit} className="border-t border-slate-200 bg-white p-4">
      <div className="flex gap-3">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Send an incident update"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={disabled || sending || !text.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
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
    <section className="border-b border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-950">Active participants</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
          {onlineCount} online
        </span>
      </div>
      <p className="mb-4 text-sm text-slate-600">{notice}</p>
      <div className="space-y-3">
        {participants.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            No live occupants reported yet.
          </p>
        ) : (
          participants.map((participant) => (
            <div key={participant.uuid} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {participant.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-950">
                  {participant.displayName}
                </p>
                <p className="truncate text-xs text-slate-500">{participant.role}</p>
              </div>
              <span className="text-right text-xs text-slate-500">
                {formatRelative(participant.lastActivity)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function AiPanel({
  incident,
  messages,
  latestAiSource,
  onPublishAi,
}: {
  incident: Incident;
  messages: IncidentMessage[];
  latestAiSource: AiSource | null;
  onPublishAi: (message: IncidentMessage) => Promise<void>;
}) {
  const [loadingAction, setLoadingAction] = useState<AiAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAiAction(action: AiAction, type: MessageType) {
    setLoadingAction(action);
    setError(null);

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

      await onPublishAi({
        id: makeId("ai"),
        channel: incident.channel,
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
      setLoadingAction(null);
    }
  }

  return (
    <section className="border-b border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-950">AI Assistant</h2>
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
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-wait disabled:text-slate-400"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </span>
              <span className="text-xs text-slate-500">{loading ? "Working" : "Publish"}</span>
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}

function ArchitectureNotes() {
  return (
    <section className="bg-white p-5">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-950">
          Architecture Notes
          <ChevronRight className="h-4 w-4 transition group-open:rotate-90" aria-hidden="true" />
        </summary>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
          <li>Each incident maps to a PubNub channel.</li>
          <li>PubNub handles real-time fanout to subscribed clients.</li>
          <li>Presence shows active participants.</li>
          <li>Message Persistence can restore incident history.</li>
          <li>AI assistance is generated server-side and then published back into the incident channel.</li>
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
    publishIncidentMessage,
  } = useIncidentPubNub({
    incident: activeIncident,
    selectedUser,
    onStatusChange: applyStatusFromChannel,
  });

  const latestAiSource = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].type.startsWith("ai_")) {
        return getMessageAiSource(messages[index]);
      }
    }

    return null;
  }, [messages]);

  async function sendMessage(text: string) {
    setActionError(null);
    try {
      await publishIncidentMessage(buildUserMessage(activeIncident, selectedUser, text));
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

  return (
    <main className="min-h-screen bg-slate-50">
      <Header
        selectedUserId={selectedUserId}
        setSelectedUserId={setSelectedUserId}
        connectionMode={connectionMode}
      />
      <SetupPanel configured={pubnubConfigured} />

      <div className="mx-auto grid max-w-7xl grid-cols-1 border-x border-slate-200 bg-white lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <IncidentList
          activeIncidentId={activeIncident.id}
          incidentStatuses={incidentStatuses}
          setActiveIncidentId={setActiveIncidentId}
        />

        <section className="flex min-h-[760px] min-w-0 flex-col bg-slate-50">
          <IncidentHeader incident={activeIncident} onStatusChange={changeStatus} />

          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-medium">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                {historyMode === "live" ? "Live history" : "Demo history"}
              </span>
              <span>{historyNotice}</span>
            </div>
            {actionError || lastError ? (
              <p className="mt-2 text-xs text-red-600">{actionError ?? lastError}</p>
            ) : null}
          </div>

          <MessageFeed messages={messages} />
          <Composer onSend={sendMessage} disabled={false} />
        </section>

        <aside className="border-l border-slate-200 bg-white">
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
          />
          <section className="border-b border-slate-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-slate-500" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-slate-950">Production posture</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Browser code uses only publish and subscribe keys. Secret keys and
                  Access Manager grants belong on a trusted backend.
                </p>
              </div>
            </div>
          </section>
          <ArchitectureNotes />
        </aside>
      </div>

      <footer className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 text-xs text-slate-500">
        <span>
          Demo channel: {activeIncident.channel}
          <span className="ml-3">Run: {demoRunId || "default"}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Latest AI source: {aiSourceLabel(latestAiSource)}
        </span>
      </footer>
    </main>
  );
}
