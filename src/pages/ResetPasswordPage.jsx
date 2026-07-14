import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updatePassword } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { refreshClaims, logout } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!auth.currentUser) {
      setError("No authenticated user session found.");
      return;
    }

    setLoading(true);
    try {
      await updatePassword(auth.currentUser, password);
      const clearMustResetPassword = httpsCallable(
          functions,
          "clearMustResetPassword",
      );
      await clearMustResetPassword();
      await refreshClaims();
      navigate("/");
    } catch (err) {
      if (err.code === "auth/requires-recent-login") {
        setError("Please sign in again, then reset your password.");
      } else if (err.code === "auth/weak-password") {
        setError("Please choose a stronger password.");
      } else {
        setError("Failed to reset password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 space-y-5">
        <h1 className="text-2xl font-bold text-primary-800">Reset Password</h1>
        <p className="text-sm text-gray-600">
          You must set a new password before accessing the dashboard.
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>

        <button
          onClick={logout}
          className="w-full text-sm text-gray-600 hover:text-gray-800"
          type="button"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
