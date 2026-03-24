import type { AuthSession, LoginCredentials } from "@agency-crm/shared";
import { ApiError, requestJson } from "@/lib/api-client";

export const authQueryKey = ["auth", "session"] as const;

export function login(values: LoginCredentials) {
  return requestJson<AuthSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(values),
  }, {
    retryOnUnauthorized: false,
  });
}

export async function getCurrentSession() {
  try {
    return await requestJson<AuthSession>("/api/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export async function logout() {
  try {
    await requestJson<{ loggedOut: boolean }>("/api/auth/logout", {
      method: "POST",
    }, {
      retryOnUnauthorized: false,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return;
    }

    throw error;
  }
}
