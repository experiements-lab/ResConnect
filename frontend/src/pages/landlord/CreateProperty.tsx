import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

const AMENITIES = [
  { key: "wifi", label: "WiFi" },
  { key: "water_included", label: "Water incl." },
  { key: "electricity_included", label: "Electricity incl." },
  { key: "laundry", label: "Laundry" },
  { key: "parking", label: "Parking" },
  { key: "security", label: "Security" },
  { key: "kitchen", label: "Kitchen" },
];

interface RoomForm {
  room_type: string;
  price_per_month: string;
  nsfas_accepted: boolean;
  total_count: string;
  available_from: string;
  amenities: Record<string, boolean>;
}

const newRoom = (): RoomForm => ({
  room_type: "single",
  price_per_month: "",
  nsfas_accepted: false,
  total_count: "1",
  available_from: "",
  amenities: {},
});

export default function CreateProperty() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [distanceM, setDistanceM] = useState("");
  const [isSuAccredited, setIsSuAccredited] = useState(false);
  const [rooms, setRooms] = useState<RoomForm[]>([newRoom()]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const addRoom = () => setRooms((r) => [...r, newRoom()]);

  const updateRoom = (i: number, field: keyof RoomForm, value: string | boolean | Record<string, boolean>) =>
    setRooms((r) => r.map((room, idx) => idx === i ? { ...room, [field]: value } : room));

  const toggleAmenity = (i: number, key: string, checked: boolean) =>
    setRooms((r) => r.map((room, idx) => idx === i ? { ...room, amenities: { ...room.amenities, [key]: checked } } : room));

  const removeRoom = (i: number) => setRooms((r) => r.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/properties/", {
        name,
        address,
        description: description || null,
        distance_to_campus_m: distanceM ? parseInt(distanceM) : null,
        is_su_accredited: isSuAccredited,
        rooms: rooms.map((r) => ({
          room_type: r.room_type,
          price_per_month: parseInt(r.price_per_month),
          nsfas_accepted: r.nsfas_accepted,
          total_count: parseInt(r.total_count),
          available_count: parseInt(r.total_count),
          available_from: r.available_from || null,
          amenities: r.amenities,
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
              <label>Distance to Campus (metres)</label>
              <input type="number" value={distanceM} onChange={(e) => setDistanceM(e.target.value)} placeholder="e.g. 800 (approx. 10 min walk)" />
            </div>
            <div>
              <label>Description</label>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the property..." />
            </div>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: 0 }}>
              <input type="checkbox" checked={isSuAccredited} onChange={(e) => setIsSuAccredited(e.target.checked)} style={{ width: "auto" }} />
              SU Accredited accommodation
            </label>
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
                    <input type="number" value={room.price_per_month} onChange={(e) => updateRoom(i, "price_per_month", e.target.value)} placeholder="5500" required />
                  </div>
                </div>
                <div className="grid-2">
                  <div>
                    <label>Number of Rooms</label>
                    <input type="number" min="1" value={room.total_count} onChange={(e) => updateRoom(i, "total_count", e.target.value)} />
                  </div>
                  <div>
                    <label>Available From (optional)</label>
                    <input type="date" value={room.available_from} min={new Date().toISOString().split("T")[0]} onChange={(e) => updateRoom(i, "available_from", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ marginBottom: "0.4rem" }}>Amenities</label>
                  <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                    {AMENITIES.map(({ key, label }) => (
                      <label key={key} style={{ margin: 0, display: "flex", gap: "0.35rem", alignItems: "center", fontSize: "0.85rem" }}>
                        <input type="checkbox" checked={!!room.amenities[key]} onChange={(e) => toggleAmenity(i, key, e.target.checked)} style={{ width: "auto" }} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: 0, fontSize: "0.85rem" }}>
                  <input type="checkbox" checked={room.nsfas_accepted} onChange={(e) => updateRoom(i, "nsfas_accepted", e.target.checked)} style={{ width: "auto" }} />
                  NSFAS Accepted
                </label>
                {rooms.length > 1 && (
                  <button type="button" onClick={() => removeRoom(i)} style={{ background: "#fee2e2", color: "#991b1b", alignSelf: "flex-start", fontSize: "0.8rem", padding: "0.3rem 0.7rem", border: "none", borderRadius: "var(--radius)" }}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {rooms.length === 0 && (
            <p style={{ color: "#e53e3e", fontSize: "0.85rem" }}>Add at least one room type before creating the property.</p>
          )}
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={submitting || rooms.length === 0}>
            {submitting ? "Creating..." : "Create Property"}
          </button>
        </form>
      </div>
    </div>
  );
}
