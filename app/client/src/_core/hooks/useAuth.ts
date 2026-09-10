import { useCallback, useEffect, useState } from "react";

type AdminUser = { id: number; openId: string; name: string; email: string; role: "admin" };
type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };

export function useAuth(options?: UseAuthOptions) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(async () => { try { const response = await fetch("/api/admin/me", { credentials: "include" }); const data = await response.json(); setUser(data.authenticated ? { id: 1, openId: "admin", name: "Dr. Claudete Grassi", email: "", role: "admin" } : null); } catch (cause) { setError(cause); setUser(null); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!options?.redirectOnUnauthenticated || loading || user) return; if (options.redirectPath && window.location.pathname === options.redirectPath) return; }, [options, loading, user]);
  const logout = useCallback(async () => { await fetch("/api/admin/logout", { method: "POST", credentials: "include" }); setUser(null); }, []);
  return { user, loading, error, isAuthenticated: Boolean(user), logout, refresh: load };
}
