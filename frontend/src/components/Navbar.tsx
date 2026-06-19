import { useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const { session, loading, logout } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const role = session?.user?.user_metadata?.role;
  const meta = session?.user?.user_metadata as Record<string, string> | undefined;
  const displayName = meta?.full_name?.split(" ")[0] ?? session?.user?.email ?? "";

  const linkStyle = { color: "rgba(255,255,255,0.9)", fontSize: "0.95rem" };

  const links = !loading && (
    session ? (
      <>
        {role === "student" && (
          <Link to="/student/dashboard" style={linkStyle} onClick={() => setMenuOpen(false)}>Dashboard</Link>
        )}
        {role === "landlord" && (
          <Link to="/landlord/dashboard" style={linkStyle} onClick={() => setMenuOpen(false)}>My Properties</Link>
        )}
        <span style={{ color: "var(--gold)", fontSize: "0.9rem", fontWeight: 600 }}>
          {displayName}
        </span>
        <button
          onClick={logout}
          style={{ background: "rgba(255,255,255,0.12)", color: "white", padding: "0.4rem 0.9rem", border: "1px solid rgba(255,255,255,0.25)" }}
        >
          Logout
        </button>
      </>
    ) : (
      <>
        <Link to="/auth/login" style={linkStyle} onClick={() => setMenuOpen(false)}>Login</Link>
        <Link to="/auth/register" onClick={() => setMenuOpen(false)}>
          <button style={{ background: "var(--gold)", color: "white", fontWeight: 600 }}>Sign Up</button>
        </Link>
      </>
    )
  );

  return (
    <nav style={{
      background: "var(--maroon)",
      color: "white",
      padding: "0.75rem 0",
      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      borderBottom: "3px solid var(--gold)",
    }}>
      <div className="container row navbar-bar" style={{ justifyContent: "space-between" }}>
        <Link to="/" style={{ color: "white", fontWeight: 800, fontSize: "1.25rem", letterSpacing: "0.01em" }}>
          ResConnect
        </Link>

        <div className="row navbar-links">
          <Link to="/listings" style={linkStyle}>Browse</Link>
          {links}
        </div>

        <div className="row" style={{ gap: "0.5rem" }}>
          {!loading && session && <NotificationBell />}

          <button
            className="navbar-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            style={{
              display: "none",
              background: "transparent",
              border: "none",
              padding: "0.4rem",
              color: "white",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M3 6h18M3 12h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          className="container stack navbar-mobile-menu"
          style={{ paddingTop: "0.75rem", alignItems: "flex-start" }}
        >
          <Link to="/listings" style={linkStyle} onClick={() => setMenuOpen(false)}>Browse</Link>
          {links}
        </div>
      )}
    </nav>
  );
}
