import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import AdminStats from "../components/AdminStats";
import UserManager from "../components/UserManager";
import AssignmentManager from "../components/AssignmentManager";
import LeaderboardManager from "../components/LeaderboardManager";

const TABS = [
  { id: "stats", label: "Statistics" },
  { id: "users", label: "User Management" },
  { id: "assignments", label: "Assignments" },
  { id: "leaderboard", label: "Leaderboard" },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("stats");
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = async () => {
    setLoadingStats(true);
    setError("");
    try {
      const getAdminStats = httpsCallable(functions, "getAdminStats");
      const result = await getAdminStats();
      setStats(result.data);
    } catch (err) {
      setError("Failed to load stats: " + (err.message || "Unknown error"));
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Admin Dashboard
      </h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      {activeTab === "stats" && (
        <AdminStats stats={stats} loading={loadingStats} onRefresh={fetchStats} />
      )}
      {activeTab === "users" && <UserManager />}
      {activeTab === "assignments" && <AssignmentManager onRefresh={fetchStats} />}
      {activeTab === "leaderboard" && <LeaderboardManager />}
    </div>
  );
}
