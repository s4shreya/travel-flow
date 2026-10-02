import { API_BASE_URL } from "@/config/env";
import type { TokenResponse } from "@/types/me";
import type { ApiErrorBody } from "@/types/travelRequest";

export class ApiError extends Error {
  readonly status: number;
  readonly subStatusCode: string;
  /** Every validation message (at least the main one). */
  readonly messages: string[];

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.subStatusCode = body.sub_status_code ?? String(status);
    this.messages = body.errors?.length
      ? body.errors.map((error) => error.message)
      : [this.message];
  }
}

/** Fired when the session cannot be refreshed (expired / revoked). */
export const UNAUTHORIZED_EVENT = "auth:unauthorized";

const AUTH_PREFIX = "/api/auth/";
const REFRESH_LOCK = "travelflow-auth-refresh";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

// Access token lives only in memory (never localStorage); lost on reload, restored via refresh
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// One in-flight refresh per tab; concurrent 401s wait on the same promise
let refreshInFlight: Promise<TokenResponse | null> | null = null;

async function callRefresh(): Promise<TokenResponse | null> {
  try {
    // Refresh token rides along in its httpOnly cookie
    const response = await fetch(`${API_BASE_URL}${AUTH_PREFIX}refresh`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      setAccessToken(null);
      return null;
    }
    const session = (await response.json()) as TokenResponse;
    setAccessToken(session.access_token);
    return session;
  } catch {
    return null;
  }
}

/**
 * Rotate the refresh token once, shared by all callers.
 * Web Locks serialise refreshes across tabs so two tabs never present the
 * same refresh token (which the server would treat as token theft).
 */
export function refreshSession(): Promise<TokenResponse | null> {
  if (!refreshInFlight) {
    const run = () => callRefresh();
    refreshInFlight = (
      typeof navigator !== "undefined" && navigator.locks
        ? navigator.locks.request(REFRESH_LOCK, run)
        : run()
    ).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Fallback message when the error body is not JSON (proxy pages, gateway errors). */
function friendlyStatus(status: number): string {
  if (status === 413) return "The file is too large";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return "Request failed";
}

function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  // Attach the in-memory access token
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    // Needed so the refresh cookie is stored / sent for /api/auth/* (also cross-origin)
    credentials: "include",
  });
}

/**
 * Typed fetch wrapper for the TravelFlow API.
 * Sends the in-memory access token as a Bearer header; on 401 it refreshes
 * once (via the httpOnly refresh cookie) and retries the request.
 */
export async function apiFetch<T>(
  path: string,
  { body, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const requestInit: RequestInit = {
    ...init,
    headers: {
      Accept: "application/json",
      ...(body !== undefined && !isFormData
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
  };

  const response = await request(path, requestInit);
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Authenticated GET for a file (receipt image / PDF), returned as a Blob. */
export async function apiFetchBlob(path: string): Promise<Blob> {
  const response = await request(path, { method: "GET" });
  return response.blob();
}

/** Send with the access token; refresh once on 401; throw ApiError on failure. */
async function request(path: string, requestInit: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await send(path, requestInit);
  } catch {
    // fetch only throws on network failure (offline, server down, CORS)
    throw new ApiError(0, {
      message: "Can't reach the server. Check your connection and try again.",
      sub_status_code: "network_error",
    });
  }

  // Access token expired: refresh once, then retry the original request
  if (response.status === 401 && !path.startsWith(AUTH_PREFIX)) {
    if (await refreshSession()) {
      response = await send(path, requestInit);
    }
  }

  if (!response.ok) {
    // Session could not be restored: let the auth context send the user to login
    if (response.status === 401 && !path.startsWith(AUTH_PREFIX)) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }

    let errorBody: ApiErrorBody = { message: friendlyStatus(response.status) };
    try {
      const raw = (await response.json()) as Record<string, unknown>;
      // AppException shape
      if (typeof raw.message === "string") {
        errorBody = raw as ApiErrorBody;
      } else if (Array.isArray(raw.detail)) {
        // FastAPI / Pydantic validation errors
        const first = raw.detail[0] as { msg?: string } | undefined;
        errorBody = {
          message: first?.msg ?? "Validation failed",
          sub_status_code: "validation_error",
        };
      } else if (typeof raw.detail === "string") {
        errorBody = { message: raw.detail, sub_status_code: "error" };
      }
    } catch {
      // Keep statusText when the body is not JSON
    }
    throw new ApiError(response.status, errorBody);
  }
  return response;
}
