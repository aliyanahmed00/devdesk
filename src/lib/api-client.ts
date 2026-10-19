"use client";

export const API_CONFIG_KEY = "devdesk:api-config";
export const API_LOG_LIMIT = 120;

export type ApiFailureStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502 | 503;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiConfig = {
  /** Master switch. When false the layer resolves instantly with 200. */
  enabled: boolean;
  /** Simulated latency window in milliseconds. */
  latencyMin: number;
  latencyMax: number;
  /** Probability (0–1) that an unforced request fails with `failureStatus`. */
  failRate: number;
  /** Status code returned when a request is randomly failed. */
  failureStatus: ApiFailureStatus;
  /** Simulated offline mode — every request rejects like a dropped connection. */
  offline: boolean;
};

export const DEFAULT_API_CONFIG: ApiConfig = {
  enabled: true,
  latencyMin: 200,
  latencyMax: 600,
  failRate: 0,
  failureStatus: 500,
  offline: false,
};

export const FAILURE_STATUS_OPTIONS: { value: ApiFailureStatus; label: string }[] = [
  { value: 400, label: "400 · Bad Request" },
  { value: 401, label: "401 · Unauthorized" },
  { value: 403, label: "403 · Forbidden" },
  { value: 404, label: "404 · Not Found" },
  { value: 409, label: "409 · Conflict" },
  { value: 429, label: "429 · Too Many Requests" },
  { value: 500, label: "500 · Internal Server Error" },
  { value: 502, label: "502 · Bad Gateway" },
  { value: 503, label: "503 · Service Unavailable" },
];

export const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

export type RequestLogEntry = {
  id: string;
  method: HttpMethod;
  url: string;
  status: number;
  ok: boolean;
  latency: number;
  payload?: unknown;
  response?: unknown;
  error?: string;
  offline: boolean;
  source?: string;
  at: number;
};

export type MockRequestOptions<T> = {
  url: string;
  method?: HttpMethod;
  payload?: unknown;
  /** Human-friendly origin of the request, shown in the logger. */
  source?: string;
  /** Fixed latency override (ms). Skips the configured window. */
  latency?: number;
  /** Force a specific status code (>= 400 rejects). */
  status?: number;
  /** Per-request failure probability override (0–1). */
  failRate?: number;
  /** Successful response body (value or factory). */
  data?: T | (() => T);
  signal?: AbortSignal;
};

type MockApiErrorInit = {
  status: number;
  url: string;
  method: HttpMethod;
  latency: number;
  offline?: boolean;
  code?: string;
};

export class MockApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly url: string;
  readonly method: HttpMethod;
  readonly latency: number;
  readonly offline: boolean;

  constructor(message: string, init: MockApiErrorInit) {
    super(message);
    this.name = "MockApiError";
    this.status = init.status;
    this.code =
      init.code ??
      (init.status === 0 ? "NETWORK_OFFLINE" : `HTTP_${init.status}`);
    this.url = init.url;
    this.method = init.method;
    this.latency = init.latency;
    this.offline = init.offline ?? init.status === 0;
  }
}

export function isMockApiError(value: unknown): value is MockApiError {
  return value instanceof MockApiError;
}

export function statusLabel(status: number): string {
  if (status === 0) return "OFFLINE";
  return String(status);
}

function randomInt(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.round(lo + Math.random() * (hi - lo));
}

function abortError(): Error {
  const error = new Error("Request aborted by the client");
  error.name = "AbortError";
  return error;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/* -------------------------------------------------------------------------- */
/* Config store (module-level so non-React code can read it)                   */
/* -------------------------------------------------------------------------- */

let config: ApiConfig = { ...DEFAULT_API_CONFIG };
let configLoaded = false;

function readStoredConfig(): ApiConfig {
  if (typeof window === "undefined") return config;
  try {
    const raw = window.localStorage.getItem(API_CONFIG_KEY);
    if (!raw) return config;
    return { ...DEFAULT_API_CONFIG, ...(JSON.parse(raw) as Partial<ApiConfig>) };
  } catch {
    return config;
  }
}

export function getApiConfig(): ApiConfig {
  if (!configLoaded) {
    configLoaded = true;
    config = readStoredConfig();
  }
  return config;
}

export function setApiConfig(next: ApiConfig): void {
  config = next;
  configLoaded = true;
}

/* -------------------------------------------------------------------------- */
/* Request log store                                                          */
/* -------------------------------------------------------------------------- */

let requestLog: RequestLogEntry[] = [];
const requestLogListeners = new Set<() => void>();

export function getRequestLog(): RequestLogEntry[] {
  return requestLog;
}

export function subscribeRequestLog(callback: () => void): () => void {
  requestLogListeners.add(callback);
  return () => {
    requestLogListeners.delete(callback);
  };
}

function emitRequestLog() {
  requestLogListeners.forEach((callback) => callback());
}

function recordRequest(entry: RequestLogEntry) {
  requestLog = [entry, ...requestLog].slice(0, API_LOG_LIMIT);
  emitRequestLog();
}

export function clearRequestLog(): void {
  requestLog = [];
  emitRequestLog();
}

/* -------------------------------------------------------------------------- */
/* The mock request itself                                                    */
/* -------------------------------------------------------------------------- */

export async function mockRequest<T = unknown>(
  options: MockRequestOptions<T>,
): Promise<T> {
  const cfg = getApiConfig();
  const method = options.method ?? "GET";
  const url = options.url;

  const latency = cfg.enabled
    ? Math.max(
        0,
        Math.round(options.latency ?? randomInt(cfg.latencyMin, cfg.latencyMax)),
      )
    : 0;

  await delay(latency, options.signal);

  const forcedStatus =
    typeof options.status === "number" ? options.status : null;
  const failRate = options.failRate ?? cfg.failRate;
  const networkDown = cfg.offline;

  let status = 200;
  if (!cfg.enabled) {
    status = 200;
  } else if (networkDown) {
    status = 0;
  } else if (forcedStatus !== null && forcedStatus >= 400) {
    status = forcedStatus;
  } else if (failRate > 0 && Math.random() < failRate) {
    status = cfg.failureStatus;
  }

  if (status === 200) {
    const data =
      typeof options.data === "function"
        ? (options.data as () => T)()
        : (options.data as T);
    recordRequest({
      id: crypto.randomUUID(),
      method,
      url,
      status: 200,
      ok: true,
      latency,
      payload: options.payload,
      response: data,
      offline: false,
      source: options.source,
      at: Date.now(),
    });
    return data;
  }

  const offline = status === 0;
  const message = offline
    ? "Network request failed — the connection appears to be offline."
    : `${status} ${STATUS_TEXT[status] ?? "Request failed"}`;

  const error = new MockApiError(message, {
    status,
    url,
    method,
    latency,
    offline,
  });

  recordRequest({
    id: crypto.randomUUID(),
    method,
    url,
    status,
    ok: false,
    latency,
    payload: options.payload,
    error: message,
    offline,
    source: options.source,
    at: Date.now(),
  });

  throw error;
}

export const mockApi = {
  get: <T = unknown>(url: string, options: Omit<MockRequestOptions<T>, "url" | "method"> = {}) =>
    mockRequest<T>({ ...options, url, method: "GET" }),
  post: <T = unknown>(
    url: string,
    payload?: unknown,
    options: Omit<MockRequestOptions<T>, "url" | "method" | "payload"> = {},
  ) => mockRequest<T>({ ...options, url, method: "POST", payload }),
  put: <T = unknown>(
    url: string,
    payload?: unknown,
    options: Omit<MockRequestOptions<T>, "url" | "method" | "payload"> = {},
  ) => mockRequest<T>({ ...options, url, method: "PUT", payload }),
  delete: <T = unknown>(url: string, options: Omit<MockRequestOptions<T>, "url" | "method"> = {}) =>
    mockRequest<T>({ ...options, url, method: "DELETE" }),
};
