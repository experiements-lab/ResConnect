import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

interface Room {
  id: string;
  room_type: string;
  price_per_month: number;
  nsfas_accepted: boolean;
  is_available: boolean;
  amenities: Record<string, boolean>;
  available_from: string | null;
}

interface Property {
  id: string;
  name: string;
  address: string;
  distance_to_campus_m: number | null;
  is_su_accredited: boolean;
  rooms: Room[];
  cover_photo_url: string | null;
}

const AMENITY_LABELS: Record<string, string> = {
  wifi: "WiFi",
  water_included: "Water incl.",
  electricity_included: "Electricity incl.",
  laundry: "Laundry",
  parking: "Parking",
  security: "Security",
  kitchen: "Kitchen",
};

export default function PropertyCard({
  property,
  isVerified = false,
  enquiredRoomIds,
}: {
  property: Property;
  isVerified?: boolean;
  enquiredRoomIds?: Set<string>;
}) {
  const [enquiring, setEnquiring] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<Set<string>>(new Set(enquiredRoomIds ?? []));
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const availableRooms = property.rooms.filter((r) => r.is_available);
  const minPrice = availableRooms.length > 0 ? Math.min(...availableRooms.map((r) => r.price_per_month)) : null;

  const sendEnquiry = async (roomId: string) => {
    if (!message.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await api.post("/enquiries/", { room_id: roomId, message });
      setSent((prev) => new Set([...prev, roomId]));
      setEnquiring(null);
      setMessage("");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { detail?: string } } })?.response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (status === 403) setSendError("Your account must be verified to send enquiries.");
      else if (status === 409) setSendError("You have already enquired on this room.");
      else setSendError(detail ?? "Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

  const amenityChips = (amenities: Record<string, boolean>) => {
    const active = Object.entries(amenities)
      .filter(([, v]) => v)
      .map(([k]) => AMENITY_LABELS[k] ?? k);
    if (active.length === 0) return null;
    const visible = active.slice(0, 4);
    const extra = active.length - visible.length;
    return (
      <div className="row" style={{ flexWrap: "wrap", gap: "0.3rem", marginTop: "0.3rem" }}>
        {visible.map((label) => (
          <span key={label} style={{ fontSize: "0.72rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.1rem 0.45rem", color: "var(--text-muted)" }}>
            {label}
          </span>
        ))}
        {extra > 0 && (
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>+{extra} more</span>
        )}
      </div>
    );
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {property.cover_photo_url ? (
        <img
          src={property.cover_photo_url}
          alt={property.name}
          style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: "var(--radius)", marginBottom: "0.25rem" }}
        />
      ) : (
        <div style={{ width: "100%", height: 100, background: "#e8e3dd", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          No photo
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <Link to={`/listings/${property.id}`} style={{ textDecoration: "none" }}>
          <h3 style={{ fontSize: "1rem", color: "var(--maroon)" }}>{property.name}</h3>
        </Link>
        {property.is_su_accredited && <span className="badge badge-green">SU Accredited</span>}
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
        {property.address}
        {property.distance_to_campus_m
          ? ` · ~${Math.round(property.distance_to_campus_m / 83)} min walk`
          : ""}
      </p>

      {minPrice !== null ? (
        <p style={{ fontWeight: 700, color: "var(--maroon)" }}>From R{minPrice.toLocaleString()}/month</p>
      ) : (
        <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No rooms available</p>
      )}

      <div className="stack" style={{ gap: "0.5rem" }}>
        {property.rooms.map((room) => (
          <div key={room.id} style={{ padding: "0.5rem 0.75rem", background: "var(--bg)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: "0.9rem", textTransform: "capitalize" }}>
                {room.room_type.replace("_", "-")}
              </span>
              <div className="row" style={{ gap: "0.4rem" }}>
                {room.nsfas_accepted && <span className="badge badge-yellow">NSFAS</span>}
                <span className={`badge ${room.is_available ? "badge-green" : "badge-maroon"}`}>
                  {room.is_available ? "Available" : "Occupied"}
                </span>
              </div>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>R{room.price_per_month.toLocaleString()}/month</p>
            {room.available_from && (
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Available from {formatDate(room.available_from)}
              </p>
            )}
            {amenityChips(room.amenities)}

            {room.is_available && (
              sent.has(room.id) ? (
                <span className="badge badge-green" style={{ marginTop: "0.4rem", display: "inline-block" }}>
                  Enquiry sent
                </span>
              ) : !isVerified ? (
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.4rem", fontStyle: "italic" }}>
                  Verify your account to enquire
                </p>
              ) : enquiring === room.id ? (
                <div style={{ marginTop: "0.5rem" }} className="stack">
                  <textarea
                    rows={3}
                    placeholder="Hi, I am interested in this room..."
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); setSendError(null); }}
                    style={{ fontSize: "0.85rem" }}
                  />
                  {sendError && <p className="error" style={{ marginTop: 0 }}>{sendError}</p>}
                  <div className="row">
                    <button
                      className="btn-primary"
                      style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}
                      onClick={() => sendEnquiry(room.id)}
                      disabled={sending || !message.trim()}
                    >
                      {sending ? "Sending..." : "Send"}
                    </button>
                    <button className="btn-outline" style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }} onClick={() => { setEnquiring(null); setSendError(null); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn-primary"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", marginTop: "0.4rem" }}
                  onClick={() => { setEnquiring(room.id); setSendError(null); }}
                >
                  Enquire
                </button>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
