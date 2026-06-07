import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { api } from "../../lib/api";

type Role = "student" | "landlord";

export default function Register() {
  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (role === "student" && !email.endsWith("@sun.ac.za")) {
      setError("Students must register with their @sun.ac.za university email address.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const metadata: Record<string, string> = { role, full_name: fullName };
      if (role === "student") metadata.student_number = studentNumber;
      if (role === "landlord") metadata.phone = phone;

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      if (authError) throw authError;

      if (!data.session) {
        // Email confirmation required — inform the user
        navigate("/auth/login");
        return;
      }

      if (role === "student") {
        try {
          await api.post("/students/me/sync");
        } catch (syncErr: unknown) {
          const detail = (syncErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "";
          if (detail.includes("sun.ac.za")) {
            await supabase.auth.signOut();
            setError("Students must register with their @sun.ac.za university email address.");
            setSubmitting(false);
            return;
          }
        }
      } else {
        await api.post("/landlords/me/sync").catch(() => {});
      }
      navigate(role === "student" ? "/student/dashboard" : "/landlord/dashboard");
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || "Registration failed. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="page container" style={{ maxWidth: 480, paddingTop: "3rem" }}>
      <div className="card">
        <h2 style={{ marginBottom: "0.5rem" }}>Create your account</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          Students must use their @sun.ac.za email address.
        </p>

        <div className="row" style={{ marginBottom: "1.5rem" }}>
          {(["student", "landlord"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              style={{
                flex: 1,
                background: role === r ? "var(--maroon)" : "transparent",
                color: role === r ? "white" : "var(--text-muted)",
                border: "1.5px solid var(--maroon)",
                borderRadius: "var(--radius)",
                padding: "0.6rem",
                fontWeight: 600,
              }}
            >
              {r === "student" ? "I'm a Student" : "I'm a Landlord"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="stack">
          <div>
            <label>Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <label>{role === "student" ? "SU Email (@sun.ac.za)" : "Email Address"}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={role === "student" ? "yourname@sun.ac.za" : ""}
              required
            />
          </div>
          {role === "student" && (
            <div>
              <label>Student Number (8 digits)</label>
              <input
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                pattern="[0-9]{8}"
                placeholder="12345678"
                required
              />
            </div>
          )}
          {role === "landlord" && (
            <div>
              <label>Phone Number</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
          )}
          <div>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Creating account…" : "Create Account"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Already have an account? <a href="/auth/login">Sign in</a>
        </p>
      </div>
    </div>
  );
}
