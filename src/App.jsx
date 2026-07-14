import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import StudentDashboard from "./pages/StudentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Navbar from "./components/Navbar";

function ProtectedRoute({ children }) {
  const { user, loading, mustResetPassword } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && mustResetPassword) return <Navigate to="/reset-password" />;
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin, mustResetPassword } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  if (mustResetPassword) return <Navigate to="/reset-password" />;
  if (!isAdmin) return <Navigate to="/" />;
  return children;
}

function ResetPasswordRoute({ children }) {
  const { user, loading, mustResetPassword } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  if (!mustResetPassword) return <Navigate to="/" />;
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );
}

function AppRoutes() {
  const { user, mustResetPassword } = useAuth();

  return (
    <>
      {user && !mustResetPassword && <Navbar />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/reset-password"
          element={
            <ResetPasswordRoute>
              <ResetPasswordPage />
            </ResetPasswordRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/summer-intern-eval">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
