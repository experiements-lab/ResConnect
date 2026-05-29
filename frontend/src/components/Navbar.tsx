import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { kratosApi } from "../lib/api";

export default function Navbar() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { data } = await kratosApi.get("/self-service/logout/browser");
      window.location.href = data.logout_url;
    } catch {
      navigate("/auth/login");
    }
  };

  const role = session?.identity?.schema_id;

  return (
    <nav style={{
      background: "var(--green)",
      color: "white",
      padding: "0.75rem 0",
      boxShadow: "0 2px 4px rgba(0,0,0,0.15)"
    }}>
      <div className="container row" style={{ justifyContent: "space-between" }}>
        <Link to="/" style={{ color: "white", fontWeight: 700, fontSize: "1.2rem" }}>
          ResConnect
        </Link>
        <div className="row">
          <Link to="/listings" style={{ color: "white", opacity: 0.9 }}>Browse</Link>
          {!loading && (
            session ? (
              <>
                {role === "student" && (
                  <Link to="/student/dashboard" style={{ color: "white", opacity: 0.9 }}>Dashboard</Link>
                )}
                {role === "landlord" && (
                  <Link to="/landlord/dashboard" style={{ color: "white", opacity: 0.9 }}>My Properties</Link>
                )}
                <button
                  onClick={handleLogout}
                  style={{ background: "rgba(255,255,255,0.15)", color: "white", padding: "0.4rem 0.9rem" }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/auth/login" style={{ color: "white", opacity: 0.9 }}>Login</Link>
                <Link to="/auth/register">
                  <button style={{ background: "white", color: "var(--green)" }}>Sign Up</button>
                </Link>
              </>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
