import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

function formatTime(ts: string) {
  const diffMs = Date.now() - new Date(ts).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications/me/unread-count");
      setUnreadCount(data.count);
    } catch {
      // silent — background polling shouldn't disrupt the UI
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const { data } = await api.get("/notifications/me");
        setNotifications(data);
      } finally {
        setLoading(false);
      }
    }
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/me/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore — user can retry
    }
  };

  const handleItemClick = async (n: NotificationItem) => {
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await api.patch(`/notifications/${n.id}/read`);
      } catch {
        // ignore — count will resync on next poll
      }
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={toggleOpen}
        aria-label="Notifications"
        style={{
          background: "rgba(255,255,255,0.12)",
          color: "white",
          padding: "0.45rem 0.6rem",
          border: "1px solid rgba(255,255,255,0.25)",
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: "absolute",
            top: -4,
            right: -4,
            background: "var(--gold)",
            color: "white",
            borderRadius: "999px",
            fontSize: "0.65rem",
            fontWeight: 700,
            minWidth: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 3px",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: 340,
          maxHeight: 420,
          overflowY: "auto",
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          zIndex: 100,
        }}>
          <div className="row" style={{ justifyContent: "space-between", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
            <strong style={{ fontSize: "0.9rem" }}>Notifications</strong>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{ background: "transparent", color: "var(--maroon)", padding: "0.2rem 0.4rem", fontSize: "0.78rem" }}
              >
                Mark all read
              </button>
            )}
          </div>
          {loading ? (
            <p style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center" }}>Loading...</p>
          ) : notifications.length === 0 ? (
            <p style={{ padding: "1.5rem 1rem", color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center" }}>No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                style={{
                  padding: "0.7rem 1rem",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  background: n.is_read ? "transparent" : "#fdf6ea",
                }}
              >
                <div className="row" style={{ justifyContent: "space-between", gap: "0.5rem", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: n.is_read ? 500 : 700, color: "var(--text)" }}>
                    {n.title}
                  </span>
                  {!n.is_read && (
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--maroon)", flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
                {n.body && (
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>{n.body}</p>
                )}
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{formatTime(n.created_at)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
