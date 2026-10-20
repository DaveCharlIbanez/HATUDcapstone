"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { FaComment, FaPaperPlane, FaTimes } from "react-icons/fa";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface Message {
  _id: Id<"messages">;
  content: string;
  createdAt: number;
  read: boolean;
  rideId: Id<"rides">;
  senderId: Id<"users">;
  senderRole: "commuter" | "operator" | "admin";
}

interface ChatBubbleProps {
  partnerName: string;
  partnerRole: "commuter" | "operator";
  positionOverride?: string;
  rideId: string;
  sessionToken: string;
}

export function ChatBubble({
  rideId,
  partnerName,
  partnerRole,
  sessionToken,
  positionOverride,
}: ChatBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_messageCount, setMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useQuery(api.messages.getByRide, {
    rideId: rideId as Id<"rides">,
    sessionToken,
  });

  const unreadCount = useQuery(api.messages.getUnreadCount, {
    rideId: rideId as Id<"rides">,
    sessionToken,
  });

  const sendMessage = useMutation(api.messages.send);
  const markAsRead = useMutation(api.messages.markAsRead);

  const currentUserRole = partnerRole === "commuter" ? "operator" : "commuter";

  const positionClasses =
    positionOverride ??
    (partnerRole === "commuter" ? "top-16 right-4" : "bottom-32 right-4");

  useEffect(() => {
    if (messages) {
      setMessageCount(messages.length);
      if (messages.length > 0) {
        markAsRead({ sessionToken, rideId: rideId as Id<"rides"> }).catch(
          console.error
        );
      }
    }
  }, [messages, sessionToken, rideId, markAsRead]);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!message.trim() || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await sendMessage({
        sessionToken,
        rideId: rideId as Id<"rides">,
        content: message.trim(),
      });
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const displayUnread = unreadCount && unreadCount > 0 ? unreadCount : null;

  return (
    <div
      className={`fixed ${positionClasses} pointer-events-none`}
      style={{ zIndex: 9999 }}
    >
      {isOpen ? (
        <div className="pointer-events-auto flex h-80 w-72 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
          <div className="flex items-center justify-between border-[var(--border)] border-b bg-[var(--surface-strong)] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm">
                {partnerName.charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold text-[var(--foreground)]">
                {partnerName}
              </span>
            </div>
            <button
              aria-label="Close chat"
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <FaTimes className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages === undefined && (
              <div className="flex h-full items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              </div>
            )}
            {messages !== undefined && messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-[var(--text-muted)]">
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">Start a conversation!</p>
              </div>
            )}
            {messages?.map((msg: Message) => {
              const isSent = msg.senderRole === currentUserRole;
              return (
                <div
                  className={`flex ${isSent ? "justify-end" : "justify-start"}`}
                  key={msg._id}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                      isSent
                        ? "bg-sky-600 text-white"
                        : "bg-[var(--surface-muted)] text-[var(--foreground)]"
                    }`}
                  >
                    <p className="break-words text-sm">{msg.content}</p>
                    <p
                      className={`text-xs ${
                        isSent ? "text-sky-200" : "text-[var(--text-muted)]"
                      }`}
                    >
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="mx-3 mb-2 rounded-lg bg-red-500/20 px-3 py-2 text-center text-red-300 text-xs">
              {error}
            </div>
          )}

          <div className="border-[var(--border)] border-t bg-[var(--surface-strong)] p-3">
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[var(--foreground)] text-sm placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none"
                maxLength={500}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                type="text"
                value={message}
              />
              <button
                aria-label="Send message"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!message.trim() || isSending}
                onClick={handleSend}
                type="button"
              >
                {isSending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <FaPaperPlane className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          aria-label="Open chat"
          className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 shadow-lg transition hover:scale-110 hover:bg-sky-500"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          <FaComment className="h-6 w-6 text-white" />
          {displayUnread && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 font-bold text-white text-xs">
              {displayUnread > 9 ? "9+" : displayUnread}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
