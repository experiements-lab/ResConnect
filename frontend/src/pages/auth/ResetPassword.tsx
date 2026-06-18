import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      setDone(true);
      setTimeout(() => navigate("/auth/login"), 2000);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Could not reset password. The link may have expired.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page container" style={{ maxWidth: 420, paddingTop: "4rem" }}>
      <div className="card">
        <h2 style={{ marginBottom: "1.5rem" }}>Set a new password</h2>
        {done ? (
          <p style={{ color: "var(--text-muted)" }}>Password updated. Redirecting to sign in...</p>
        ) : (
          <form onSubmit={handleSubmit} className="stack">
            <div>
              <label>New password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div>
              <label>Confirm password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Saving..." : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
