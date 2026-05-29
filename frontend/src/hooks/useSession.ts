import { useEffect, useState } from "react";
import { kratosApi } from "../lib/api";

export interface KratosSession {
  id: string;
  identity: {
    id: string;
    schema_id: string;
    traits: Record<string, string>;
  };
}

export function useSession() {
  const [session, setSession] = useState<KratosSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    kratosApi
      .get("/sessions/whoami")
      .then((r) => setSession(r.data))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    const { data } = await kratosApi.createSelfServiceLogoutFlowUrlForBrowsers?.() ??
      await kratosApi.get("/self-service/logout/browser");
    window.location.href = data.logout_url;
  };

  return { session, loading, logout };
}
