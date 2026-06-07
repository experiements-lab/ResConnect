import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useSession } from "./context/SessionContext";
import Navbar from "./components/Navbar";
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import StudentDashboard from "./pages/student/Dashboard";
import Listings from "./pages/student/Listings";
import LandlordDashboard from "./pages/landlord/Dashboard";
import CreateProperty from "./pages/landlord/CreateProperty";
import PropertyDetail from "./pages/student/PropertyDetail";
import Admin from "./pages/admin/Admin";

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { session, loading } = useSession();
  if (loading) return <div className="page container">Loading...</div>;
  if (!session) return <Navigate to="/auth/login" replace />;
  const userRole = session.user?.user_metadata?.role;
  if (role && userRole !== role) {
    return <Navigate to={userRole === "student" ? "/student/dashboard" : "/landlord/dashboard"} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname === "/admin";

  return (
    <>
      {!isAdmin && <Navbar />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route path="/listings" element={<Listings />} />
        <Route path="/listings/:id" element={<PropertyDetail />} />
        <Route
          path="/student/dashboard"
          element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>}
        />
        <Route
          path="/landlord/dashboard"
          element={<ProtectedRoute role="landlord"><LandlordDashboard /></ProtectedRoute>}
        />
        <Route
          path="/landlord/property/new"
          element={<ProtectedRoute role="landlord"><CreateProperty /></ProtectedRoute>}
        />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </>
  );
}
