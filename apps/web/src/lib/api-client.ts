const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type ApiRequestOptions = {
  retryOnUnauthorized?: boolean;
};

type ApiPayload<T> = {
  data?: T;
  error?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let refreshPromise: Promise<boolean> | null = null;

function buildUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

async function parsePayload<T>(response: Response) {
  const text = await response.text();

  if (!text) {
    return {} as ApiPayload<T>;
  }

  return JSON.parse(text) as ApiPayload<T>;
}

async function refreshAuthSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(buildUrl("/api/auth/refresh"), {
        method: "POST",
        credentials: "include",
      });

      return response.ok;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function requestJson<T>(path: string, init?: RequestInit, options: ApiRequestOptions = {}): Promise<T> {
  const response = await fetch(buildUrl(path), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (response.status === 401 && options.retryOnUnauthorized !== false && path !== "/api/auth/refresh") {
    const refreshed = await refreshAuthSession();

    if (refreshed) {
      return requestJson<T>(path, init, {
        ...options,
        retryOnUnauthorized: false,
      });
    }
  }

  const payload = await parsePayload<T>(response);

  if (!response.ok || payload.data === undefined) {
    throw new ApiError(payload.error ?? "Request failed", response.status);
  }

  return payload.data;
}
