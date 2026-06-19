import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api";
import { useSession } from "../../context/SessionContext";
import PropertyCard from "../../components/PropertyCard";

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

export default function Listings() {
  const { session } = useSession();
  const isStudent = session?.user?.user_metadata?.role === "student";

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [enquiredRoomIds, setEnquiredRoomIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    max_price: "",
    room_type: "",
    nsfas_only: false,
    max_distance_m: "",
    su_accredited_only: false,
    amenities: new Set<string>(),
  });

  const toggleAmenity = (key: string) => {
    setFilters((f) => {
      const next = new Set(f.amenities);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...f, amenities: next };
    });
  };

  useEffect(() => {
    if (!isStudent) return;
    api.get("/students/me")
      .then((r) => setIsVerified(r.data.verification_status === "verified"))
      .catch(() => {});
    api.get("/enquiries/me")
      .then((r) => setEnquiredRoomIds(new Set(r.data.map((e: { room_id: string }) => e.room_id))))
      .catch(() => {});
  }, [isStudent]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const params = new URLSearchParams();
    if (filters.max_price) params.set("max_price", filters.max_price);
    if (filters.room_type) params.set("room_type", filters.room_type);
    if (filters.nsfas_only) params.set("nsfas_only", "true");
    if (filters.max_distance_m) params.set("max_distance_m", filters.max_distance_m);
    if (filters.su_accredited_only) params.set("su_accredited_only", "true");
    if (filters.amenities.size > 0) params.set("amenities", Array.from(filters.amenities).join(","));
    try {
      const qs = params.toString();
      const { data } = await api.get(qs ? `/properties/?${qs}` : "/properties/");
      setProperties(data);
    } catch {
      setProperties([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Debounced reactive filters — no Search button needed
  useEffect(() => {
    const t = setTimeout(fetchListings, 400);
    return () => clearTimeout(t);
  }, [fetchListings]);

  return (
    <div className="page">
      <div className="container">
        <h1 style={{ marginBottom: "1.5rem" }}>Available Accommodation</h1>

        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label>Max Price (R/month)</label>
              <input
                type="number"
                placeholder="e.g. 6000"
                value={filters.max_price}
                onChange={(e) => setFilters((f) => ({ ...f, max_price: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label>Room Type</label>
              <select value={filters.room_type} onChange={(e) => setFilters((f) => ({ ...f, room_type: e.target.value }))}>
                <option value="">All types</option>
                <option value="single">Single</option>
                <option value="sharing">Sharing</option>
                <option value="en_suite">En-suite</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label>Max Distance</label>
              <select value={filters.max_distance_m} onChange={(e) => setFilters((f) => ({ ...f, max_distance_m: e.target.value }))}>
                <option value="">Any distance</option>
                <option value="415">5 min walk</option>
                <option value="830">10 min walk</option>
                <option value="1660">20 min walk</option>
                <option value="4150">50 min walk</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <label style={{ margin: 0, display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={filters.nsfas_only}
                  onChange={(e) => setFilters((f) => ({ ...f, nsfas_only: e.target.checked }))}
                  style={{ width: "auto" }}
                />
                NSFAS only
              </label>
              <label style={{ margin: 0, display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={filters.su_accredited_only}
                  onChange={(e) => setFilters((f) => ({ ...f, su_accredited_only: e.target.checked }))}
                  style={{ width: "auto" }}
                />
                SU Accredited
              </label>
            </div>
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: "0.75rem", marginTop: "0.85rem" }}>
            {AMENITIES.map((a) => (
              <label key={a.key} style={{ margin: 0, display: "flex", gap: "0.4rem", alignItems: "center", fontSize: "0.85rem" }}>
                <input
                  type="checkbox"
                  checked={filters.amenities.has(a.key)}
                  onChange={() => toggleAmenity(a.key)}
                  style={{ width: "auto" }}
                />
                {a.label}
              </label>
            ))}
          </div>
        </div>

        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading listings...</p>
        ) : loadError ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <p className="error">Couldn't load listings. Please check your connection and try again.</p>
            <button className="btn-outline" style={{ marginTop: "1rem" }} onClick={fetchListings}>Retry</button>
          </div>
        ) : properties.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <p style={{ color: "var(--text-muted)" }}>No properties match your filters.</p>
          </div>
        ) : (
          <div className="grid-3">
            {properties.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                isVerified={isVerified}
                enquiredRoomIds={enquiredRoomIds}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
