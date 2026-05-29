import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { kratosApi } from "../../lib/api";

export default function Login() {
  const [flow, setFlow] = useState<Record<string, unknown> | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    kratosApi.get("/self-service/login/browser").then((r) => setFlow(r.data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flow) return;
    setError("");
    try {
      await kratosApi.post(
        `/self-service/login?flow=${(flow as { id: string }).id}`,
        { method: "password", identifier: email, password }
      );
      navigate("/listings");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { ui?: { messages?: Array<{ text: string }> } } } })
        ?.response?.data?.ui?.messages?.[0]?.text;
      setError(msg || "Login failed. Check your credentials.");
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
          <button type="submit" className="btn-primary">Sign in</button>
        </form>
        <p style={{ marginTop: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Don't have an account? <a href="/auth/register">Sign up</a>
        </p>
      </div>
    </div>
  );
}
