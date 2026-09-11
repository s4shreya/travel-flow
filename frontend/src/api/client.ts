import { API_BASE_URL } from "@/config/env";
import type { ApiErrorBody } from "@/types/travelRequest";

export class ApiError extends Error {
  readonly status: number;
  readonly subStatusCode: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.subStatusCode = body.sub_status_code ?? String(status);
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  employeeCode: string;
};

/**
 * Typed fetch wrapper for the TravelFlow API.
 * Sends demo auth via X-Employee-Code until JWT/SSO is added.
 */
export async function apiFetch<T>(
  path: string,
  { body, employeeCode, headers, ...init }: RequestOptions,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "X-Employee-Code": employeeCode,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorBody: ApiErrorBody = { message: response.statusText };
    try {
      errorBody = (await response.json()) as ApiErrorBody;
    } catch {
      // Keep statusText when the body is not JSON
    }
    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
