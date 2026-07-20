import type { AuthSession, LoginCredentials, PasswordChangeValues, PasswordResetRequestValues, PasswordResetValues } from "@agency-crm/shared";
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

export function requestPasswordReset(values: PasswordResetRequestValues) {
  return requestJson<{ requested: boolean }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(values) }, { retryOnUnauthorized: false });
}

export function resetPassword(values: PasswordResetValues) {
  return requestJson<{ passwordReset: boolean }>("/api/auth/reset-password", { method: "POST", body: JSON.stringify(values) }, { retryOnUnauthorized: false });
}

export function changePassword(values: PasswordChangeValues) {
  return requestJson<{ passwordChanged: boolean }>("/api/auth/change-password", { method: "POST", body: JSON.stringify(values) });
}
