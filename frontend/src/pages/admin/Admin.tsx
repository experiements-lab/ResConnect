import { useEffect, useState } from "react";
import { api } from "../../lib/api";

interface Student {
  id: string;
  student_number: string;
  full_name: string;
  sun_email: string;
  verification_status: string;
  registration_doc_key: string | null;
}

interface Landlord {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  verification_status: string;
  ownership_doc_key: string | null;
  is_su_accredited: boolean;
}

const SESSION_KEY = "admin_key";
const EXPIRY_KEY = "admin_key_expiry";
const SESSION_MINS = 30;

function getStoredKey(): string {
  const key = sessionStorage.getItem(SESSION_KEY) ?? "";
  const expiry = Number(sessionStorage.getItem(EXPIRY_KEY) ?? 0);
  if (key && Date.now() > expiry) {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(EXPIRY_KEY);
    return "";
  }
  return key;
}

export default function Admin() {
  const [adminKey, setAdminKey] = useState(getStoredKey);
  const [keyInput, setKeyInput] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [tab, setTab] = useState<"students" | "landlords">("students");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const headers = { "x-admin-key": adminKey };

  const load = async (key: string) => {
    setLoading(true);
    setError("");
    try {
      const [s, l] = await Promise.all([
        api.get("/admin/students", { headers: { "x-admin-key": key } }),
        api.get("/admin/landlords", { headers: { "x-admin-key": key } }),
      ]);
      setStudents(s.data);
      setLandlords(l.data);
      setAdminKey(key);
      sessionStorage.setItem(SESSION_KEY, key);
      sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + SESSION_MINS * 60 * 1000));
    } catch {
      setError("Invalid admin key or server error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminKey) load(adminKey);
  }, []);

  const viewDoc = async (type: "students" | "landlords", id: string) => {
    try {
      const { data } = await api.get(`/admin/${type}/${id}/doc`, { headers });
      window.open(data.url, "_blank");
    } catch {
      alert("No document uploaded yet.");
    }
  };

  const action = async (type: "students" | "landlords", id: string, act: "verify") => {
    await api.post(`/admin/${type}/${id}/${act}`, {}, { headers });
    if (type === "students") {
      setStudents((prev) => prev.map((s) => s.id === id ? { ...s, verification_status: "verified" } : s));
    } else {
      setLandlords((prev) => prev.map((l) => l.id === id ? { ...l, verification_status: "verified" } : l));
    }
  };

  const confirmReject = async (type: "students" | "landlords", id: string) => {
    if (!rejectReason.trim()) return;
    await api.post(`/admin/${type}/${id}/reject`, { reason: rejectReason }, { headers });
    if (type === "students") {
      setStudents((prev) => prev.map((s) => s.id === id ? { ...s, verification_status: "rejected" } : s));
    } else {
      setLandlords((prev) => prev.map((l) => l.id === id ? { ...l, verification_status: "rejected" } : l));
    }
    setRejectingId(null);
    setRejectReason("");
  };

  if (!adminKey) {
    return (
      <div className="page container" style={{ maxWidth: 420, paddingTop: "4rem" }}>
        <div className="card stack">
          <h2>Admin Access</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Enter the admin key to continue.</p>
          <input
            type="password"
            placeholder="Admin key"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(keyInput)}
          />
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" onClick={() => load(keyInput)}>Access Admin</button>
        </div>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const cls = status === "verified" ? "badge-green" : status === "rejected" ? "badge-maroon" : "badge-yellow";
    return <span className={`badge ${cls}`}>{status}</span>;
  };

  const pendingStudents = students.filter((s) => s.verification_status === "pending").length;
  const pendingLandlords = landlords.filter((l) => l.verification_status === "pending").length;

  return (
    <div className="page">
      <div className="container">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h1>Admin Panel</h1>
          <button
            className="btn-outline"
            style={{ fontSize: "0.85rem" }}
            onClick={() => { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(EXPIRY_KEY); setAdminKey(""); setKeyInput(""); }}
          >
            Sign out
          </button>
        </div>

        <div className="row" style={{ marginBottom: "1.5rem", gap: "0.5rem" }}>
          {(["students", "landlords"] as const).map((t) => {
            const count = t === "students" ? pendingStudents : pendingLandlords;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  background: tab === t ? "var(--maroon)" : "transparent",
                  color: tab === t ? "white" : "var(--maroon)",
                  border: "1.5px solid var(--maroon)",
                  borderRadius: "var(--radius)",
                  padding: "0.5rem 1.2rem",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}{count > 0 ? ` (${count} pending)` : ""}
              </button>
            );
          })}
          <button className="btn-outline" style={{ fontSize: "0.85rem", marginLeft: "auto" }} onClick={() => load(adminKey)}>
            Refresh
          </button>
        </div>

        {loading ? <p>Loading...</p> : tab === "students" ? (
          students.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "var(--text-muted)" }}>No students registered yet.</p>
            </div>
          ) : (
            <div className="stack">
              {students.map((s) => (
                <div key={s.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{s.full_name}</p>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{s.sun_email} · #{s.student_number}</p>
                    {s.registration_doc_key ? (
                      <button
                        onClick={() => viewDoc("students", s.id)}
                        style={{ fontSize: "0.8rem", color: "var(--maroon)", background: "none", border: "none", padding: 0, cursor: "pointer", marginTop: "0.25rem", textDecoration: "underline" }}
                      >
                        View Document
                      </button>
                    ) : null}
                    {!s.registration_doc_key && (
                      <p style={{ fontSize: "0.8rem", color: "#e53e3e", marginTop: "0.25rem" }}>No document uploaded yet</p>
                    )}
                  </div>
                  <div className="stack" style={{ gap: "0.4rem", alignItems: "flex-end" }}>
                    <div className="row" style={{ gap: "0.5rem" }}>
                      {statusBadge(s.verification_status)}
                      {s.verification_status !== "verified" && (
                        <button
                          className="btn-primary"
                          style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", background: "var(--maroon)", opacity: s.registration_doc_key ? 1 : 0.45 }}
                          disabled={!s.registration_doc_key}
                          title={!s.registration_doc_key ? "Cannot verify — no document uploaded yet" : ""}
                          onClick={() => action("students", s.id, "verify")}
                        >
                          Verify
                        </button>
                      )}
                      {s.verification_status !== "rejected" && (
                        <button
                          style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "var(--radius)" }}
                          onClick={() => { setRejectingId(s.id); setRejectReason(""); }}
                        >
                          Reject
                        </button>
                      )}
                    </div>
                    {rejectingId === s.id && (
                      <div className="stack" style={{ gap: "0.4rem", padding: "0.6rem", background: "#fee2e2", borderRadius: "var(--radius)", minWidth: 260 }}>
                        <input
                          placeholder="Reason for rejection (shown to student)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          style={{ fontSize: "0.82rem" }}
                        />
                        <div className="row" style={{ gap: "0.4rem" }}>
                          <button style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem", background: "#991b1b", color: "white", border: "none", borderRadius: "var(--radius)" }} disabled={!rejectReason.trim()} onClick={() => confirmReject("students", s.id)}>Confirm</button>
                          <button className="btn-outline" style={{ fontSize: "0.8rem" }} onClick={() => setRejectingId(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          landlords.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "var(--text-muted)" }}>No landlords registered yet.</p>
            </div>
          ) : (
            <div className="stack">
              {landlords.map((l) => (
                <div key={l.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{l.full_name}</p>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{l.email}{l.phone ? ` · ${l.phone}` : ""}</p>
                    {l.ownership_doc_key ? (
                      <button
                        onClick={() => viewDoc("landlords", l.id)}
                        style={{ fontSize: "0.8rem", color: "var(--maroon)", background: "none", border: "none", padding: 0, cursor: "pointer", marginTop: "0.25rem", textDecoration: "underline" }}
                      >
                        View Document
                      </button>
                    ) : (
                      <p style={{ fontSize: "0.8rem", color: "#e53e3e", marginTop: "0.25rem" }}>No document uploaded yet</p>
                    )}
                  </div>
                  <div className="stack" style={{ gap: "0.4rem", alignItems: "flex-end" }}>
                    <div className="row" style={{ gap: "0.5rem" }}>
                      {statusBadge(l.verification_status)}
                      {l.verification_status !== "verified" && (
                        <button
                          className="btn-primary"
                          style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", opacity: l.ownership_doc_key ? 1 : 0.45 }}
                          disabled={!l.ownership_doc_key}
                          title={!l.ownership_doc_key ? "Cannot verify — no document uploaded yet" : ""}
                          onClick={() => action("landlords", l.id, "verify")}
                        >
                          Verify
                        </button>
                      )}
                      {l.verification_status !== "rejected" && (
                        <button
                          style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "var(--radius)" }}
                          onClick={() => { setRejectingId(l.id); setRejectReason(""); }}
                        >
                          Reject
                        </button>
                      )}
                    </div>
                    {rejectingId === l.id && (
                      <div className="stack" style={{ gap: "0.4rem", padding: "0.6rem", background: "#fee2e2", borderRadius: "var(--radius)", minWidth: 260 }}>
                        <input
                          placeholder="Reason for rejection (shown to landlord)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          style={{ fontSize: "0.82rem" }}
                        />
                        <div className="row" style={{ gap: "0.4rem" }}>
                          <button style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem", background: "#991b1b", color: "white", border: "none", borderRadius: "var(--radius)" }} disabled={!rejectReason.trim()} onClick={() => confirmReject("landlords", l.id)}>Confirm</button>
                          <button className="btn-outline" style={{ fontSize: "0.8rem" }} onClick={() => setRejectingId(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
