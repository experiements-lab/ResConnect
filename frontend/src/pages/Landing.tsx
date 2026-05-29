import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="page">
      <div className="container">
        <div style={{ textAlign: "center", padding: "4rem 0 3rem" }}>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--green)", marginBottom: "1rem" }}>
            Find student housing in Stellenbosch
          </h1>
          <p style={{ fontSize: "1.15rem", color: "var(--text-muted)", maxWidth: 540, margin: "0 auto 2rem" }}>
            Real-time availability. Verified landlords. No cold calls. No scams.
          </p>
          <div className="row" style={{ justifyContent: "center", gap: "1rem" }}>
            <Link to="/listings">
              <button className="btn-primary" style={{ fontSize: "1rem", padding: "0.8rem 2rem" }}>
                Browse Listings
              </button>
            </Link>
            <Link to="/auth/register">
              <button className="btn-outline" style={{ fontSize: "1rem", padding: "0.8rem 2rem" }}>
                List a Property
              </button>
            </Link>
          </div>
        </div>

        <div className="grid-3" style={{ marginTop: "1rem" }}>
          {[
            { icon: "🔍", title: "Real-time availability", desc: "See which rooms are open right now — updated by landlords directly." },
            { icon: "✅", title: "Verified landlords", desc: "Every landlord uploads proof of ownership. SU-accredited properties are badged." },
            { icon: "💬", title: "Direct messaging", desc: "Enquire in-app. No cold calls, no Facebook Marketplace, no scams." },
          ].map((f) => (
            <div key={f.title} className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{f.icon}</div>
              <h3 style={{ marginBottom: "0.5rem" }}>{f.title}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{f.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "3rem", padding: "2rem", background: "var(--green)", borderRadius: "var(--radius)", color: "white", textAlign: "center" }}>
          <h2 style={{ marginBottom: "0.5rem" }}>Are you a landlord?</h2>
          <p style={{ opacity: 0.85, marginBottom: "1.25rem" }}>
            List your property for free. Get enquiries from verified SU students only.
          </p>
          <Link to="/auth/register">
            <button style={{ background: "white", color: "var(--green)", fontWeight: 700 }}>
              Register as Landlord
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
