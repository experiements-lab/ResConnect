import { Link } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const { session, loading, logout } = useSession();

  const role = session?.user?.user_metadata?.role;
  const meta = session?.user?.user_metadata as Record<string, string> | undefined;
  const displayName = meta?.full_name?.split(" ")[0] ?? session?.user?.email ?? "";

  return (
    <nav style={{
      background: "var(--maroon)",
      color: "white",
      padding: "0.75rem 0",
      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      borderBottom: "3px solid var(--gold)",
    }}>
      <div className="container row" style={{ justifyContent: "space-between" }}>
        <Link to="/" style={{ color: "white", fontWeight: 800, fontSize: "1.25rem", letterSpacing: "0.01em" }}>
          ResConnect
        </Link>
        <div className="row">
          <Link to="/listings" style={{ color: "rgba(255,255,255,0.9)", fontSize: "0.95rem" }}>Browse</Link>
          {!loading && (
            session ? (
              <>
                {role === "student" && (
                  <Link to="/student/dashboard" style={{ color: "rgba(255,255,255,0.9)", fontSize: "0.95rem" }}>Dashboard</Link>
                )}
                {role === "landlord" && (
                  <Link to="/landlord/dashboard" style={{ color: "rgba(255,255,255,0.9)", fontSize: "0.95rem" }}>My Properties</Link>
                )}
                <NotificationBell />
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
                <Link to="/auth/login" style={{ color: "rgba(255,255,255,0.9)", fontSize: "0.95rem" }}>Login</Link>
                <Link to="/auth/register">
                  <button style={{ background: "var(--gold)", color: "white", fontWeight: 600 }}>Sign Up</button>
                </Link>
              </>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
