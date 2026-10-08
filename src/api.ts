import type { CatalogInfo, FeaturedSection, QueryResponse, SearchCriteria } from "../shared/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `요청 실패 (${res.status})`);
  return body as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  catalog: () => request<CatalogInfo>("/api/catalog"),
  featured: () => request<FeaturedSection[]>("/api/featured"),
  query: (message: string, prevCriteria: SearchCriteria | null) =>
    request<QueryResponse>("/api/query", json({ message, prevCriteria: prevCriteria ?? undefined })),
  search: (criteria: SearchCriteria) => request<QueryResponse>("/api/search", json({ criteria })),
  transcribe: (audio: Blob, filename: string) => {
    const fd = new FormData();
    fd.append("audio", audio, filename);
    return request<{ text: string }>("/api/transcribe", { method: "POST", body: fd });
  },
};
