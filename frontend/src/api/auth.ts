import { apiFetch, setAccessToken } from "@/api/client";
import type { TokenResponse } from "@/types/me";

export async function login(email: string, password: string): Promise<TokenResponse> {
  const session = await apiFetch<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  // Keep the access token in memory only
  setAccessToken(session.access_token);
  return session;
}

export async function logout(): Promise<void> {
  try {
    // Revokes the refresh token server-side and clears its cookie
    await apiFetch<void>("/api/auth/logout", { method: "POST" });
  } finally {
    setAccessToken(null);
  }
}
