const API_SERVER_BASE = (
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:18765"
).replace(/\/$/, "");
const API_RESPONSE_CACHE = "coco-smart-360-data-v1";

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (method !== "GET" && typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error(
      "Sem conexão. A alteração não foi salva; reconecte-se para tentar novamente.",
    );
  }

  let response: Response;
  const requestBase = typeof window === "undefined" ? API_SERVER_BASE : "";
  const requestUrl = `${requestBase}${path}`;
  const cacheableGet =
    method === "GET" &&
    path.startsWith("/api/v1/") &&
    typeof window !== "undefined";
  const cacheUrl = cacheableGet
    ? new URL(path, window.location.origin).href
    : "";
  try {
    response = await fetch(requestUrl, {
      ...options,
      cache: "no-store",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    const cachedResponse = cacheableGet
      ? await readCachedApiResponse(cacheUrl)
      : null;
    if (cachedResponse) {
      response = cachedResponse;
    } else {
      const endpoint = requestBase ? ` em ${requestBase}` : "";
      throw new Error(
        `Não foi possível conectar à API${endpoint}. Verifique se a conexão voltou e se o serviço está ativo.`,
      );
    }
  }

  if (cacheableGet && response.status >= 500) {
    const cachedResponse = await readCachedApiResponse(cacheUrl);
    if (cachedResponse) response = cachedResponse;
  }
  if (cacheableGet && response.ok) {
    await writeCachedApiResponse(cacheUrl, response.clone());
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : `Erro HTTP ${response.status}`;
    throw new Error(detail);
  }
  return body as T;
}

async function readCachedApiResponse(url: string): Promise<Response | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(API_RESPONSE_CACHE);
    return (await cache.match(url)) ?? null;
  } catch (error) {
    console.error("Não foi possível ler os dados salvos para uso offline:", error);
    return null;
  }
}

async function writeCachedApiResponse(
  url: string,
  response: Response,
): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(API_RESPONSE_CACHE);
    await cache.put(url, response);
  } catch (error) {
    console.error("Não foi possível salvar os dados para uso offline:", error);
  }
}

export function apiUrl(): string {
  return "/api/v1";
}
