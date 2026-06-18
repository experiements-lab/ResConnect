import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import ChatThread from "../../components/ChatThread";

const AMENITIES = [
  { key: "wifi", label: "WiFi" },
  { key: "water_included", label: "Water incl." },
  { key: "electricity_included", label: "Electricity incl." },
  { key: "laundry", label: "Laundry" },
  { key: "parking", label: "Parking" },
  { key: "security", label: "Security" },
  { key: "kitchen", label: "Kitchen" },
];

interface Room {
  id: string;
  room_type: string;
  price_per_month: number;
  is_available: boolean;
  nsfas_accepted: boolean;
  total_count: number;
  available_count: number;
  amenities: Record<string, boolean>;
  available_from: string | null;
}

interface Property {
  id: string;
  name: string;
  address: string;
  is_su_accredited: boolean;
  is_active: boolean;
  description: string | null;
  distance_to_campus_m: number | null;
  rooms: Room[];
  cover_photo_url: string | null;
  photos: Photo[];
}

interface Photo {
  id: string;
  url: string;
  is_cover: boolean;
}

interface Enquiry {
  id: string;
  room_id: string;
  message: string;
  status: string;
  booking_status: string;
  reject_reason: string | null;
  landlord_response: string | null;
  responded_at: string | null;
  created_at: string;
  student_name: string | null;
  student_email: string | null;
  property_name: string | null;
  room_type: string | null;
  price_per_month: number | null;
}

const emptyRoomEdit = () => ({
  room_type: "single",
  price_per_month: "",
  nsfas_accepted: false,
  total_count: "1",
  available_count: "1",
  available_from: "",
  amenities: {} as Record<string, boolean>,
});

export default function LandlordDashboard() {
  const [tab, setTab] = useState<"properties" | "enquiries">("properties");
  const [properties, setProperties] = useState<Property[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [landlordStatus, setLandlordStatus] = useState<string>("pending");
  const [landlordProfile, setLandlordProfile] = useState({ full_name: "", email: "", phone: "" });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileEditForm, setProfileEditForm] = useState({ full_name: "", phone: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState("");

  // Ownership doc upload
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [ownershipDocKey, setOwnershipDocKey] = useState<string | null>(null);

  // Property edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", address: "", description: "", distance_to_campus_m: "", is_su_accredited: false, is_active: true });

  // Photo upload
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMsg, setPhotoMsg] = useState("");

  // Room edit
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomEditForm, setRoomEditForm] = useState(emptyRoomEdit());

  // Enquiry
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [enquiryFilter, setEnquiryFilter] = useState<"all" | "new" | "responded">("all");
  const [enquiriesLoaded, setEnquiriesLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/properties/mine").then((r) => setProperties(r.data)),
      api.get("/landlords/me").then((r) => {
        setLandlordStatus(r.data.verification_status);
        setOwnershipDocKey(r.data.ownership_doc_key);
        setLandlordProfile({ full_name: r.data.full_name, email: r.data.email, phone: r.data.phone ?? "" });
      }),
    ]).finally(() => setLoading(false));
  }, []);

  const pendingCount = enquiries.filter((e) => e.status === "sent" || e.status === "read").length;

  const startEditProfile = () => {
    setProfileEditForm({ full_name: landlordProfile.full_name, phone: landlordProfile.phone });
    setProfileSaveError("");
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileSaveError("");
    try {
      const { data } = await api.patch("/landlords/me", {
        full_name: profileEditForm.full_name,
        phone: profileEditForm.phone || null,
      });
      setLandlordProfile({ full_name: data.full_name, email: data.email, phone: data.phone ?? "" });
      setEditingProfile(false);
    } catch {
      setProfileSaveError("Could not save changes. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  // — Property actions —
  const startEdit = (prop: Property) => {
    setEditingId(prop.id);
    setEditingRoomId(null);
    setEditForm({
      name: prop.name,
      address: prop.address,
      description: prop.description ?? "",
      distance_to_campus_m: prop.distance_to_campus_m?.toString() ?? "",
      is_su_accredited: prop.is_su_accredited,
      is_active: prop.is_active,
    });
    setPhotoMsg("");
  };

  const saveEdit = async (propertyId: string) => {
    await api.patch(`/properties/${propertyId}`, {
      name: editForm.name,
      address: editForm.address,
      description: editForm.description || null,
      distance_to_campus_m: editForm.distance_to_campus_m ? parseInt(editForm.distance_to_campus_m) : null,
      is_su_accredited: editForm.is_su_accredited,
      is_active: editForm.is_active,
    });
    setProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId
          ? { ...p, ...editForm, distance_to_campus_m: editForm.distance_to_campus_m ? parseInt(editForm.distance_to_campus_m) : null }
          : p
      )
    );
    setEditingId(null);
  };

  const deleteProperty = async (propertyId: string, propName: string) => {
    if (!confirm(`Permanently delete "${propName}"? All rooms, photos, and enquiries will be removed.`)) return;
    await api.delete(`/properties/${propertyId}`);
    setProperties((prev) => prev.filter((p) => p.id !== propertyId));
    setEditingId(null);
  };

  const uploadPhoto = async (propertyId: string, isCover: boolean) => {
    if (!photoFile) return;
    setPhotoUploading(true);
    setPhotoMsg("");
    const form = new FormData();
    form.append("file", photoFile);
    try {
      await api.post(`/properties/${propertyId}/photos?is_cover=${isCover}`, form);
      setPhotoMsg(isCover ? "Cover photo updated!" : "Photo uploaded!");
      setPhotoFile(null);
      api.get("/properties/mine").then((r) => setProperties(r.data));
    } catch {
      setPhotoMsg("Upload failed. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const setCoverPhoto = async (propertyId: string, photoId: string) => {
    try {
      await api.post(`/properties/${propertyId}/photos/${photoId}/set-cover`);
      const { data } = await api.get("/properties/mine");
      setProperties(data);
    } catch {
      setPhotoMsg("Could not update cover photo.");
    }
  };

  const deletePhoto = async (propertyId: string, photoId: string) => {
    if (!confirm("Delete this photo?")) return;
    try {
      await api.delete(`/properties/${propertyId}/photos/${photoId}`);
      const { data } = await api.get("/properties/mine");
      setProperties(data);
    } catch {
      setPhotoMsg("Could not delete photo.");
    }
  };

  // — Room actions —
  const toggleRoom = async (propertyId: string, roomId: string) => {
    const { data } = await api.patch(`/properties/${propertyId}/rooms/${roomId}/toggle`);
    setProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId
          ? { ...p, rooms: p.rooms.map((r) => r.id === roomId ? { ...r, is_available: data.is_available } : r) }
          : p
      )
    );
  };

  const startRoomEdit = (room: Room) => {
    setEditingRoomId(room.id);
    setRoomEditForm({
      room_type: room.room_type,
      price_per_month: room.price_per_month.toString(),
      nsfas_accepted: room.nsfas_accepted,
      total_count: room.total_count.toString(),
      available_count: room.available_count.toString(),
      available_from: room.available_from ?? "",
      amenities: { ...room.amenities },
    });
  };

  const saveRoomEdit = async (propertyId: string, roomId: string) => {
    const { data } = await api.patch(`/properties/${propertyId}/rooms/${roomId}`, {
      room_type: roomEditForm.room_type,
      price_per_month: parseInt(roomEditForm.price_per_month),
      nsfas_accepted: roomEditForm.nsfas_accepted,
      total_count: parseInt(roomEditForm.total_count),
      available_count: parseInt(roomEditForm.available_count),
      available_from: roomEditForm.available_from || null,
      amenities: roomEditForm.amenities,
    });
    setProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId
          ? { ...p, rooms: p.rooms.map((r) => r.id === roomId ? { ...r, ...data } : r) }
          : p
      )
    );
    setEditingRoomId(null);
  };

  const deleteRoom = async (propertyId: string, roomId: string) => {
    if (!confirm("Delete this room type? Associated enquiries will also be removed.")) return;
    await api.delete(`/properties/${propertyId}/rooms/${roomId}`);
    setProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId ? { ...p, rooms: p.rooms.filter((r) => r.id !== roomId) } : p
      )
    );
    setEditingRoomId(null);
  };

  // — Enquiry actions —
  const openChat = (enquiryId: string, currentStatus: string) => {
    setRespondingId(respondingId === enquiryId ? null : enquiryId);
    if (currentStatus === "sent") {
      api.patch(`/enquiries/${enquiryId}/read`).catch(() => {});
      setEnquiries((prev) => prev.map((e) => e.id === enquiryId ? { ...e, status: "read" } : e));
    }
  };

  const acceptEnquiry = async (enquiryId: string) => {
    if (!confirm("Accept this student's enquiry? This will reduce the available room count.")) return;
    const { data } = await api.post(`/enquiries/${enquiryId}/accept`);
    setEnquiries((prev) => prev.map((e) => e.id === enquiryId ? { ...e, booking_status: data.booking_status } : e));
  };

  const cancelAcceptance = async (enquiryId: string) => {
    if (!confirm("Undo this acceptance? The room will become available again.")) return;
    const { data } = await api.post(`/enquiries/${enquiryId}/cancel`);
    setEnquiries((prev) => prev.map((e) => e.id === enquiryId ? { ...e, booking_status: data.booking_status } : e));
  };

  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const declineEnquiry = async (enquiryId: string) => {
    if (!declineReason.trim()) return;
    await api.post(`/enquiries/${enquiryId}/decline`, { reason: declineReason });
    setEnquiries((prev) => prev.map((e) => e.id === enquiryId ? { ...e, booking_status: "declined", reject_reason: declineReason } : e));
    setDecliningId(null);
    setDeclineReason("");
  };

  const arrangeViewing = async (enquiryId: string) => {
    const { data } = await api.post(`/enquiries/${enquiryId}/arrange-viewing`);
    setEnquiries((prev) => prev.map((e) => e.id === enquiryId ? { ...e, booking_status: data.booking_status } : e));
  };

  const openEnquiriesTab = () => {
    setTab("enquiries");
    if (!enquiriesLoaded) {
      api.get("/enquiries/landlord").then((r) => {
        setEnquiries(r.data);
        setEnquiriesLoaded(true);
      }).catch(() => {});
    }
  };

  // — Ownership doc upload —
  const uploadOwnershipDoc = async () => {
    if (!docFile) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", docFile);
    try {
      const { data } = await api.post("/landlords/me/upload-ownership", form);
      setUploadMsg("Document uploaded! Awaiting admin verification.");
      setOwnershipDocKey(data.key);
      setDocFile(null);
    } catch {
      setUploadMsg("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const viewOwnershipDoc = async () => {
    try {
      const { data } = await api.get("/landlords/me/ownership-doc");
      window.open(data.url, "_blank");
    } catch {
      setUploadMsg("Could not load document.");
    }
  };

  const deleteOwnershipDoc = async () => {
    if (!confirm("Delete your uploaded ownership document?")) return;
    try {
      await api.delete("/landlords/me/ownership-doc");
      setOwnershipDocKey(null);
      setUploadMsg("Document deleted.");
    } catch {
      setUploadMsg("Could not delete document. Please try again.");
    }
  };

  const filteredEnquiries = enquiries.filter((e) => {
    if (enquiryFilter === "new") return e.status === "sent" || e.status === "read";
    if (enquiryFilter === "responded") return e.status === "responded";
    return true;
  });

  const tabBtn = (t: "properties" | "enquiries", label: string) => (
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
      {label}
    </button>
  );

  return (
    <div className="page">
      <div className="container">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h1>My Dashboard</h1>
          <Link to="/landlord/property/new">
            <button className="btn-primary">+ Add Property</button>
          </Link>
        </div>

        <div className="card stack" style={{ marginBottom: "1.25rem" }}>
          <h3>My Profile</h3>
          {editingProfile ? (
            <div className="stack" style={{ gap: "0.5rem" }}>
              <label style={{ fontSize: "0.85rem" }}>
                Full Name
                <input
                  type="text"
                  value={profileEditForm.full_name}
                  onChange={(e) => setProfileEditForm((f) => ({ ...f, full_name: e.target.value }))}
                />
              </label>
              <label style={{ fontSize: "0.85rem" }}>
                Phone
                <input
                  type="text"
                  value={profileEditForm.phone}
                  onChange={(e) => setProfileEditForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </label>
              {profileSaveError && <p className="error">{profileSaveError}</p>}
              <div className="row" style={{ gap: "0.5rem" }}>
                <button className="btn-primary" style={{ fontSize: "0.85rem" }} onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save"}
                </button>
                <button className="btn-outline" style={{ fontSize: "0.85rem" }} onClick={() => setEditingProfile(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p><strong>Name:</strong> {landlordProfile.full_name}</p>
              <p><strong>Email:</strong> {landlordProfile.email}</p>
              <p><strong>Phone:</strong> {landlordProfile.phone || "—"}</p>
              <button className="btn-outline" style={{ fontSize: "0.8rem", alignSelf: "flex-start" }} onClick={startEditProfile}>
                Edit Profile
              </button>
            </>
          )}
        </div>

        {(landlordStatus === "pending" || landlordStatus === "rejected") && (
          <div style={{ background: landlordStatus === "rejected" ? "#fee2e2" : "#fef3c7", border: `1px solid ${landlordStatus === "rejected" ? "#f87171" : "#f59e0b"}`, borderRadius: "var(--radius)", padding: "1rem 1.25rem", marginBottom: "1.25rem" }} className="stack">
            <div>
              <strong style={{ color: landlordStatus === "rejected" ? "#991b1b" : "#92400e" }}>
                {landlordStatus === "rejected" ? "Account rejected." : "Account pending verification."}
              </strong>
              <span style={{ color: landlordStatus === "rejected" ? "#991b1b" : "#92400e", fontSize: "0.9rem" }}>
                {" "}{landlordStatus === "rejected"
                  ? "Your verification was rejected. Please upload a valid ownership document."
                  : "Your properties are hidden from students until verified. Upload your ownership document to speed up the process."}
              </span>
            </div>
            {ownershipDocKey && (
              <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: landlordStatus === "rejected" ? "#991b1b" : "#92400e" }}>✓ Document on file</span>
                <button className="btn-outline" style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem" }} onClick={viewOwnershipDoc}>View</button>
                <button style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "var(--radius)" }} onClick={deleteOwnershipDoc}>Delete</button>
              </div>
            )}
            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setDocFile(e.target.files?.[0] || null)} style={{ border: "none", padding: 0, flex: 1, minWidth: 200 }} />
              <button className="btn-primary" onClick={uploadOwnershipDoc} disabled={!docFile || uploading} style={{ fontSize: "0.85rem" }}>
                {uploading ? "Uploading..." : ownershipDocKey ? "Replace Document" : "Upload Ownership Doc"}
              </button>
            </div>
            {uploadMsg && <p style={{ fontSize: "0.85rem", color: "var(--maroon)" }}>{uploadMsg}</p>}
          </div>
        )}

        {landlordStatus === "verified" && ownershipDocKey && (
          <div className="row" style={{ gap: "0.5rem", alignItems: "center", marginBottom: "1.25rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            <span>Ownership document on file.</span>
            <button className="btn-outline" style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem" }} onClick={viewOwnershipDoc}>View</button>
            <button style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "var(--radius)" }} onClick={deleteOwnershipDoc}>Delete</button>
          </div>
        )}

        <div className="row" style={{ marginBottom: "1.5rem", gap: "0.5rem" }}>
          {tabBtn("properties", "Properties")}
          <button
            onClick={openEnquiriesTab}
            style={{
              background: tab === "enquiries" ? "var(--maroon)" : "transparent",
              color: tab === "enquiries" ? "white" : "var(--maroon)",
              border: "1.5px solid var(--maroon)",
              borderRadius: "var(--radius)",
              padding: "0.5rem 1.2rem",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            {`Enquiries${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
          </button>
        </div>

        {loading ? <p style={{ color: "var(--text-muted)" }}>Loading...</p> : tab === "properties" ? (
          properties.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
              <h3>No properties yet</h3>
              <p style={{ color: "var(--text-muted)", margin: "0.75rem 0" }}>Add your first property to start receiving enquiries.</p>
              <Link to="/landlord/property/new"><button className="btn-primary">Add Property</button></Link>
            </div>
          ) : (
            <div className="stack">
              {properties.map((prop) => (
                <div key={prop.id} className="card" style={{ opacity: prop.is_active ? 1 : 0.7 }}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <div>
                      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                        <h3>{prop.name}</h3>
                        {!prop.is_active && <span className="badge badge-maroon">Hidden from students</span>}
                        {prop.is_su_accredited && <span className="badge badge-green">SU Accredited</span>}
                      </div>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        {prop.address}
                        {prop.distance_to_campus_m ? ` · ~${Math.round(prop.distance_to_campus_m / 83)} min walk` : ""}
                      </p>
                    </div>
                    <button
                      className="btn-outline"
                      style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                      onClick={() => editingId === prop.id ? setEditingId(null) : startEdit(prop)}
                    >
                      {editingId === prop.id ? "Close" : "Edit"}
                    </button>
                  </div>

                  {editingId === prop.id && (
                    <div className="stack" style={{ marginBottom: "1rem", padding: "1rem", background: "var(--bg)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                      <div className="grid-2">
                        <div>
                          <label>Property Name</label>
                          <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                          <label>Distance to Campus (m)</label>
                          <input type="number" value={editForm.distance_to_campus_m} onChange={(e) => setEditForm((f) => ({ ...f, distance_to_campus_m: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label>Address</label>
                        <input value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} />
                      </div>
                      <div>
                        <label>Description</label>
                        <textarea rows={2} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                      </div>
                      <div className="row" style={{ gap: "1.5rem" }}>
                        <label style={{ margin: 0, display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <input type="checkbox" checked={editForm.is_su_accredited} onChange={(e) => setEditForm((f) => ({ ...f, is_su_accredited: e.target.checked }))} style={{ width: "auto" }} />
                          SU Accredited
                        </label>
                        <label style={{ margin: 0, display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))} style={{ width: "auto" }} />
                          Visible to students
                        </label>
                      </div>
                      <div className="row" style={{ gap: "0.5rem" }}>
                        <button className="btn-primary" style={{ fontSize: "0.85rem" }} onClick={() => saveEdit(prop.id)}>Save Changes</button>
                        <button style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "var(--radius)" }} onClick={() => deleteProperty(prop.id, prop.name)}>
                          Delete Property
                        </button>
                      </div>

                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                        <label style={{ marginBottom: "0.5rem", display: "block" }}>Property Photos</label>
                        {prop.photos.length > 0 && (
                          <div className="row" style={{ flexWrap: "wrap", gap: "0.6rem", marginBottom: "0.75rem" }}>
                            {prop.photos.map((photo) => (
                              <div key={photo.id} style={{ position: "relative" }}>
                                <img
                                  src={photo.url}
                                  alt=""
                                  style={{
                                    width: 110,
                                    height: 80,
                                    objectFit: "cover",
                                    borderRadius: "var(--radius)",
                                    border: photo.is_cover ? "2px solid var(--maroon)" : "2px solid transparent",
                                  }}
                                />
                                {photo.is_cover && (
                                  <span style={{ position: "absolute", top: 2, left: 2, fontSize: "0.65rem", background: "var(--maroon)", color: "#fff", padding: "0.1rem 0.35rem", borderRadius: "var(--radius)" }}>
                                    Cover
                                  </span>
                                )}
                                <div className="row" style={{ gap: "0.25rem", marginTop: "0.25rem" }}>
                                  {!photo.is_cover && (
                                    <button
                                      style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "#fff", cursor: "pointer" }}
                                      onClick={() => setCoverPhoto(prop.id, photo.id)}
                                    >
                                      Set Cover
                                    </button>
                                  )}
                                  <button
                                    style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", border: "none", borderRadius: "var(--radius)", background: "#fee2e2", color: "#991b1b", cursor: "pointer" }}
                                    onClick={() => deletePhoto(prop.id, photo.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                          <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(e) => { setPhotoFile(e.target.files?.[0] || null); setPhotoMsg(""); }} style={{ border: "none", padding: 0, flex: 1, minWidth: 160 }} />
                          <button className="btn-primary" style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }} disabled={!photoFile || photoUploading} onClick={() => uploadPhoto(prop.id, prop.photos.length === 0)}>
                            {photoUploading ? "Uploading..." : "Add Photo"}
                          </button>
                        </div>
                        {photoMsg && <p style={{ fontSize: "0.82rem", color: "var(--maroon)", marginTop: "0.3rem" }}>{photoMsg}</p>}
                      </div>
                    </div>
                  )}

                  <div className="stack" style={{ gap: "0.5rem" }}>
                    {prop.rooms.map((room) => (
                      <div key={room.id} style={{ padding: "0.75rem 1rem", background: "var(--bg)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                        <div className="row" style={{ justifyContent: "space-between" }}>
                          <div>
                            <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{room.room_type.replace("_", "-")}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginLeft: "0.75rem" }}>R{room.price_per_month.toLocaleString()}/mo</span>
                            {room.nsfas_accepted && <span className="badge badge-yellow" style={{ marginLeft: "0.5rem" }}>NSFAS</span>}
                            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginLeft: "0.75rem" }}>{room.available_count}/{room.total_count} available</span>
                          </div>
                          <div className="row" style={{ gap: "0.4rem" }}>
                            <button
                              style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem", background: "transparent", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text-muted)" }}
                              onClick={() => editingRoomId === room.id ? setEditingRoomId(null) : startRoomEdit(room)}
                            >
                              {editingRoomId === room.id ? "Close" : "Edit"}
                            </button>
                            <button
                              onClick={() => toggleRoom(prop.id, room.id)}
                              style={{ background: room.is_available ? "#dcfce7" : "#fee2e2", color: room.is_available ? "#166534" : "#991b1b", border: "none", borderRadius: "var(--radius)", padding: "0.35rem 0.75rem", fontWeight: 600, fontSize: "0.82rem" }}
                            >
                              {room.is_available ? "Available" : "Occupied"}
                            </button>
                          </div>
                        </div>

                        {editingRoomId === room.id && (
                          <div className="stack" style={{ marginTop: "0.75rem", padding: "0.75rem", background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                            <div className="grid-2">
                              <div>
                                <label>Room Type</label>
                                <select value={roomEditForm.room_type} onChange={(e) => setRoomEditForm((f) => ({ ...f, room_type: e.target.value }))}>
                                  <option value="single">Single</option>
                                  <option value="sharing">Sharing</option>
                                  <option value="en_suite">En-suite</option>
                                </select>
                              </div>
                              <div>
                                <label>Price per Month (R)</label>
                                <input type="number" value={roomEditForm.price_per_month} onChange={(e) => setRoomEditForm((f) => ({ ...f, price_per_month: e.target.value }))} />
                              </div>
                            </div>
                            <div className="grid-2">
                              <div>
                                <label>Total Rooms</label>
                                <input type="number" min="1" value={roomEditForm.total_count} onChange={(e) => setRoomEditForm((f) => ({ ...f, total_count: e.target.value }))} />
                              </div>
                              <div>
                                <label>Available Now</label>
                                <input type="number" min="0" value={roomEditForm.available_count} onChange={(e) => setRoomEditForm((f) => ({ ...f, available_count: e.target.value }))} />
                              </div>
                            </div>
                            <div>
                              <label>Available From (optional)</label>
                              <input type="date" value={roomEditForm.available_from} min={new Date().toISOString().split("T")[0]} onChange={(e) => setRoomEditForm((f) => ({ ...f, available_from: e.target.value }))} />
                            </div>
                            <div>
                              <label style={{ marginBottom: "0.4rem" }}>Amenities</label>
                              <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                                {AMENITIES.map(({ key, label }) => (
                                  <label key={key} style={{ margin: 0, display: "flex", gap: "0.35rem", alignItems: "center", fontSize: "0.85rem" }}>
                                    <input
                                      type="checkbox"
                                      checked={!!roomEditForm.amenities[key]}
                                      onChange={(e) => setRoomEditForm((f) => ({ ...f, amenities: { ...f.amenities, [key]: e.target.checked } }))}
                                      style={{ width: "auto" }}
                                    />
                                    {label}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="row" style={{ gap: "0.5rem" }}>
                              <label style={{ margin: 0, display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.85rem" }}>
                                <input type="checkbox" checked={roomEditForm.nsfas_accepted} onChange={(e) => setRoomEditForm((f) => ({ ...f, nsfas_accepted: e.target.checked }))} style={{ width: "auto" }} />
                                NSFAS Accepted
                              </label>
                            </div>
                            <div className="row" style={{ gap: "0.5rem" }}>
                              <button className="btn-primary" style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }} onClick={() => saveRoomEdit(prop.id, room.id)}>Save Room</button>
                              <button style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "var(--radius)" }} onClick={() => deleteRoom(prop.id, room.id)}>Delete</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div>
            <div className="row" style={{ gap: "0.4rem", marginBottom: "1rem" }}>
              {(["all", "new", "responded"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setEnquiryFilter(f)}
                  style={{ fontSize: "0.82rem", padding: "0.3rem 0.75rem", background: enquiryFilter === f ? "var(--maroon)" : "transparent", color: enquiryFilter === f ? "white" : "var(--maroon)", border: "1px solid var(--maroon)", borderRadius: "var(--radius)" }}
                >
                  {f === "all" ? "All" : f === "new" ? `New${pendingCount > 0 ? ` (${pendingCount})` : ""}` : "Responded"}
                </button>
              ))}
            </div>

            {filteredEnquiries.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
                <p style={{ color: "var(--text-muted)" }}>No enquiries{enquiryFilter !== "all" ? " in this category" : " yet"}.</p>
              </div>
            ) : (
              <div className="stack">
                {filteredEnquiries.map((eq) => (
                  <div key={eq.id} className="card stack" style={{ gap: "0.75rem" }}>
                    <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div>
                        <p style={{ fontWeight: 600 }}>{eq.student_name ?? "Student"}</p>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{eq.student_email}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="row" style={{ gap: "0.4rem", justifyContent: "flex-end" }}>
                          {eq.booking_status === "accepted" && <span className="badge badge-green">Accepted</span>}
                          {eq.booking_status === "declined" && <span className="badge badge-maroon">Declined</span>}
                          {eq.booking_status === "viewing_arranged" && <span className="badge badge-yellow">Viewing</span>}
                          <span className={`badge ${eq.status === "responded" ? "badge-green" : eq.status === "read" ? "badge-yellow" : "badge-maroon"}`}>
                            {eq.status === "responded" ? "Replied" : eq.status === "read" ? "Seen" : "New"}
                          </span>
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                          {eq.property_name} · {eq.room_type?.replace("_", "-")} · R{eq.price_per_month?.toLocaleString()}/mo
                        </p>
                      </div>
                    </div>

                    <div style={{ background: "var(--bg)", padding: "0.75rem", borderRadius: "var(--radius)", fontSize: "0.9rem" }}>
                      {eq.message}
                    </div>

                    {/* Booking action buttons — only show when not yet finalised */}
                    {eq.booking_status === "enquiring" || eq.booking_status === "viewing_arranged" ? (
                      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                        <button className="btn-primary" style={{ fontSize: "0.82rem", padding: "0.35rem 0.8rem", background: "#166534" }} onClick={() => acceptEnquiry(eq.id)}>
                          Accept Student
                        </button>
                        {eq.booking_status === "enquiring" && (
                          <button className="btn-outline" style={{ fontSize: "0.82rem", padding: "0.35rem 0.8rem" }} onClick={() => arrangeViewing(eq.id)}>
                            Arrange Viewing
                          </button>
                        )}
                        <button style={{ fontSize: "0.82rem", padding: "0.35rem 0.8rem", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "var(--radius)" }} onClick={() => { setDecliningId(eq.id); setDeclineReason(""); }}>
                          Decline
                        </button>
                      </div>
                    ) : eq.booking_status === "accepted" ? (
                      <div className="stack" style={{ gap: "0.4rem" }}>
                        <p style={{ fontSize: "0.82rem", color: "#166534", fontWeight: 600 }}>Student accepted — coordinate move-in via chat.</p>
                        <button
                          style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem", background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text-muted)", alignSelf: "flex-start", cursor: "pointer" }}
                          onClick={() => cancelAcceptance(eq.id)}
                        >
                          Undo acceptance
                        </button>
                      </div>
                    ) : null}

                    {decliningId === eq.id && (
                      <div className="stack" style={{ gap: "0.5rem", padding: "0.75rem", background: "#fee2e2", borderRadius: "var(--radius)" }}>
                        <label style={{ color: "#991b1b" }}>Reason for declining (shown to student):</label>
                        <textarea rows={2} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} style={{ fontSize: "0.85rem" }} placeholder="e.g. Room no longer available, chosen another applicant..." />
                        <div className="row">
                          <button style={{ fontSize: "0.82rem", padding: "0.35rem 0.8rem", background: "#991b1b", color: "white", border: "none", borderRadius: "var(--radius)" }} onClick={() => declineEnquiry(eq.id)} disabled={!declineReason.trim()}>
                            Confirm Decline
                          </button>
                          <button className="btn-outline" style={{ fontSize: "0.82rem" }} onClick={() => setDecliningId(null)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    <button
                      className={respondingId === eq.id ? "btn-outline" : "btn-primary"}
                      style={{ alignSelf: "flex-start", fontSize: "0.85rem", padding: "0.4rem 0.9rem" }}
                      onClick={() => openChat(eq.id, eq.status)}
                    >
                      {respondingId === eq.id ? "Close chat" : eq.status === "responded" ? "View chat" : "Reply"}
                    </button>

                    {respondingId === eq.id && (
                      <ChatThread enquiryId={eq.id} senderRole="landlord" />
                    )}
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {new Date(eq.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
