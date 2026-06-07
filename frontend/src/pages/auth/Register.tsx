import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { kratosApi, api } from "../../lib/api";
import { useSession } from "../../context/SessionContext";

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
  const { setSession } = useSession();

  useEffect(() => {
    kratosApi.get("/sessions/whoami")
      .then(() => navigate("/listings", { replace: true }))
      .catch(() => {});
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const { data: flow } = await kratosApi.get("/self-service/registration/browser");

      const csrfNode = flow.ui.nodes.find(
        (n: { attributes: { name: string; value?: string } }) => n.attributes.name === "csrf_token"
      );
      const csrfToken = csrfNode?.attributes?.value ?? "";

      const body: Record<string, string> = {
        method: "password",
        password,
        csrf_token: csrfToken,
        "traits.email": email,
        "traits.full_name": fullName,
        "traits.role": role,
      };
      if (role === "student") body["traits.student_number"] = studentNumber;
      if (role === "landlord") body["traits.phone"] = phone;

      const { data: regData } = await kratosApi.post(`/self-service/registration?flow=${flow.id}`, body);

      // Update shared session context immediately
      setSession(regData?.session ?? null);

      if (role === "student") {
        try {
          await api.post("/students/me/sync");
        } catch (syncErr: unknown) {
          const detail = (syncErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "";
          if (detail.includes("sun.ac.za")) {
            await kratosApi.get("/self-service/logout/browser").catch(() => {});
            setSession(null);
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
      const msg = (err as { response?: { data?: { ui?: { messages?: Array<{ text: string }> } } } })
        ?.response?.data?.ui?.messages?.[0]?.text;
      setError(msg || "Registration failed. Please try again.");
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
