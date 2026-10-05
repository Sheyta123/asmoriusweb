import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSessionUserId, toPublic } from "../lib/api/core";
import { logout as apiLogout } from "../lib/api/auth";
import { useDb } from "../lib/db";
import type { Creator, PublicUser } from "../lib/types";

interface AuthValue {
  user: PublicUser | null;
  creator: Creator | null;
  isAdmin: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState(getSessionUserId);

  useEffect(() => {
    const sync = () => setSessionId(getSessionUserId());
    window.addEventListener("asmorius-session", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("asmorius-session", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const value = useDb(
    (db) => {
      const raw = sessionId ? db.users.find((u) => u.id === sessionId) : undefined;
      const user = raw && raw.emailVerified ? toPublic(raw) : null;
      const creator = user?.creatorId ? (db.creators.find((c) => c.id === user.creatorId) ?? null) : null;
      return { user, creator, isAdmin: user?.role === "admin", logout: apiLogout };
    },
    [sessionId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
