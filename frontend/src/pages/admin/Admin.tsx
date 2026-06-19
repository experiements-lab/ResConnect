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

interface Stats {
  students: { total: number; pending: number; verified: number; rejected: number };
  landlords: { total: number; pending: number; verified: number; rejected: number };
  properties: { total: number; active: number };
  rooms: { total: number; available: number };
  enquiries: { total: number };
}

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

const SESSION_KEY = "admin_key";
const EXPIRY_KEY = "admin_key_expiry";
const SESSION_MINS = 30;
const PAGE_SIZE = 20;

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

function Pager({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="row" style={{ gap: "0.5rem", marginTop: "1rem", justifyContent: "center" }}>
      <button className="btn-outline" style={{ fontSize: "0.8rem" }} disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</button>
      <span style={{ fontSize: "0.85rem", alignSelf: "center" }}>Page {page} of {totalPages}</span>
      <button className="btn-outline" style={{ fontSize: "0.8rem" }} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  );
}

export default function Admin() {
  const [adminKey, setAdminKey] = useState(getStoredKey);
  const [keyInput, setKeyInput] = useState("");
  const [tab, setTab] = useState<"stats" | "students" | "landlords" | "audit">("stats");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [stats, setStats] = useState<Stats | null>(null);

  const [students, setStudents] = useState<Page<Student>>({ items: [], total: 0, page: 1, page_size: PAGE_SIZE });
  const [studentQuery, setStudentQuery] = useState("");
  const [studentStatus, setStudentStatus] = useState("");
  const [studentPage, setStudentPage] = useState(1);

  const [landlords, setLandlords] = useState<Page<Landlord>>({ items: [], total: 0, page: 1, page_size: PAGE_SIZE });
  const [landlordQuery, setLandlordQuery] = useState("");
  const [landlordStatus, setLandlordStatus] = useState("");
  const [landlordPage, setLandlordPage] = useState(1);

  const [auditLog, setAuditLog] = useState<Page<AuditEntry>>({ items: [], total: 0, page: 1, page_size: PAGE_SIZE });
  const [auditPage, setAuditPage] = useState(1);

  const headers = { "x-admin-key": adminKey };

  const verifyKey = async (key: string) => {
    setLoading(true);
    setError("");
    try {
      await api.get("/admin/stats", { headers: { "x-admin-key": key } });
      setAdminKey(key);
      sessionStorage.setItem(SESSION_KEY, key);
      sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + SESSION_MINS * 60 * 1000));
    } catch {
      setError("Invalid admin key or server error.");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/stats", { headers });
      setStats(data);
    } catch {
      setError("Failed to load stats.");
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/students", {
        headers,
        params: { page: studentPage, page_size: PAGE_SIZE, q: studentQuery || undefined, status: studentStatus || undefined },
      });
      setStudents(data);
    } catch {
      setError("Failed to load students.");
    } finally {
      setLoading(false);
    }
  };

  const loadLandlords = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/landlords", {
        headers,
        params: { page: landlordPage, page_size: PAGE_SIZE, q: landlordQuery || undefined, status: landlordStatus || undefined },
      });
      setLandlords(data);
    } catch {
      setError("Failed to load landlords.");
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLog = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/audit-log", { headers, params: { page: auditPage, page_size: PAGE_SIZE } });
      setAuditLog(data);
    } catch {
      setError("Failed to load audit log.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminKey) verifyKey(adminKey);
  }, []);

  useEffect(() => {
    if (!adminKey) return;
    if (tab === "stats") loadStats();
    else if (tab === "students") loadStudents();
    else if (tab === "landlords") loadLandlords();
    else if (tab === "audit") loadAuditLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey, tab, studentPage, landlordPage, auditPage]);

  const runStudentSearch = () => { setStudentPage(1); loadStudents(); };
  const runLandlordSearch = () => { setLandlordPage(1); loadLandlords(); };

  const viewDoc = async (type: "students" | "landlords", id: string) => {
    try {
      const { data } = await api.get(`/admin/${type}/${id}/doc`, { headers });
      window.open(data.url, "_blank");
    } catch {
      alert("No document uploaded yet.");
    }
  };

  const action = async (type: "students" | "landlords", id: string, act: "verify") => {
    setError("");
    try {
      await api.post(`/admin/${type}/${id}/${act}`, {}, { headers });
      if (type === "students") {
        setStudents((prev) => ({ ...prev, items: prev.items.map((s) => s.id === id ? { ...s, verification_status: "verified" } : s) }));
      } else {
        setLandlords((prev) => ({ ...prev, items: prev.items.map((l) => l.id === id ? { ...l, verification_status: "verified" } : l) }));
      }
    } catch {
      setError(`Failed to verify this ${type === "students" ? "student" : "landlord"}. Please try again.`);
    }
  };

  const confirmReject = async (type: "students" | "landlords", id: string) => {
    if (!rejectReason.trim()) return;
    setError("");
    try {
      await api.post(`/admin/${type}/${id}/reject`, { reason: rejectReason }, { headers });
      if (type === "students") {
        setStudents((prev) => ({ ...prev, items: prev.items.map((s) => s.id === id ? { ...s, verification_status: "rejected" } : s) }));
      } else {
        setLandlords((prev) => ({ ...prev, items: prev.items.map((l) => l.id === id ? { ...l, verification_status: "rejected" } : l) }));
      }
      setRejectingId(null);
      setRejectReason("");
    } catch {
      setError(`Failed to reject this ${type === "students" ? "student" : "landlord"}. Please try again.`);
    }
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
            onKeyDown={(e) => e.key === "Enter" && verifyKey(keyInput)}
          />
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" onClick={() => verifyKey(keyInput)}>Access Admin</button>
        </div>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const cls = status === "verified" ? "badge-green" : status === "rejected" ? "badge-maroon" : "badge-yellow";
    return <span className={`badge ${cls}`}>{status}</span>;
  };

  const statCard = (label: string, value: number, sub?: string) => (
    <div className="card" style={{ flex: "1 1 160px", textAlign: "center" }}>
      <p style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--maroon)" }}>{value}</p>
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{label}</p>
      {sub && <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );

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

        {error && <p className="error" style={{ marginBottom: "1rem" }}>{error}</p>}

        <div className="row" style={{ marginBottom: "1.5rem", gap: "0.5rem" }}>
          {(["stats", "students", "landlords", "audit"] as const).map((t) => (
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
              {t === "audit" ? "Audit Log" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button
            className="btn-outline"
            style={{ fontSize: "0.85rem", marginLeft: "auto" }}
            onClick={() => {
              if (tab === "stats") loadStats();
              else if (tab === "students") loadStudents();
              else if (tab === "landlords") loadLandlords();
              else loadAuditLog();
            }}
          >
            Refresh
          </button>
        </div>

        {loading && <p>Loading...</p>}

        {!loading && tab === "stats" && stats && (
          <div className="stack" style={{ gap: "1.5rem" }}>
            <div>
              <h3 style={{ marginBottom: "0.6rem" }}>Students</h3>
              <div className="row" style={{ gap: "1rem", flexWrap: "wrap" }}>
                {statCard("Total", stats.students.total)}
                {statCard("Pending", stats.students.pending)}
                {statCard("Verified", stats.students.verified)}
                {statCard("Rejected", stats.students.rejected)}
              </div>
            </div>
            <div>
              <h3 style={{ marginBottom: "0.6rem" }}>Landlords</h3>
              <div className="row" style={{ gap: "1rem", flexWrap: "wrap" }}>
                {statCard("Total", stats.landlords.total)}
                {statCard("Pending", stats.landlords.pending)}
                {statCard("Verified", stats.landlords.verified)}
                {statCard("Rejected", stats.landlords.rejected)}
              </div>
            </div>
            <div>
              <h3 style={{ marginBottom: "0.6rem" }}>Listings & Activity</h3>
              <div className="row" style={{ gap: "1rem", flexWrap: "wrap" }}>
                {statCard("Properties", stats.properties.total, `${stats.properties.active} active`)}
                {statCard("Rooms", stats.rooms.total, `${stats.rooms.available} available`)}
                {statCard("Enquiries", stats.enquiries.total)}
              </div>
            </div>
          </div>
        )}

        {!loading && tab === "students" && (
          <>
            <div className="row" style={{ gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <input
                placeholder="Search name, email, or student #"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runStudentSearch()}
                style={{ flex: "1 1 240px" }}
              />
              <select value={studentStatus} onChange={(e) => { setStudentStatus(e.target.value); setStudentPage(1); }}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
              <button className="btn-primary" style={{ background: "var(--maroon)" }} onClick={runStudentSearch}>Search</button>
            </div>

            {students.items.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
                <p style={{ color: "var(--text-muted)" }}>No students found.</p>
              </div>
            ) : (
              <div className="stack">
                {students.items.map((s) => (
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
                      ) : (
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
            )}
            <Pager page={students.page} total={students.total} pageSize={students.page_size} onChange={setStudentPage} />
          </>
        )}

        {!loading && tab === "landlords" && (
          <>
            <div className="row" style={{ gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <input
                placeholder="Search name or email"
                value={landlordQuery}
                onChange={(e) => setLandlordQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runLandlordSearch()}
                style={{ flex: "1 1 240px" }}
              />
              <select value={landlordStatus} onChange={(e) => { setLandlordStatus(e.target.value); setLandlordPage(1); }}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
              <button className="btn-primary" onClick={runLandlordSearch}>Search</button>
            </div>

            {landlords.items.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
                <p style={{ color: "var(--text-muted)" }}>No landlords found.</p>
              </div>
            ) : (
              <div className="stack">
                {landlords.items.map((l) => (
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
            )}
            <Pager page={landlords.page} total={landlords.total} pageSize={landlords.page_size} onChange={setLandlordPage} />
          </>
        )}

        {!loading && tab === "audit" && (
          <>
            {auditLog.items.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
                <p style={{ color: "var(--text-muted)" }}>No audit log entries yet.</p>
              </div>
            ) : (
              <div className="stack" style={{ gap: "0.5rem" }}>
                {auditLog.items.map((e) => (
                  <div key={e.id} className="card" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", padding: "0.75rem 1rem" }}>
                    <div>
                      <p style={{ fontSize: "0.9rem" }}>
                        <strong>{e.actor}</strong> {e.action}ed {e.entity_type} {(e.details?.full_name as string) ?? e.entity_id}
                        {e.action === "reject" && e.details?.reason ? ` — "${e.details.reason as string}"` : ""}
                      </p>
                    </div>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{new Date(e.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
            <Pager page={auditLog.page} total={auditLog.total} pageSize={auditLog.page_size} onChange={setAuditPage} />
          </>
        )}
      </div>
    </div>
  );
}
