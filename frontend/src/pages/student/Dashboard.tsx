import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useSession } from "../../context/SessionContext";
import { Link } from "react-router-dom";
import ChatThread from "../../components/ChatThread";

interface StudentProfile {
  id: string;
  student_number: string;
  full_name: string;
  sun_email: string;
  verification_status: string;
  reject_reason: string | null;
  faculty: string | null;
  nsfas_eligible: boolean;
}

interface Enquiry {
  id: string;
  room_id: string;
  message: string;
  status: string;
  booking_status: string;
  reject_reason: string | null;
  landlord_response: string | null;
  created_at: string;
  property_name: string | null;
  property_id: string | null;
  room_type: string | null;
  price_per_month: number | null;
}

export default function StudentDashboard() {
  const { session } = useSession();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [enquiriesLoading, setEnquiriesLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [profileError, setProfileError] = useState(false);
  const [enquiriesError, setEnquiriesError] = useState(false);

  useEffect(() => {
    api.get("/students/me")
      .then((r) => setProfile(r.data))
      .catch(() => setProfileError(true))
      .finally(() => setProfileLoading(false));
    api.get("/enquiries/me")
      .then((r) => setEnquiries(r.data))
      .catch(() => setEnquiriesError(true))
      .finally(() => setEnquiriesLoading(false));
  }, []);

  const uploadDoc = async () => {
    if (!docFile) return;
    setUploading(true);
    setUploadMsg("");
    setUploadError("");
    const form = new FormData();
    form.append("file", docFile);
    try {
      await api.post("/students/me/upload-registration", form);
      setDocFile(null);
      // Re-fetch profile to confirm pending status from server
      const { data } = await api.get("/students/me");
      setProfile(data);
      setUploadMsg("Document submitted for review. Admin typically verifies within 24 hours. Check back on your dashboard.");
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const traits = session?.user?.user_metadata as Record<string, string> | undefined;
  const verificationStatus = profile?.verification_status ?? "unverified";

  const statusColor: Record<string, string> = {
    verified: "badge-green",
    pending: "badge-yellow",
    rejected: "badge-maroon",
    unverified: "badge-maroon",
  };

  const roomTypeLabel = (type: string) => type.replace("_", "-").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="page">
      <div className="container">
        <h1 style={{ marginBottom: "1.5rem" }}>Student Dashboard</h1>

        <div className="grid-2" style={{ marginBottom: "2rem" }}>
          <div className="card stack">
            <h3>My Profile</h3>
            {profileLoading ? (
              <p style={{ color: "var(--text-muted)" }}>Loading...</p>
            ) : profileError ? (
              <p style={{ color: "#e53e3e", fontSize: "0.9rem" }}>Failed to load profile. <button onClick={() => window.location.reload()} style={{ background: "none", border: "none", color: "var(--maroon)", cursor: "pointer", textDecoration: "underline", padding: 0 }}>Retry</button></p>
            ) : (
              <>
                <p><strong>Name:</strong> {traits?.full_name}</p>
                <p><strong>Email:</strong> {traits?.email}</p>
                <p><strong>Student No:</strong> {traits?.student_number}</p>
                {profile?.faculty && <p><strong>Faculty:</strong> {profile.faculty}</p>}
                <div className="row">
                  <strong>Verification:</strong>
                  <span className={`badge ${statusColor[verificationStatus]}`}>
                    {verificationStatus}
                  </span>
                </div>
                {verificationStatus === "verified" && (
                  <p style={{ color: "var(--maroon)", fontSize: "0.85rem" }}>
                    You can now enquire on available rooms.
                  </p>
                )}
                {verificationStatus === "rejected" && (
                  <div style={{ background: "#fee2e2", borderRadius: "var(--radius)", padding: "0.75rem", fontSize: "0.85rem" }}>
                    <p style={{ color: "#991b1b", fontWeight: 600 }}>Document rejected</p>
                    {profile?.reject_reason && (
                      <p style={{ color: "#991b1b", marginTop: "0.25rem" }}>Reason: {profile.reject_reason}</p>
                    )}
                    <p style={{ color: "#991b1b", marginTop: "0.25rem" }}>Please upload a valid proof of registration below.</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card stack">
            <h3>Proof of Registration</h3>
            {verificationStatus === "verified" ? (
              <p style={{ color: "var(--maroon)", fontSize: "0.9rem" }}>
                Your account is verified. You can browse and enquire on listings.
              </p>
            ) : (
              <>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Upload your SU registration document (PDF, JPG, or PNG, max 10MB) to unlock enquiries.
                </p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  style={{ border: "none", padding: 0 }}
                />
                <button
                  className="btn-primary"
                  onClick={uploadDoc}
                  disabled={!docFile || uploading}
                >
                  {uploading ? "Uploading..." : "Upload Document"}
                </button>
                {uploadMsg && (
                  <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: "var(--radius)", padding: "0.75rem", fontSize: "0.85rem", color: "#92400e" }}>
                    {uploadMsg}
                  </div>
                )}
                {uploadError && <p className="error">{uploadError}</p>}
              </>
            )}
          </div>
        </div>

        <div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
            <h2>My Enquiries</h2>
            <Link to="/listings">
              <button className="btn-outline">Browse Listings</button>
            </Link>
          </div>

          {enquiriesLoading ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "var(--text-muted)" }}>Loading enquiries...</p>
            </div>
          ) : enquiriesError ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "#e53e3e", marginBottom: "0.75rem" }}>Failed to load enquiries.</p>
              <button className="btn-outline" style={{ fontSize: "0.85rem" }} onClick={() => window.location.reload()}>Retry</button>
            </div>
          ) : enquiries.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "var(--text-muted)" }}>
                No enquiries yet.{" "}
                {verificationStatus !== "verified"
                  ? "Get verified first, then browse listings to find a room."
                  : "Browse listings to find a room."}
              </p>
            </div>
          ) : (
            <div className="stack">
              {enquiries.map((eq) => (
                <div key={eq.id} className="card stack" style={{ gap: "0.6rem" }}>
                  <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                        {eq.property_name ?? "Unknown Property"}
                      </p>
                      {eq.room_type && (
                        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                          {roomTypeLabel(eq.room_type)}{eq.price_per_month ? ` · R${eq.price_per_month.toLocaleString()}/mo` : ""}
                        </p>
                      )}
                    </div>
                    <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                      {eq.booking_status === "accepted" && <span className="badge badge-green">Room Accepted</span>}
                      {eq.booking_status === "declined" && <span className="badge badge-maroon">Declined</span>}
                      {eq.booking_status === "viewing_arranged" && <span className="badge badge-yellow">Viewing Arranged</span>}
                      <span className={`badge ${eq.status === "responded" ? "badge-green" : "badge-yellow"}`}>
                        {eq.status === "responded" ? "Replied" : eq.status === "read" ? "Seen" : "Sent"}
                      </span>
                    </div>
                  </div>
                  {eq.booking_status === "accepted" && (
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "var(--radius)", padding: "0.75rem", fontSize: "0.88rem" }}>
                      <strong style={{ color: "#166534" }}>Your room has been accepted!</strong>
                      <p style={{ color: "#15803d", marginTop: "0.25rem" }}>Contact the landlord via chat to arrange move-in details.</p>
                    </div>
                  )}
                  {eq.booking_status === "declined" && (
                    <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "var(--radius)", padding: "0.75rem", fontSize: "0.88rem" }}>
                      <strong style={{ color: "#991b1b" }}>Enquiry declined</strong>
                      {eq.reject_reason && <p style={{ color: "#991b1b", marginTop: "0.25rem" }}>Reason: {eq.reject_reason}</p>}
                    </div>
                  )}
                  <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                    "{eq.message}"
                  </p>
                  {eq.status === "sent" && (() => {
                    const daysSince = Math.floor((Date.now() - new Date(eq.created_at).getTime()) / 86400000);
                    return daysSince >= 3 ? (
                      <p style={{ fontSize: "0.78rem", color: "#92400e", background: "#fef3c7", padding: "0.3rem 0.6rem", borderRadius: "var(--radius)" }}>
                        No reply yet · {daysSince} days ago. Try following up in the chat.
                      </p>
                    ) : null;
                  })()}
                  <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem" }}>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {new Date(eq.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <button
                      className={activeChat === eq.id ? "btn-outline" : "btn-primary"}
                      style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                      onClick={() => setActiveChat(activeChat === eq.id ? null : eq.id)}
                    >
                      {activeChat === eq.id ? "Close chat" : "Open chat"}
                    </button>
                  </div>
                  {activeChat === eq.id && (
                    <ChatThread enquiryId={eq.id} senderRole="student" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
