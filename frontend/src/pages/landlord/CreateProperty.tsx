import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

interface RoomForm {
  room_type: string;
  price_per_month: string;
  nsfas_accepted: boolean;
  total_count: string;
}

export default function CreateProperty() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [distanceM, setDistanceM] = useState("");
  const [rooms, setRooms] = useState<RoomForm[]>([
    { room_type: "single", price_per_month: "", nsfas_accepted: false, total_count: "1" },
  ]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const addRoom = () =>
    setRooms((r) => [...r, { room_type: "single", price_per_month: "", nsfas_accepted: false, total_count: "1" }]);

  const updateRoom = (i: number, field: keyof RoomForm, value: string | boolean) =>
    setRooms((r) => r.map((room, idx) => idx === i ? { ...room, [field]: value } : room));

  const removeRoom = (i: number) => setRooms((r) => r.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/properties/", {
        name,
        address,
        description,
        distance_to_campus_m: distanceM ? parseInt(distanceM) : null,
        rooms: rooms.map((r) => ({
          room_type: r.room_type,
          price_per_month: parseInt(r.price_per_month),
          nsfas_accepted: r.nsfas_accepted,
          total_count: parseInt(r.total_count),
          available_count: parseInt(r.total_count),
        })),
      });
      navigate("/landlord/dashboard");
    } catch {
      setError("Failed to create property. Please check your details.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 680 }}>
        <h1 style={{ marginBottom: "1.5rem" }}>Add a Property</h1>
        <form onSubmit={handleSubmit} className="stack">
          <div className="card stack">
            <h3>Property Details</h3>
            <div>
              <label>Property Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ou Meul Student House" required />
            </div>
            <div>
              <label>Street Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Victoria St, Stellenbosch" required />
            </div>
            <div>
              <label>Walking Distance to Campus (metres)</label>
              <input type="number" value={distanceM} onChange={(e) => setDistanceM(e.target.value)} placeholder="e.g. 800" />
            </div>
            <div>
              <label>Description</label>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the property..." />
            </div>
          </div>

          <div className="card stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3>Rooms</h3>
              <button type="button" className="btn-outline" onClick={addRoom} style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>
                + Add Room Type
              </button>
            </div>

            {rooms.map((room, i) => (
              <div key={i} style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "var(--radius)" }} className="stack">
                <div className="grid-2">
                  <div>
                    <label>Room Type</label>
                    <select value={room.room_type} onChange={(e) => updateRoom(i, "room_type", e.target.value)}>
                      <option value="single">Single</option>
                      <option value="sharing">Sharing</option>
                      <option value="en_suite">En-suite</option>
                    </select>
                  </div>
                  <div>
                    <label>Price per Month (R)</label>
                    <input
                      type="number"
                      value={room.price_per_month}
                      onChange={(e) => updateRoom(i, "price_per_month", e.target.value)}
                      placeholder="5500"
                      required
                    />
                  </div>
                </div>
                <div className="grid-2">
                  <div>
                    <label>Number of Rooms</label>
                    <input
                      type="number"
                      min="1"
                      value={room.total_count}
                      onChange={(e) => updateRoom(i, "total_count", e.target.value)}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "0.1rem" }}>
                    <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={room.nsfas_accepted}
                        onChange={(e) => updateRoom(i, "nsfas_accepted", e.target.checked)}
                        style={{ width: "auto" }}
                      />
                      NSFAS Accepted
                    </label>
                  </div>
                </div>
                {rooms.length > 1 && (
                  <button type="button" onClick={() => removeRoom(i)} style={{ background: "#fee2e2", color: "#991b1b", alignSelf: "flex-start", fontSize: "0.8rem", padding: "0.3rem 0.7rem" }}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Creating..." : "Create Property"}
          </button>
        </form>
      </div>
    </div>
  );
}
