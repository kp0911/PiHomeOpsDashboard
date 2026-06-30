export type LoginResponse = {
  token: string;
  username: string;
  role: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export function token() {
  return localStorage.getItem("homeops_token");
}

export function setToken(nextToken: string | null) {
  if (nextToken) localStorage.setItem("homeops_token", nextToken);
  else localStorage.removeItem("homeops_token");
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const currentToken = token();
  if (currentToken) headers.set("Authorization", `Bearer ${currentToken}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }
  return response.json() as Promise<T>;
}

export async function apiBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  const currentToken = token();
  if (currentToken) headers.set("Authorization", `Bearer ${currentToken}`);
  const response = await fetch(`${API_BASE}${path}`, { headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }
  return response.blob();
}

export async function login(username: string, password: string) {
  const response = await api<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  setToken(response.token);
  return response;
}
