import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { api } from "../../lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const role = data.session?.user?.user_metadata?.role;
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
      setError((err as { message?: string })?.message || "Login failed. Check your credentials.");
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
          <p style={{ textAlign: "right", margin: "-0.5rem 0 0" }}>
            <a href="/auth/forgot-password" style={{ fontSize: "0.85rem" }}>Forgot password?</a>
          </p>
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
