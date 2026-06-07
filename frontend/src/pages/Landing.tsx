import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="page">
      <div className="container">

        {/* Hero */}
        <div style={{ textAlign: "center", padding: "4rem 0 3rem" }}>
          <p style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.1em", color: "var(--gold)", textTransform: "uppercase", marginBottom: "0.75rem" }}>
            Stellenbosch University
          </p>
          <h1 style={{ fontSize: "2.6rem", fontWeight: 800, color: "var(--maroon)", marginBottom: "1rem", lineHeight: 1.2 }}>
            Student housing,<br />done properly.
          </h1>
          <p style={{ fontSize: "1.1rem", color: "var(--text-muted)", maxWidth: 500, margin: "0 auto 2rem" }}>
            Real-time availability. Verified landlords. Enquire directly. No cold calls, no scams.
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

        {/* Feature cards */}
        <div className="grid-3" style={{ marginTop: "1rem" }}>
          {[
            {
              title: "Real-time availability",
              desc: "See which rooms are open right now, updated directly by landlords, not aggregated from old listings.",
            },
            {
              title: "Verified landlords",
              desc: "Every landlord submits proof of ownership before going live. SU-accredited properties are clearly badged.",
            },
            {
              title: "Direct enquiries",
              desc: "Message landlords in-app. No middlemen, no Facebook groups, no phone numbers exchanged upfront.",
            },
          ].map((f) => (
            <div key={f.title} className="card" style={{ borderTop: "3px solid var(--maroon)" }}>
              <h3 style={{ marginBottom: "0.5rem", color: "var(--maroon)", fontSize: "1rem" }}>{f.title}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Landlord CTA */}
        <div style={{
          marginTop: "3rem",
          padding: "2.5rem 2rem",
          background: "var(--maroon)",
          borderRadius: "var(--radius)",
          color: "white",
          textAlign: "center",
          borderBottom: "4px solid var(--gold)",
        }}>
          <h2 style={{ marginBottom: "0.5rem", fontWeight: 700 }}>Are you a landlord?</h2>
          <p style={{ opacity: 0.85, marginBottom: "1.5rem", maxWidth: 420, margin: "0 auto 1.5rem" }}>
            List your property for free. Receive enquiries from verified SU students only.
          </p>
          <Link to="/auth/register">
            <button style={{ background: "var(--gold)", color: "white", fontWeight: 700, padding: "0.7rem 1.8rem", fontSize: "0.95rem" }}>
              Register as Landlord
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
}
