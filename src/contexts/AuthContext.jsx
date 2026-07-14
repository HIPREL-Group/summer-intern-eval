import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mustResetPassword, setMustResetPassword] = useState(false);

  const applyTokenClaims = (token) => {
    setIsAdmin(!!token.claims.admin);
    setMustResetPassword(!!token.claims.mustResetPassword);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const token = await firebaseUser.getIdTokenResult();
        applyTokenClaims(token);
      } else {
        setIsAdmin(false);
        setMustResetPassword(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const logout = () => signOut(auth);

  const refreshClaims = async () => {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdTokenResult(true);
      applyTokenClaims(token);
    }
  };

  const bootstrapAdmin = async () => {
    const fn = httpsCallable(functions, "bootstrapAdmin");
    await fn();
    await refreshClaims();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        mustResetPassword,
        login,
        logout,
        bootstrapAdmin,
        refreshClaims,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
