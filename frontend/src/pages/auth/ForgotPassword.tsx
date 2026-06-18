import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (authError) throw authError;
      setSent(true);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Could not send reset email. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page container" style={{ maxWidth: 420, paddingTop: "4rem" }}>
      <div className="card">
        <h2 style={{ marginBottom: "1.5rem" }}>Reset your password</h2>
        {sent ? (
          <p style={{ color: "var(--text-muted)" }}>
            If an account exists for {email}, a password reset link has been sent. Check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="stack">
            <div>
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}
        <p style={{ marginTop: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          <a href="/auth/login">Back to sign in</a>
        </p>
      </div>
    </div>
  );
}
