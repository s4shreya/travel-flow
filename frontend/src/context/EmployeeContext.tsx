/* eslint-disable react-refresh/only-export-components -- provider + its hook live together */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { login as apiLogin, logout as apiLogout } from "@/api/auth";
import { refreshSession, setAccessToken, UNAUTHORIZED_EVENT } from "@/api/client";
import type { Capability } from "@/types/auth";
import type { EmployeeSummary, MeResponse } from "@/types/me";

interface EmployeeContextValue {
  /** Signed-in employee (null when signed out). */
  employee: EmployeeSummary | null;
  capabilities: Capability[];
  loading: boolean;
  can: (capability: Capability) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const EmployeeContext = createContext<EmployeeContextValue | null>(null);

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((me: MeResponse | null) => {
    setEmployee(me?.employee ?? null);
    setCapabilities(me?.capabilities ?? []);
  }, []);

  // Restore the session after a reload: memory is empty, so use the refresh cookie
  useEffect(() => {
    void refreshSession()
      .then(applySession)
      .finally(() => setLoading(false));
  }, [applySession]);

  // Drop the session when any API call reports it expired
  useEffect(() => {
    const onUnauthorized = () => {
      setAccessToken(null);
      applySession(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [applySession]);

  const login = useCallback(
    async (email: string, password: string) => {
      applySession(await apiLogin(email, password));
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      applySession(null);
    }
  }, [applySession]);

  // Stable between renders so effects can depend on it
  const can = useCallback(
    (capability: Capability) => capabilities.includes(capability),
    [capabilities],
  );

  const value = useMemo(
    () => ({ employee, capabilities, loading, can, login, logout }),
    [employee, capabilities, loading, can, login, logout],
  );

  return (
    <EmployeeContext.Provider value={value}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  const ctx = useContext(EmployeeContext);
  if (!ctx) {
    throw new Error("useEmployee must be used within EmployeeProvider");
  }
  return ctx;
}
