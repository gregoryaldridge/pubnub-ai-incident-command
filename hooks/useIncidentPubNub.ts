"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PubNub from "pubnub";
import { demoUsers, getSeedMessages } from "@/lib/data";
import { makeId } from "@/lib/format";
import type {
  DemoUser,
  Incident,
  IncidentMessage,
  IncidentStatus,
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

type PubNubPresenceEnvelope = {
  action?: string;
  uuid?: string;
  occupancy?: number;
  timestamp?: number;
  state?: Record<string, unknown>;
};

const publishKey = process.env.NEXT_PUBLIC_PUBNUB_PUBLISH_KEY ?? "";
const subscribeKey = process.env.NEXT_PUBLIC_PUBNUB_SUBSCRIBE_KEY ?? "";

const requiredKeysConfigured = Boolean(publishKey && subscribeKey);

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

function isIncidentStatus(value: unknown): value is IncidentStatus {
  return (
    value === "Investigating" ||
    value === "Identified" ||
    value === "Mitigating" ||
    value === "Resolved"
  );
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

export function useIncidentPubNub({
  incident,
  selectedUser,
  onStatusChange,
}: UseIncidentPubNubArgs) {
  const [messages, setMessages] = useState<IncidentMessage[]>(() =>
    getSeedMessages(incident.channel)
  );
  const [historyMode, setHistoryMode] = useState<HistoryMode>(
    requiredKeysConfigured ? "loading" : "not_configured"
  );
  const [historyNotice, setHistoryNotice] = useState(
    requiredKeysConfigured
      ? "Checking PubNub Message Persistence for incident history."
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
      if (current.some((item) => item.id === message.id)) {
        return current;
      }

      return sortMessages([...current, message]);
    });

    setLastActivityByUser((current) => ({
      ...current,
      [message.senderId]: message.timestamp,
    }));
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
    setMessages(getSeedMessages(incident.channel));
    setHistoryMode(requiredKeysConfigured ? "loading" : "not_configured");
    setHistoryNotice(
      requiredKeysConfigured
        ? "Checking PubNub Message Persistence for incident history."
        : "Demo seed history is shown until PubNub publish and subscribe keys are configured."
    );
    setPresenceParticipants([]);
    setPresenceMode(requiredKeysConfigured ? "fallback" : "not_configured");
    setPresenceNotice(
      requiredKeysConfigured
        ? "Presence is connecting."
        : "Presence requires PubNub keys. The app is running in local preview mode."
    );
    setConnectionMode(requiredKeysConfigured ? "connecting" : "not_configured");
    setLastError(null);
  }, [incident.channel]);

  useEffect(() => {
    if (!pubnub) {
      return;
    }

    const client = pubnub;
    let cancelled = false;

    async function loadHistory() {
      try {
        const result = await client.fetchMessages({
          channels: [incident.channel],
          count: 50,
          includeUUID: true,
          includeMeta: true,
          includeCustomMessageType: true,
        });

        if (cancelled) {
          return;
        }

        const historyMessages =
          result.channels?.[incident.channel]
            ?.map((entry) =>
              normalizeMessage(
                entry.message,
                incident.channel,
                entry.timetoken,
                entry.uuid
              )
            )
            .filter((message): message is IncidentMessage => Boolean(message)) ??
          [];

        if (historyMessages.length > 0) {
          setMessages(sortMessages(historyMessages));
          setHistoryMode("live");
          setHistoryNotice("Showing history restored from PubNub Message Persistence.");
        } else {
          setHistoryMode("seed");
          setHistoryNotice(
            "No stored messages were returned, so demo seed history is shown until live events arrive."
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
  }, [incident.channel, pubnub]);

  useEffect(() => {
    if (!pubnub) {
      return;
    }

    const client = pubnub;
    const subscription = client
      .channel(incident.channel)
      .subscription({ receivePresenceEvents: true });

    subscription.addListener({
      message: (event: PubNubMessageEnvelope) => {
        const nextMessage = normalizeMessage(
          event.message,
          event.channel ?? incident.channel,
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
        setPresenceNotice("Live presence is active for this incident channel.");
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
          channels: [incident.channel],
          state: {
            displayName: selectedUser.displayName,
            role: selectedUser.role,
            initials: selectedUser.initials,
            lastActivity: new Date().toISOString(),
          },
        });

        const result = await client.hereNow({
          channels: [incident.channel],
          includeUUIDs: true,
          includeState: true,
        });

        const channelPresence = result.channels?.[incident.channel];
        const occupants = channelPresence?.occupants ?? [];

        setPresenceParticipants(
          occupants.map((occupant) =>
            knownUserForUuid(String(occupant.uuid), stateRecord(occupant.state))
          )
        );
        setPresenceMode("live");
        setPresenceNotice("Live presence is active for this incident channel.");
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
  }, [appendMessage, incident.channel, onStatusChange, pubnub, selectedUser]);

  const publishIncidentMessage = useCallback(
    async (message: IncidentMessage) => {
      if (!pubnub) {
        appendMessage(message);
        return;
      }

      await pubnub.publish({
        channel: incident.channel,
        message,
        storeInHistory: true,
        sendByPost: true,
        meta: {
          senderId: message.senderId,
          type: message.type,
        },
        customMessageType: message.type,
      });
    },
    [appendMessage, incident.channel, pubnub]
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
