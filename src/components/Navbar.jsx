import { useAuth } from "../contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold text-primary-700">
              VerusBench
            </Link>
            <div className="flex gap-4">
              <Link
                to="/"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === "/"
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Dashboard
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === "/admin"
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Admin
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user?.email}</span>
            {isAdmin && (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                Admin
              </span>
            )}
            <button
              onClick={logout}
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
