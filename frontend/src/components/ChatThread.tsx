import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../lib/api";

const MAX_CHARS = 2000;

interface Message {
  id: string;
  enquiry_id: string;
  sender_role: "student" | "landlord";
  body: string;
  created_at: string;
}

export default function ChatThread({
  enquiryId,
  senderRole,
}: {
  enquiryId: string;
  senderRole: "student" | "landlord";
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isOver = body.length > MAX_CHARS;

  const fetchMessages = useCallback(async (silent = false) => {
    try {
      const { data } = await api.get(`/enquiries/${enquiryId}/messages`);
      setMessages(data);
      setLastUpdated(new Date());
      if (!silent) setLoading(false);
    } catch (err: unknown) {
      if (!silent) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setError("This conversation is no longer available — the property was removed.");
        } else {
          setError("Failed to load messages.");
        }
        setLoading(false);
      }
    }
  }, [enquiryId]);

  // Initial load
  useEffect(() => {
    fetchMessages(false);
  }, [fetchMessages]);

  // Poll every 10 seconds while chat is open (P2-K)
  useEffect(() => {
    const interval = setInterval(() => fetchMessages(true), 10000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!body.trim() || isOver) return;
    setSending(true);
    setError(null);
    try {
      const { data } = await api.post(`/enquiries/${enquiryId}/messages`, { body });
      setMessages((prev) => [...prev, data]);
      setBody("");
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { detail?: string } } })?.response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (status === 403 && detail?.includes("rejected")) {
        setError("Your account verification was rejected. You can no longer send messages.");
      } else if (status === 422) {
        setError("Message is too long. Please keep it under 2000 characters.");
      } else {
        setError("Failed to send. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleString("en-ZA", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });

  const secondsAgo = lastUpdated
    ? Math.round((Date.now() - lastUpdated.getTime()) / 1000)
    : null;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
      {/* Message list */}
      <div style={{ maxHeight: 320, overflowY: "auto", padding: "1rem", background: "var(--bg)", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {loading ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center" }}>Loading messages...</p>
        ) : error && messages.length === 0 ? (
          <p style={{ color: "#e53e3e", fontSize: "0.85rem", textAlign: "center" }}>{error}</p>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "0.5rem" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>No messages yet.</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "0.3rem" }}>
              {senderRole === "student"
                ? "Ask about move-in date, what is included in rent, or request a viewing."
                : "Reply to this student's enquiry to start the conversation."}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_role === senderRole;
            return (
              <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "75%",
                  padding: "0.55rem 0.85rem",
                  borderRadius: "var(--radius)",
                  background: isMe ? "var(--maroon)" : "var(--surface)",
                  color: isMe ? "white" : "var(--text)",
                  border: isMe ? "none" : "1px solid var(--border)",
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                  wordBreak: "break-word",
                }}>
                  {msg.body}
                </div>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                  {msg.sender_role === "landlord" ? "Landlord" : "Student"} · {formatTime(msg.created_at)}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input — only show if no fatal error */}
      {!error?.includes("no longer available") && !error?.includes("rejected") && (
        <div style={{ padding: "0.75rem", background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
          {error && <p className="error" style={{ marginBottom: "0.4rem", marginTop: 0 }}>{error}</p>}
          <div className="row" style={{ gap: "0.5rem", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <textarea
                rows={2}
                placeholder="Type a message..."
                value={body}
                onChange={(e) => { setBody(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                style={{ width: "100%", fontSize: "0.88rem", resize: "none", borderColor: isOver ? "#e53e3e" : undefined }}
              />
              <div className="row" style={{ justifyContent: "space-between", marginTop: "0.2rem" }}>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  Enter to send · Shift+Enter for new line
                </p>
                <span style={{ fontSize: "0.72rem", color: isOver ? "#e53e3e" : "var(--text-muted)" }}>
                  {body.length}/{MAX_CHARS}
                </span>
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", alignSelf: "flex-start", marginTop: "0.1rem" }}
              onClick={sendMessage}
              disabled={sending || !body.trim() || isOver}
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
          {secondsAgo !== null && (
            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem", textAlign: "right" }}>
              Updated {secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}
            </p>
          )}
        </div>
      )}

      {/* Show permanent error message when conversation is gone or rejected */}
      {(error?.includes("no longer available") || error?.includes("rejected")) && (
        <div style={{ padding: "0.75rem", background: "#fef3c7", borderTop: "1px solid #f59e0b" }}>
          <p style={{ fontSize: "0.85rem", color: "#92400e" }}>{error}</p>
        </div>
      )}
    </div>
  );
}
