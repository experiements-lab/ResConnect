import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { kratosApi, api } from "../../lib/api";
import { useSession } from "../../context/SessionContext";

export default function Login() {
  const [flow, setFlow] = useState<Record<string, unknown> | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { setSession } = useSession();

  useEffect(() => {
    kratosApi.get("/self-service/login/browser")
      .then((r) => setFlow(r.data))
      .catch((err) => {
        if (err?.response?.status === 400) navigate("/listings");
      });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flow || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const csrfNode = (flow as { ui: { nodes: Array<{ attributes: { name: string; value?: string } }> } })
        .ui.nodes.find((n) => n.attributes.name === "csrf_token");
      const csrfToken = csrfNode?.attributes?.value ?? "";

      const { data: loginData } = await kratosApi.post(
        `/self-service/login?flow=${(flow as { id: string }).id}`,
        { method: "password", identifier: email, password, csrf_token: csrfToken }
      );

      const session = loginData?.session;
      const role = session?.identity?.traits?.role;

      // Update shared session context immediately
      setSession(session ?? null);

      if (role === "student") {
        await api.post("/students/me/sync").catch(() => {});
        navigate("/student/dashboard");
      } else if (role === "landlord") {
        await api.post("/landlords/me/sync").catch(() => {});
        navigate("/landlord/dashboard");
      } else {
        navigate("/listings");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { ui?: { messages?: Array<{ text: string }> } } } })
        ?.response?.data?.ui?.messages?.[0]?.text;
      setError(msg || "Login failed. Check your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page container" style={{ maxWidth: 420, paddingTop: "4rem" }}>
      <div className="card">
        <h2 style={{ marginBottom: "1.5rem" }}>Sign in to ResConnect</h2>
        <form onSubmit={handleSubmit} className="stack">
          <div>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Don't have an account? <a href="/auth/register">Sign up</a>
        </p>
      </div>
    </div>
  );
}
