import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useSession } from "../../context/SessionContext";
import ChatThread from "../../components/ChatThread";

const AMENITY_LABELS: Record<string, string> = {
  wifi: "WiFi",
  water_included: "Water incl.",
  electricity_included: "Electricity incl.",
  laundry: "Laundry",
  parking: "Parking",
  security: "Security",
  kitchen: "Kitchen",
};

interface Room {
  id: string;
  room_type: string;
  price_per_month: number;
  nsfas_accepted: boolean;
  is_available: boolean;
  amenities: Record<string, boolean>;
  available_from: string | null;
  total_count: number;
  available_count: number;
}

interface Property {
  id: string;
  name: string;
  address: string;
  description: string | null;
  distance_to_campus_m: number | null;
  is_su_accredited: boolean;
  rooms: Room[];
  cover_photo_url: string | null;
}

interface Enquiry {
  id: string;
  room_id: string;
  status: string;
  message: string;
}

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [enquiring, setEnquiring] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<string | null>(null);

  const isStudent = session?.user?.user_metadata?.role === "student";

  useEffect(() => {
    api.get(`/properties/${id}`)
      .then((r) => setProperty(r.data))
      .catch(() => navigate("/listings"))
      .finally(() => setLoading(false));

    if (isStudent) {
      api.get("/students/me")
        .then((r) => setIsVerified(r.data.verification_status === "verified"))
        .catch(() => {});
      api.get("/enquiries/me")
        .then((r) => setEnquiries(r.data.filter((e: Enquiry & { property_id: string }) => e.property_id === id)))
        .catch(() => {});
    }
  }, [id, isStudent, navigate]);

  const sendEnquiry = async (roomId: string) => {
    if (!message.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const { data } = await api.post("/enquiries/", { room_id: roomId, message });
      setEnquiries((prev) => [...prev, data]);
      setMessage("");
      setEnquiring(null);
      setActiveChat(data.id);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) setSendError("Your account must be verified to send enquiries.");
      else if (status === 409) setSendError("You have already enquired on this room.");
      else setSendError("Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

  if (loading) return <div className="page container"><p style={{ color: "var(--text-muted)" }}>Loading...</p></div>;
  if (!property) return null;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 820 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", color: "var(--maroon)", fontWeight: 600, padding: 0, marginBottom: "1rem", cursor: "pointer", fontSize: "0.9rem" }}
        >
          Back to listings
        </button>

        {property.cover_photo_url && (
          <img
            src={property.cover_photo_url}
            alt={property.name}
            style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: "var(--radius)", marginBottom: "1.5rem" }}
          />
        )}

        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <h1 style={{ fontSize: "1.6rem" }}>{property.name}</h1>
          <div className="row" style={{ gap: "0.5rem" }}>
            {property.is_su_accredited && <span className="badge badge-green">SU Accredited</span>}
          </div>
        </div>

        <p style={{ color: "var(--text-muted)", marginBottom: "0.25rem" }}>
          {property.address}
          {property.distance_to_campus_m
            ? ` · ~${Math.round(property.distance_to_campus_m / 83)} min walk to campus`
            : ""}
        </p>

        {property.description && (
          <p style={{ marginTop: "1rem", lineHeight: 1.7, color: "var(--text)" }}>{property.description}</p>
        )}

        <h2 style={{ marginTop: "2rem", marginBottom: "1rem", fontSize: "1.15rem" }}>Available Rooms</h2>

        <div className="stack">
          {property.rooms.map((room) => {
            const existingEnquiry = enquiries.find((e) => e.room_id === room.id);
            const amenities = Object.entries(room.amenities).filter(([, v]) => v).map(([k]) => AMENITY_LABELS[k] ?? k);

            return (
              <div key={room.id} className="card stack" style={{ gap: "0.75rem" }}>
                <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: "1rem", textTransform: "capitalize" }}>
                      {room.room_type.replace("_", "-")}
                    </span>
                    <span style={{ color: "var(--text-muted)", marginLeft: "0.75rem" }}>
                      R{room.price_per_month.toLocaleString()}/month
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginLeft: "0.75rem" }}>
                      {room.available_count}/{room.total_count} available
                    </span>
                  </div>
                  <div className="row" style={{ gap: "0.4rem" }}>
                    {room.nsfas_accepted && <span className="badge badge-yellow">NSFAS</span>}
                    <span className={`badge ${room.is_available ? "badge-green" : "badge-maroon"}`}>
                      {room.is_available ? "Available" : "Occupied"}
                    </span>
                  </div>
                </div>

                {room.available_from && (
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Available from {formatDate(room.available_from)}
                  </p>
                )}

                {amenities.length > 0 && (
                  <div className="row" style={{ flexWrap: "wrap", gap: "0.3rem" }}>
                    {amenities.map((label) => (
                      <span key={label} style={{ fontSize: "0.75rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.15rem 0.5rem", color: "var(--text-muted)" }}>
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                {isStudent && room.is_available && (
                  existingEnquiry ? (
                    <div>
                      <div className="row" style={{ gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <span className="badge badge-green">Enquiry sent</span>
                        <button
                          className="btn-primary"
                          style={{ fontSize: "0.82rem", padding: "0.35rem 0.8rem" }}
                          onClick={() => setActiveChat(activeChat === existingEnquiry.id ? null : existingEnquiry.id)}
                        >
                          {activeChat === existingEnquiry.id ? "Close chat" : "Open chat"}
                        </button>
                      </div>
                      {activeChat === existingEnquiry.id && (
                        <ChatThread enquiryId={existingEnquiry.id} senderRole="student" />
                      )}
                    </div>
                  ) : isVerified ? (
                    enquiring === room.id ? (
                      <div className="stack" style={{ gap: "0.5rem" }}>
                        <textarea
                          rows={3}
                          placeholder="Hi, I am interested in this room..."
                          value={message}
                          onChange={(e) => { setMessage(e.target.value); setSendError(null); }}
                          style={{ fontSize: "0.9rem" }}
                          autoFocus
                        />
                        {sendError && <p className="error" style={{ marginTop: 0 }}>{sendError}</p>}
                        <div className="row">
                          <button className="btn-primary" style={{ fontSize: "0.88rem" }} onClick={() => sendEnquiry(room.id)} disabled={sending || !message.trim()}>
                            {sending ? "Sending..." : "Send Enquiry"}
                          </button>
                          <button className="btn-outline" style={{ fontSize: "0.88rem" }} onClick={() => { setEnquiring(null); setSendError(null); }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn-primary" style={{ alignSelf: "flex-start", fontSize: "0.88rem" }} onClick={() => setEnquiring(room.id)}>
                        Enquire about this room
                      </button>
                    )
                  ) : (
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                      Verify your account to enquire
                    </p>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
