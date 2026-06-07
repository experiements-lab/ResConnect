import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { kratosApi } from "../lib/api";

export interface KratosSession {
  id: string;
  identity: {
    id: string;
    schema_id: string;
    traits: Record<string, string>;
  };
}

interface SessionContextValue {
  session: KratosSession | null;
  loading: boolean;
  setSession: (s: KratosSession | null) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: true,
  setSession: () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<KratosSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Skip whoami on /admin - admin uses a key, not a Kratos session
    if (window.location.pathname === "/admin") {
      setLoading(false);
      return;
    }
    try {
      const { data } = await kratosApi.get("/sessions/whoami");
      setSession(data);
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      const { data } = await kratosApi.get("/self-service/logout/browser");
      // logout_url is already http://localhost:3000/kratos/self-service/logout?token=...
      // just extract the path+query from it
      const url = new URL(data.logout_url);
      setSession(null);
      window.location.href = url.pathname + url.search;
    } catch {
      setSession(null);
      window.location.href = "/auth/login";
    }
  }, []);

  return (
    <SessionContext.Provider value={{ session, loading, setSession, logout, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

export function getRole(session: KratosSession | null): string | null {
  return session?.identity?.traits?.role ?? null;
}
