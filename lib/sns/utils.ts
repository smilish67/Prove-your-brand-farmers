// Meta Graph API · Threads API 공통 호출 유틸.

export const META_GRAPH_BASE = "https://graph.facebook.com/v21.0";
export const THREADS_BASE = "https://graph.threads.net/v1.0";

export class SNSApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly authExpired = false,
  ) {
    super(message);
    this.name = "SNSApiError";
  }
}

export async function metaPost<T>(
  path: string,
  body: Record<string, string>,
  accessToken: string,
  baseUrl: string = META_GRAPH_BASE,
): Promise<T> {
  const params = new URLSearchParams({ ...body, access_token: accessToken });
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    body: params,
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = extractErrorMessage(data, `Meta API ${res.status}`);
    throw new SNSApiError(res.status, message, res.status === 401);
  }
  return data as T;
}

export async function metaGet<T>(
  path: string,
  params: Record<string, string>,
  accessToken: string,
  baseUrl: string = META_GRAPH_BASE,
): Promise<T> {
  const search = new URLSearchParams({ ...params, access_token: accessToken });
  const res = await fetch(`${baseUrl}${path}?${search}`);
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = extractErrorMessage(data, `Meta API ${res.status}`);
    throw new SNSApiError(res.status, message, res.status === 401);
  }
  return data as T;
}

// 영상 등 비동기 미디어 컨테이너의 인코딩 완료 대기.
export async function pollContainerStatus(
  containerId: string,
  accessToken: string,
  baseUrl: string = META_GRAPH_BASE,
  options: { maxAttempts?: number; intervalMs?: number } = {},
): Promise<void> {
  const max = options.maxAttempts ?? 30;
  const interval = options.intervalMs ?? 10_000;
  for (let i = 0; i < max; i++) {
    const data = await metaGet<{ status_code?: string }>(
      `/${containerId}`,
      { fields: "status_code" },
      accessToken,
      baseUrl,
    );
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") {
      throw new SNSApiError(500, "Meta container ERROR");
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new SNSApiError(504, "Meta container did not finish in time");
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null && "error" in data) {
    const err = (data as { error: unknown }).error;
    if (typeof err === "object" && err !== null && "message" in err) {
      const m = (err as { message: unknown }).message;
      if (typeof m === "string") return m;
    }
  }
  return fallback;
}
