import { useState } from "react";
import { api } from "../lib/api";

interface Room {
  id: string;
  room_type: string;
  price_per_month: number;
  nsfas_accepted: boolean;
  is_available: boolean;
  amenities: Record<string, boolean>;
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

export default function PropertyCard({ property }: { property: Property }) {
  const [enquiring, setEnquiring] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  const availableRooms = property.rooms.filter((r) => r.is_available);
  const minPrice = availableRooms.length > 0 ? Math.min(...availableRooms.map((r) => r.price_per_month)) : null;

  const sendEnquiry = async (roomId: string) => {
    if (!message.trim()) return;
    await api.post("/enquiries/", { room_id: roomId, message });
    setSent(roomId);
    setEnquiring(null);
    setMessage("");
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
        <div style={{ width: "100%", height: 120, background: "#e2e8f0", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
          No photo
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ fontSize: "1rem" }}>{property.name}</h3>
        {property.is_su_accredited && <span className="badge badge-green">SU Accredited</span>}
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
        {property.address}
        {property.distance_to_campus_m && ` · ${(property.distance_to_campus_m / 1000).toFixed(1)}km to campus`}
      </p>

      {minPrice !== null ? (
        <p style={{ fontWeight: 700, color: "var(--green)" }}>From R{minPrice.toLocaleString()}/month</p>
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

            {room.is_available && (
              sent === room.id ? (
                <p style={{ color: "var(--green)", fontSize: "0.85rem", marginTop: "0.4rem" }}>Enquiry sent!</p>
              ) : enquiring === room.id ? (
                <div style={{ marginTop: "0.5rem" }} className="stack" style2={{ gap: "0.4rem" }}>
                  <textarea
                    rows={3}
                    placeholder="Hi, I'm interested in this room..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    style={{ fontSize: "0.85rem" }}
                  />
                  <div className="row">
                    <button className="btn-primary" style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }} onClick={() => sendEnquiry(room.id)}>Send</button>
                    <button className="btn-outline" style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }} onClick={() => setEnquiring(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn-primary"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", marginTop: "0.4rem" }}
                  onClick={() => setEnquiring(room.id)}
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
