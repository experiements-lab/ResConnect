import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { kratosApi } from "../../lib/api";

type Role = "student" | "landlord";

export default function Register() {
  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const { data: flow } = await kratosApi.get("/self-service/registration/browser");
      const traits: Record<string, string> = { email, full_name: fullName, role };
      if (role === "student") traits.student_number = studentNumber;
      if (role === "landlord") traits.phone = phone;

      await kratosApi.post(`/self-service/registration?flow=${flow.id}`, {
        method: "password",
        password,
        traits,
      });
      navigate(role === "student" ? "/student/dashboard" : "/landlord/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { ui?: { messages?: Array<{ text: string }> } } } })
        ?.response?.data?.ui?.messages?.[0]?.text;
      setError(msg || "Registration failed. Please try again.");
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
                background: role === r ? "var(--green)" : "transparent",
                color: role === r ? "white" : "var(--text-muted)",
                border: "1.5px solid var(--green)",
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
          <button type="submit" className="btn-primary">Create Account</button>
        </form>
        <p style={{ marginTop: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Already have an account? <a href="/auth/login">Sign in</a>
        </p>
      </div>
    </div>
  );
}
