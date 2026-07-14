import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export default function UserManager() {
  const [section, setSection] = useState("create"); // "create" or "password"
  const [createMode, setCreateMode] = useState("single"); // "single" or "bulk"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [createError, setCreateError] = useState("");

  const [changeEmail, setChangeEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [changeMessage, setChangeMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleCreateSingle = async (e) => {
    e.preventDefault();
    setLoading(true);
    setCreateError("");
    setResults(null);
    try {
      const createUsers = httpsCallable(functions, "createUsers");
      const payloadUser = { email };
      if (password.trim()) {
        payloadUser.password = password.trim();
      }
      const result = await createUsers({ users: [payloadUser] });
      setResults(result.data);
      setEmail("");
      setPassword("");
    } catch (err) {
      setCreateError(err.message || "Failed to create user.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = async () => {
    setLoading(true);
    setCreateError("");
    setResults(null);
    try {
      const lines = csvText
          .trim()
          .split("\n")
          .filter((l) => l.trim());
      const users = lines.map((line) => {
        const parts = line.split(",").map((s) => s.trim());
        if (parts.length === 1) {
          if (!parts[0]) {
            throw new Error(`Invalid line: "${line}". Email is required.`);
          }
          return {email: parts[0]};
        }
        if (parts.length !== 2) {
          throw new Error(
              `Invalid line: "${line}". Expected: email or email,password`,
          );
        }
        if (!parts[0]) {
          throw new Error(`Invalid line: "${line}". Email is required.`);
        }
        if (parts[1]) {
          return {email: parts[0], password: parts[1]};
        }
        return {email: parts[0]};
      });
      if (users.length === 0) throw new Error("No valid entries found.");

      const createUsers = httpsCallable(functions, "createUsers");
      const result = await createUsers({users});
      setResults(result.data);
    } catch (err) {
      setCreateError(err.message || "Failed to create users.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangingPassword(true);
    setPasswordError("");
    setChangeMessage("");
    try {
      const setUserPassword = httpsCallable(functions, "setUserPassword");
      const result = await setUserPassword({
        email: changeEmail,
        password: newPassword,
      });
      setChangeMessage(result.data?.message || "Password updated.");
      setChangeEmail("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(err.message || "Failed to update password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result || "");
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Top-level section toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setSection("create")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            section === "create"
              ? "bg-primary-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Create Accounts
        </button>
        <button
          onClick={() => setSection("password")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            section === "password"
              ? "bg-primary-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Password Management
        </button>
      </div>

      {section === "create" && (
        <>
          {/* Nested create mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setCreateMode("single")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                createMode === "single"
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Single User
            </button>
            <button
              onClick={() => setCreateMode("bulk")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                createMode === "bulk"
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Bulk CSV Upload
            </button>
          </div>

          {createError && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
              {createError}
            </div>
          )}

          {createMode === "single" ? (
            <form
              onSubmit={handleCreateSingle}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4 max-w-md"
            >
              <h3 className="font-semibold text-gray-800">Create Student Account</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password (optional)
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono"
                  placeholder="Leave blank to use default password"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If blank, the default password
                  <span className="font-mono"> UIUC++SRSE26 </span>
                  is assigned and the student must reset on first sign-in.
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Creating..." : "Create User"}
              </button>
            </form>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-800">Bulk CSV Upload</h3>
              <p className="text-sm text-gray-500">
                Upload a CSV file or paste content below. Each line:
                <code className="bg-gray-100 px-1.5 py-0.5 rounded mx-1 text-xs">
                  email
                </code>
                or
                <code className="bg-gray-100 px-1.5 py-0.5 rounded mx-1 text-xs">
                  email,password
                </code>
                . If only email is provided, default password
                <span className="font-mono"> UIUC++SRSE26 </span>
                is used.
              </p>
              <div>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
              </div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={"student1@example.com\nstudent2@example.com,Password456"}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-y"
              />
              <button
                onClick={handleBulkUpload}
                disabled={loading || !csvText.trim()}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Creating..." : "Create Users"}
              </button>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-3">Results</h3>
              <div className="space-y-2">
                {results.results?.map((r, i) => (
                  <div
                    key={i}
                    className={`text-sm px-3 py-2 rounded-lg ${
                      r.success
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    <span className="font-mono">{r.email}</span>
                    {r.success ? (
                      <span className="ml-2">
                        ✓ Created (UID: {r.uid})
                        {r.usedDefaultPassword ? " · default password assigned" : ""}
                      </span>
                    ) : (
                      <span className="ml-2">✗ {r.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {section === "password" && (
        <>
          {passwordError && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
              {passwordError}
            </div>
          )}
          {changeMessage && (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm border border-green-200">
              {changeMessage}
            </div>
          )}

          <form
            onSubmit={handleChangePassword}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4 max-w-md"
          >
            <h3 className="font-semibold text-gray-800">Change User Password</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Email
              </label>
              <input
                type="email"
                value={changeEmail}
                onChange={(e) => setChangeEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={changingPassword}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {changingPassword ? "Updating..." : "Set Password"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
