"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PubNub from "pubnub";
import {
  aiUser,
  demoUsers,
  getAudienceChannel,
  getAudienceFromChannel,
  getSeedMessages,
} from "@/lib/data";
import { makeId } from "@/lib/format";
import type {
  ActivityIndicator,
  ActivityKind,
  AiAction,
  DemoUser,
  Incident,
  IncidentMessage,
  IncidentStatus,
  MessageAudience,
  MessageType,
  PresenceParticipant,
  UserRole,
} from "@/lib/types";

type PresenceMode = "live" | "fallback" | "not_configured";
type HistoryMode = "loading" | "live" | "seed" | "not_configured";
type ConnectionMode = "not_configured" | "connecting" | "connected" | "issue";

type UseIncidentPubNubArgs = {
  incident: Incident;
  selectedUser: DemoUser;
  onStatusChange?: (status: IncidentStatus) => void;
};

type PubNubMessageEnvelope = {
  channel?: string;
  message?: unknown;
  timetoken?: string | number;
  publisher?: string;
};

type PubNubSignalEnvelope = {
  channel?: string;
  message?: unknown;
  publisher?: string;
};

type PubNubPresenceEnvelope = {
  action?: string;
  uuid?: string;
  occupancy?: number;
  timestamp?: number;
  state?: Record<string, unknown>;
};

type SignalAudienceCode = "i" | "c";
type SignalActionCode = "s" | "n" | "u";

type SignalPayload = {
  t: "t" | "a" | "c";
  u: string;
  a: SignalAudienceCode;
  k?: SignalActionCode;
};

const publishKey = process.env.NEXT_PUBLIC_PUBNUB_PUBLISH_KEY ?? "";
const subscribeKey = process.env.NEXT_PUBLIC_PUBNUB_SUBSCRIBE_KEY ?? "";

const requiredKeysConfigured = Boolean(publishKey && subscribeKey);
const activityTtlMs = 4_000;

const messageTypes: MessageType[] = [
  "user_message",
  "system_event",
  "ai_summary",
  "ai_next_actions",
  "ai_customer_update",
  "status_change",
];

function isMessageType(value: unknown): value is MessageType {
  return typeof value === "string" && messageTypes.includes(value as MessageType);
}

function isMessageAudience(value: unknown): value is MessageAudience {
  return value === "internal" || value === "customer";
}

function isIncidentStatus(value: unknown): value is IncidentStatus {
  return (
    value === "Investigating" ||
    value === "Identified" ||
    value === "Mitigating" ||
    value === "Resolved"
  );
}

function visibleAudiencesFor(user: DemoUser): MessageAudience[] {
  return user.role === "Customer Contact" ? ["customer"] : ["internal", "customer"];
}

function historyLabel(audiences: MessageAudience[]) {
  return audiences.length > 1
    ? "internal and customer-visible history"
    : "customer-visible history";
}

function timetokenToIso(timetoken: unknown) {
  if (typeof timetoken !== "string" && typeof timetoken !== "number") {
    return new Date().toISOString();
  }

  try {
    const ms = Number(BigInt(String(timetoken)) / 10_000n);
    return new Date(ms).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function normalizeMessage(
  payload: unknown,
  channel: string,
  timetoken?: string | number,
  publisher?: string
): IncidentMessage | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<IncidentMessage>;
  const audience = isMessageAudience(candidate.audience)
    ? candidate.audience
    : getAudienceFromChannel(channel);

  if (!audience) {
    return null;
  }

  if (!candidate.text || typeof candidate.text !== "string") {
    return null;
  }

  if (!isMessageType(candidate.type)) {
    return null;
  }

  return {
    id:
      typeof candidate.id === "string" && candidate.id
        ? candidate.id
        : makeId("pn-message"),
    channel:
      typeof candidate.channel === "string" && candidate.channel
        ? candidate.channel
        : channel,
    audience,
    type: candidate.type,
    senderId:
      typeof candidate.senderId === "string" && candidate.senderId
        ? candidate.senderId
        : publisher ?? "unknown",
    senderName:
      typeof candidate.senderName === "string" && candidate.senderName
        ? candidate.senderName
        : publisher ?? "Unknown",
    senderRole:
      typeof candidate.senderRole === "string"
        ? (candidate.senderRole as UserRole)
        : "Support Engineer",
    text: candidate.text,
    timestamp:
      typeof candidate.timestamp === "string" && candidate.timestamp
        ? candidate.timestamp
        : timetokenToIso(timetoken),
    metadata:
      candidate.metadata && typeof candidate.metadata === "object"
        ? candidate.metadata
        : undefined,
  };
}

function knownUserForUuid(uuid: string, state?: Record<string, unknown>) {
  const known = demoUsers.find((user) => user.uuid === uuid);

  return {
    uuid,
    displayName:
      typeof state?.displayName === "string"
        ? state.displayName
        : known?.displayName ?? uuid,
    role:
      typeof state?.role === "string"
        ? (state.role as UserRole)
        : known?.role ?? "Support Engineer",
    initials:
      typeof state?.initials === "string"
        ? state.initials
        : known?.initials ?? uuid.slice(0, 2).toUpperCase(),
    lastActivity:
      typeof state?.lastActivity === "string" ? state.lastActivity : undefined,
  } satisfies PresenceParticipant;
}

function stateRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function sortMessages(messages: IncidentMessage[]) {
  return [...messages].sort(
    (left, right) =>
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  );
}

function dedupeParticipants(participants: PresenceParticipant[]) {
  return [...new Map(participants.map((participant) => [participant.uuid, participant])).values()];
}

function activityKindForAction(action: AiAction): ActivityKind {
  if (action === "summary") return "ai_summary";
  if (action === "next_actions") return "ai_next_actions";
  return "ai_customer_update";
}

function actionSignalCode(action: AiAction): SignalActionCode {
  if (action === "summary") return "s";
  if (action === "next_actions") return "n";
  return "u";
}

function activityKindFromCode(code?: SignalActionCode): ActivityKind | null {
  if (code === "s") return "ai_summary";
  if (code === "n") return "ai_next_actions";
  if (code === "u") return "ai_customer_update";
  return null;
}

function audienceCode(audience: MessageAudience): SignalAudienceCode {
  return audience === "internal" ? "i" : "c";
}

function audienceFromCode(code?: SignalAudienceCode): MessageAudience | null {
  if (code === "i") return "internal";
  if (code === "c") return "customer";
  return null;
}

function encodeSignalPayload(payload: SignalPayload) {
  return [payload.t, payload.u, payload.a, payload.k ?? ""].join("|");
}

function parseSignalPayload(message: unknown): SignalPayload | null {
  if (typeof message !== "string") {
    return null;
  }

  const [type, userId, audience, kind] = message.split("|");

  if (type !== "t" && type !== "a" && type !== "c") {
    return null;
  }

  if (!userId || (audience !== "i" && audience !== "c")) {
    return null;
  }

  if (kind && kind !== "s" && kind !== "n" && kind !== "u") {
    return null;
  }

  return {
    t: type,
    u: userId,
    a: audience,
    k: kind ? (kind as SignalActionCode) : undefined,
  };
}

export function useIncidentPubNub({
  incident,
  selectedUser,
  onStatusChange,
}: UseIncidentPubNubArgs) {
  const visibleAudiences = useMemo(
    () => visibleAudiencesFor(selectedUser),
    [selectedUser]
  );
  const visibleChannels = useMemo(
    () =>
      visibleAudiences.map((audience) =>
        getAudienceChannel(incident.channel, audience)
      ),
    [incident.channel, visibleAudiences]
  );
  const visibleChannelKey = visibleChannels.join("|");

  const [messages, setMessages] = useState<IncidentMessage[]>(() =>
    getSeedMessages(incident.channel, visibleAudiences)
  );
  const [historyMode, setHistoryMode] = useState<HistoryMode>(
    requiredKeysConfigured ? "loading" : "not_configured"
  );
  const [historyNotice, setHistoryNotice] = useState(
    requiredKeysConfigured
      ? `Checking PubNub Message Persistence for ${historyLabel(visibleAudiences)}.`
      : "Demo seed history is shown until PubNub publish and subscribe keys are configured."
  );
  const [presenceMode, setPresenceMode] = useState<PresenceMode>(
    requiredKeysConfigured ? "fallback" : "not_configured"
  );
  const [presenceNotice, setPresenceNotice] = useState(
    requiredKeysConfigured
      ? "Presence is connecting."
      : "Presence requires PubNub keys. The app is running in local preview mode."
  );
  const [presenceParticipants, setPresenceParticipants] = useState<
    PresenceParticipant[]
  >([]);
  const [lastActivityByUser, setLastActivityByUser] = useState<
    Record<string, string>
  >({});
  const [activityIndicators, setActivityIndicators] = useState<ActivityIndicator[]>(
    []
  );
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(
    requiredKeysConfigured ? "connecting" : "not_configured"
  );
  const [lastError, setLastError] = useState<string | null>(null);

  const pubnub = useMemo(() => {
    if (!requiredKeysConfigured) {
      return null;
    }

    return new PubNub({
      publishKey,
      subscribeKey,
      userId: selectedUser.uuid,
      ssl: true,
      enableEventEngine: true,
      presenceTimeout: 60,
      heartbeatInterval: 20,
    });
  }, [selectedUser.uuid]);

  const appendMessage = useCallback((message: IncidentMessage) => {
    setMessages((current) => {
      if (
        current.some(
          (item) => item.id === message.id && item.channel === message.channel
        )
      ) {
        return current;
      }

      return sortMessages([...current, message]);
    });

    setLastActivityByUser((current) => ({
      ...current,
      [message.senderId]: message.timestamp,
    }));
  }, []);

  const upsertActivity = useCallback((indicator: ActivityIndicator) => {
    setActivityIndicators((current) => {
      const next = current.filter((item) => item.id !== indicator.id);
      return [...next, indicator];
    });
  }, []);

  const removeActivity = useCallback((id: string) => {
    setActivityIndicators((current) => current.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();
      setActivityIndicators((current) =>
        current.filter((indicator) => indicator.expiresAt > now)
      );
    }, 1_000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    return () => {
      if (pubnub) {
        pubnub.unsubscribeAll();
        pubnub.destroy(true);
      }
    };
  }, [pubnub]);

  useEffect(() => {
    setMessages(getSeedMessages(incident.channel, visibleAudiences));
    setHistoryMode(requiredKeysConfigured ? "loading" : "not_configured");
    setHistoryNotice(
      requiredKeysConfigured
        ? `Checking PubNub Message Persistence for ${historyLabel(visibleAudiences)}.`
        : "Demo seed history is shown until PubNub publish and subscribe keys are configured."
    );
    setPresenceParticipants([]);
    setActivityIndicators([]);
    setPresenceMode(requiredKeysConfigured ? "fallback" : "not_configured");
    setPresenceNotice(
      requiredKeysConfigured
        ? "Presence is connecting."
        : "Presence requires PubNub keys. The app is running in local preview mode."
    );
    setConnectionMode(requiredKeysConfigured ? "connecting" : "not_configured");
    setLastError(null);
  }, [incident.channel, visibleAudiences]);

  useEffect(() => {
    if (!pubnub) {
      return;
    }

    const client = pubnub;
    let cancelled = false;

    async function loadHistory() {
      try {
        const result = await client.fetchMessages({
          channels: visibleChannels,
          count: 50,
          includeUUID: true,
          includeMeta: true,
          includeCustomMessageType: true,
        });

        if (cancelled) {
          return;
        }

        const historyMessages = visibleChannels.flatMap(
          (channel) =>
            result.channels?.[channel]
              ?.map((entry) =>
                normalizeMessage(entry.message, channel, entry.timetoken, entry.uuid)
              )
              .filter((message): message is IncidentMessage => Boolean(message)) ??
            []
        );

        if (historyMessages.length > 0) {
          setMessages(sortMessages(historyMessages));
          setHistoryMode("live");
          setHistoryNotice(
            `Showing ${historyLabel(visibleAudiences)} restored from PubNub Message Persistence.`
          );
        } else {
          setHistoryMode("seed");
          setHistoryNotice(
            `No stored ${historyLabel(visibleAudiences)} was returned, so demo seed history is shown until live events arrive.`
          );
        }
      } catch (error) {
        if (!cancelled) {
          setHistoryMode("seed");
          setHistoryNotice(
            "Message Persistence requires the PubNub Message Persistence add-on. Demo seed history is shown instead."
          );
          setLastError(error instanceof Error ? error.message : "History unavailable.");
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [pubnub, visibleAudiences, visibleChannelKey, visibleChannels]);

  useEffect(() => {
    if (!pubnub) {
      return;
    }

    const client = pubnub;
    const subscription = client.subscriptionSet({
      channels: visibleChannels,
      subscriptionOptions: { receivePresenceEvents: true },
    });

    subscription.addListener({
      message: (event: PubNubMessageEnvelope) => {
        const nextMessage = normalizeMessage(
          event.message,
          event.channel ?? visibleChannels[0],
          event.timetoken,
          event.publisher
        );

        if (!nextMessage) {
          return;
        }

        appendMessage(nextMessage);

        if (
          nextMessage.type === "status_change" &&
          isIncidentStatus(nextMessage.metadata?.status)
        ) {
          onStatusChange?.(nextMessage.metadata.status);
        }
      },
      signal: (event: PubNubSignalEnvelope) => {
        const payload = parseSignalPayload(event.message);

        if (!payload || payload.u === selectedUser.uuid) {
          return;
        }

        const audience =
          audienceFromCode(payload.a) ??
          getAudienceFromChannel(event.channel ?? "") ??
          "customer";
        const known = knownUserForUuid(payload.u);
        const kind = payload.k ? activityKindFromCode(payload.k) : "typing";

        if (!kind) {
          return;
        }

        const id = `${payload.u}-${kind}-${audience}`;

        if (payload.t === "c") {
          removeActivity(id);
          return;
        }

        upsertActivity({
          id,
          userId: payload.u,
          displayName: known.displayName,
          role: known.role,
          audience,
          kind,
          expiresAt: Date.now() + activityTtlMs,
        });
      },
      presence: (event: PubNubPresenceEnvelope) => {
        if (event.action === "interval" && typeof event.occupancy === "number") {
          setPresenceMode("live");
          setPresenceNotice(`Live presence is active with ${event.occupancy} participant(s).`);
          return;
        }

        const uuid = event.uuid;

        if (!uuid) {
          return;
        }

        setPresenceMode("live");
        setPresenceNotice("Live presence is active for the visible incident channels.");
        setPresenceParticipants((current) => {
          const next = new Map(current.map((participant) => [participant.uuid, participant]));

          if (event.action === "leave" || event.action === "timeout") {
            next.delete(uuid);
          } else {
            next.set(uuid, knownUserForUuid(uuid, stateRecord(event.state)));
          }

          return [...next.values()];
        });
      },
    });

    const statusListener = {
      status: (status: { category?: string }) => {
        if (status.category === "PNConnectedCategory") {
          setConnectionMode("connected");
          setLastError(null);
        }

        if (
          status.category === "PNNetworkIssuesCategory" ||
          status.category === "PNNetworkDownCategory" ||
          status.category === "PNAccessDeniedCategory"
        ) {
          setConnectionMode("issue");
          setLastError(status.category);
        }
      },
    };

    client.addListener(statusListener);

    subscription.subscribe();

    async function refreshPresence() {
      try {
        await client.setState({
          channels: visibleChannels,
          state: {
            displayName: selectedUser.displayName,
            role: selectedUser.role,
            initials: selectedUser.initials,
            lastActivity: new Date().toISOString(),
          },
        });

        const result = await client.hereNow({
          channels: visibleChannels,
          includeUUIDs: true,
          includeState: true,
        });

        const occupants = visibleChannels.flatMap(
          (channel) => result.channels?.[channel]?.occupants ?? []
        );

        setPresenceParticipants(
          dedupeParticipants(
            occupants.map((occupant) =>
              knownUserForUuid(String(occupant.uuid), stateRecord(occupant.state))
            )
          )
        );
        setPresenceMode("live");
        setPresenceNotice("Live presence is active for the visible incident channels.");
      } catch (error) {
        setPresenceMode("fallback");
        setPresenceNotice(
          "Presence requires the PubNub Presence add-on. The app is running without live presence."
        );
        setLastError(error instanceof Error ? error.message : "Presence unavailable.");
      }
    }

    void refreshPresence();

    return () => {
      subscription.unsubscribe();
      client.removeListener(statusListener);
    };
  }, [
    appendMessage,
    onStatusChange,
    pubnub,
    removeActivity,
    selectedUser,
    upsertActivity,
    visibleChannelKey,
    visibleChannels,
  ]);

  const publishIncidentMessage = useCallback(
    async (message: IncidentMessage) => {
      const channel = getAudienceChannel(incident.channel, message.audience);
      const nextMessage = { ...message, channel };

      if (!pubnub) {
        appendMessage(nextMessage);
        return;
      }

      await pubnub.publish({
        channel,
        message: nextMessage,
        storeInHistory: true,
        sendByPost: true,
        meta: {
          senderId: nextMessage.senderId,
          type: nextMessage.type,
          audience: nextMessage.audience,
        },
        customMessageType: nextMessage.type,
      });
    },
    [appendMessage, incident.channel, pubnub]
  );

  const publishTypingSignal = useCallback(
    async (audience: MessageAudience, isTyping: boolean) => {
      if (!pubnub) {
        return;
      }

      try {
        await pubnub.signal({
          channel: getAudienceChannel(incident.channel, audience),
          message: encodeSignalPayload({
            t: isTyping ? "t" : "c",
            u: selectedUser.uuid,
            a: audienceCode(audience),
          }),
          customMessageType: "typing",
        });
      } catch (error) {
        setLastError(error instanceof Error ? error.message : "Typing signal failed.");
      }
    },
    [incident.channel, pubnub, selectedUser.uuid]
  );

  const publishAiActivitySignal = useCallback(
    async (action: AiAction, audience: MessageAudience, isActive: boolean) => {
      if (!pubnub) {
        return;
      }

      try {
        await pubnub.signal({
          channel: getAudienceChannel(incident.channel, audience),
          message: encodeSignalPayload({
            t: isActive ? "a" : "c",
            u: aiUser.uuid,
            a: audienceCode(audience),
            k: actionSignalCode(action),
          }),
          customMessageType: "activity",
        });
      } catch (error) {
        setLastError(error instanceof Error ? error.message : "AI activity signal failed.");
      }
    },
    [incident.channel, pubnub]
  );

  const participants = useMemo(() => {
    if (!requiredKeysConfigured) {
      return [
        {
          ...selectedUser,
          lastActivity: lastActivityByUser[selectedUser.uuid] ?? new Date().toISOString(),
        },
      ];
    }

    return presenceParticipants.map((participant) => ({
      ...participant,
      lastActivity: lastActivityByUser[participant.uuid] ?? participant.lastActivity,
    }));
  }, [lastActivityByUser, presenceParticipants, selectedUser]);

  return {
    messages,
    appendMessage,
    publishIncidentMessage,
    publishTypingSignal,
    publishAiActivitySignal,
    activityIndicators,
    visibleAudiences,
    pubnubConfigured: requiredKeysConfigured,
    connectionMode,
    historyMode,
    historyNotice,
    presenceMode,
    presenceNotice,
    participants,
    onlineCount: participants.length,
    lastError,
  };
}
