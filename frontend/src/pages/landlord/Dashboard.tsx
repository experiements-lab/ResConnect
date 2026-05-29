import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

interface Room {
  id: string;
  room_type: string;
  price_per_month: number;
  is_available: boolean;
  nsfas_accepted: boolean;
}

interface Property {
  id: string;
  name: string;
  address: string;
  is_su_accredited: boolean;
  rooms: Room[];
}

export default function LandlordDashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/properties/").then((r) => setProperties(r.data)).finally(() => setLoading(false));
  }, []);

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

  return (
    <div className="page">
      <div className="container">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h1>My Properties</h1>
          <Link to="/landlord/property/new">
            <button className="btn-primary">+ Add Property</button>
          </Link>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : properties.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <h3>No properties yet</h3>
            <p style={{ color: "var(--text-muted)", margin: "0.75rem 0" }}>
              Add your first property to start receiving enquiries from verified students.
            </p>
            <Link to="/landlord/property/new">
              <button className="btn-primary">Add Property</button>
            </Link>
          </div>
        ) : (
          <div className="stack">
            {properties.map((prop) => (
              <div key={prop.id} className="card">
                <div className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div>
                    <h3>{prop.name}</h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{prop.address}</p>
                  </div>
                  {prop.is_su_accredited && <span className="badge badge-green">SU Accredited</span>}
                </div>

                <div className="stack" style={{ gap: "0.5rem" }}>
                  {prop.rooms.map((room) => (
                    <div
                      key={room.id}
                      style={{
                        padding: "0.75rem 1rem",
                        background: "var(--bg)",
                        borderRadius: "var(--radius)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
                          {room.room_type.replace("_", "-")}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginLeft: "0.75rem" }}>
                          R{room.price_per_month.toLocaleString()}/month
                        </span>
                        {room.nsfas_accepted && (
                          <span className="badge badge-yellow" style={{ marginLeft: "0.5rem" }}>NSFAS</span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleRoom(prop.id, room.id)}
                        style={{
                          background: room.is_available ? "#d1fae5" : "#fee2e2",
                          color: room.is_available ? "#065f46" : "#991b1b",
                          border: "none",
                          borderRadius: "var(--radius)",
                          padding: "0.4rem 0.9rem",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                        }}
                      >
                        {room.is_available ? "Available" : "Occupied"} · Toggle
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
