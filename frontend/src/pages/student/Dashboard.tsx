import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useSession } from "../../hooks/useSession";
import { Link } from "react-router-dom";

interface Enquiry {
  id: string;
  room_id: string;
  message: string;
  status: string;
}

export default function StudentDashboard() {
  const { session } = useSession();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  useEffect(() => {
    api.get("/students/me").then((r) => setProfile(r.data)).catch(() => {});
    api.get("/enquiries/me").then((r) => setEnquiries(r.data)).catch(() => {});
  }, []);

  const uploadDoc = async () => {
    if (!docFile) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", docFile);
    try {
      await api.post("/students/me/upload-registration", form);
      setUploadMsg("Document uploaded! Verification is pending.");
    } catch {
      setUploadMsg("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const traits = session?.identity?.traits as Record<string, string> | undefined;

  return (
    <div className="page">
      <div className="container">
        <h1 style={{ marginBottom: "1.5rem" }}>Student Dashboard</h1>

        <div className="grid-2">
          <div className="card stack">
            <h3>My Profile</h3>
            <p><strong>Name:</strong> {traits?.full_name}</p>
            <p><strong>Email:</strong> {traits?.email}</p>
            <p><strong>Student No:</strong> {traits?.student_number}</p>
            {profile && (
              <>
                <p><strong>Faculty:</strong> {(profile.faculty as string) || "Not set"}</p>
                <p>
                  <strong>Verification:</strong>{" "}
                  <span className={`badge ${profile.verification_status === "verified" ? "badge-green" : "badge-yellow"}`}>
                    {profile.verification_status as string}
                  </span>
                </p>
              </>
            )}
          </div>

          <div className="card stack">
            <h3>Upload Proof of Registration</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Upload your SU registration document to unlock enquiries.
            </p>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              style={{ border: "none", padding: 0 }}
            />
            <button className="btn-primary" onClick={uploadDoc} disabled={!docFile || uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
            {uploadMsg && <p style={{ color: "var(--green)", fontSize: "0.85rem" }}>{uploadMsg}</p>}
          </div>
        </div>

        <div style={{ marginTop: "2rem" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
            <h2>My Enquiries</h2>
            <Link to="/listings"><button className="btn-outline">Browse Listings</button></Link>
          </div>
          {enquiries.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "var(--text-muted)" }}>No enquiries yet. Browse listings to find a room.</p>
            </div>
          ) : (
            <div className="stack">
              {enquiries.map((eq) => (
                <div key={eq.id} className="card row" style={{ justifyContent: "space-between" }}>
                  <p style={{ fontSize: "0.9rem" }}>{eq.message}</p>
                  <span className={`badge ${eq.status === "responded" ? "badge-green" : "badge-yellow"}`}>
                    {eq.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
