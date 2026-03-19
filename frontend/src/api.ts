import type { Contact, Recommendation } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

type ApiError = { error: string };

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Fallback: return as any string payload.
    return text as any;
  }
}

function getErrorMessage(payload: unknown): string {
  const err = payload as ApiError;
  if (err && typeof err === "object" && "error" in err && typeof err.error === "string") return err.error;
  return "Request failed";
}

export async function fetchContacts(): Promise<Contact[]> {
  const res = await fetch(`${API_BASE}/contacts`);
  if (!res.ok) throw new Error(getErrorMessage(await readJson<ApiError>(res)));
  return readJson<Contact[]>(res);
}

export async function fetchRecommendations(): Promise<Recommendation[]> {
  const res = await fetch(`${API_BASE}/recommendations`);
  if (!res.ok) throw new Error(getErrorMessage(await readJson<ApiError>(res)));
  return readJson<Recommendation[]>(res);
}

export async function createContact(input: Omit<Contact, "notes"> & { notes?: string }): Promise<Contact> {
  const res = await fetch(`${API_BASE}/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(getErrorMessage(await readJson<ApiError>(res)));
  return readJson<Contact>(res);
}

export async function updateContact(email: string, input: Contact): Promise<Contact> {
  const res = await fetch(`${API_BASE}/contacts/${encodeURIComponent(email)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(getErrorMessage(await readJson<ApiError>(res)));
  return readJson<Contact>(res);
}

export async function deleteContact(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/contacts/${encodeURIComponent(email)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(getErrorMessage(await readJson<ApiError>(res)));
  return;
}

export async function generateMessage(args: {
  contactName: string;
  relationshipContext: string;
  lastConversation: string;
}): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/generate-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(getErrorMessage(await readJson<ApiError>(res)));
  return readJson<{ message: string }>(res);
}

