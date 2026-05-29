import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./hooks/useSession";
import Navbar from "./components/Navbar";
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import StudentDashboard from "./pages/student/Dashboard";
import Listings from "./pages/student/Listings";
import LandlordDashboard from "./pages/landlord/Dashboard";
import CreateProperty from "./pages/landlord/CreateProperty";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  if (loading) return <div className="page container">Loading...</div>;
  if (!session) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route path="/listings" element={<Listings />} />
        <Route
          path="/student/dashboard"
          element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>}
        />
        <Route
          path="/landlord/dashboard"
          element={<ProtectedRoute><LandlordDashboard /></ProtectedRoute>}
        />
        <Route
          path="/landlord/property/new"
          element={<ProtectedRoute><CreateProperty /></ProtectedRoute>}
        />
      </Routes>
    </>
  );
}
