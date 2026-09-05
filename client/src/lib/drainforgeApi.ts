// Thin client for the DrainForge FastAPI service. Self-contained (no shared
// package dependency) since the report contract now includes title, image
// and the simplified pending/resolved status. Evidence photos are uploaded
// directly to Supabase Storage first (see uploadEvidence in ./supabase),
// then their storage paths are sent along in the JSON create-report body —
// same pattern the original API already used.

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export type ReportCategory =
  | "blocked_drain"
  | "flooding"
  | "waste_plastic"
  | "rising_water"
  | "damaged_drainage"
  | "other";

export type ReportSeverity = "low" | "medium" | "high" | "critical";

export type ReportStatus = "pending" | "resolved";

export interface Report {
  id: string;
  reference: string;
  title: string;
  area?: string | null;
  category: ReportCategory;
  severity: ReportSeverity;
  description: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  location_accuracy?: number | null;
  image_url?: string | null;
  status: ReportStatus;
  created_at: string;
  reporter_phone?: string | null;
  resolved_at?: string | null;
}

export interface ReportCreateInput {
  title: string;
  category: ReportCategory;
  severity: ReportSeverity;
  description: string;
  latitude: number;
  longitude: number;
  address?: string;
  area?: string;
  location_accuracy?: number;
  reporter_phone?: string;
  evidence_paths?: string[];
}

export interface AnalyticsSummary {
  total_reports: number;
  resolved: number;
  pending: number;
  reports_this_month: number;
  resolution_rate: number;
  monthly: { month: string; count: number }[];
}

function requireApiBase() {
  if (!API_BASE_URL) throw new Error("VITE_API_BASE_URL is required to reach the DrainForge API.");
  return API_BASE_URL;
}

async function parseOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error((body && (body.detail as string)) || fallbackMessage);
  }
  return response.json() as Promise<T>;
}

export async function listReports(status?: ReportStatus, limit = 50): Promise<Report[]> {
  const base = requireApiBase();
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  const response = await fetch(`${base}/api/v1/reports?${params.toString()}`);
  const payload = await parseOrThrow<{ items: Report[] }>(response, "Unable to load reports");
  return payload.items;
}

export async function searchReports(query: string): Promise<Report[]> {
  const base = requireApiBase();
  const response = await fetch(`${base}/api/v1/reports/search?q=${encodeURIComponent(query)}`);
  const payload = await parseOrThrow<{ items: Report[] }>(response, "Search failed");
  return payload.items;
}

export async function getReport(reference: string): Promise<Report> {
  const base = requireApiBase();
  const response = await fetch(`${base}/api/v1/reports/${encodeURIComponent(reference)}`);
  return parseOrThrow<Report>(response, "Report not found");
}

export async function createReport(input: ReportCreateInput): Promise<Report> {
  const base = requireApiBase();
  const response = await fetch(`${base}/api/v1/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseOrThrow<Report>(response, "Unable to submit report");
}

// --- Admin (no login — a single shared admin key) ---

const ADMIN_KEY_STORAGE = "drainforge-admin-key";

export function getStoredAdminKey(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function storeAdminKey(key: string) {
  try {
    sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
  } catch {
    /* ignore */
  }
}

export function clearAdminKey() {
  try {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export async function verifyAdminKey(key: string): Promise<boolean> {
  const base = requireApiBase();
  const response = await fetch(`${base}/api/v1/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_key: key }),
  });
  return response.ok;
}

export async function adminListReports(key: string, status?: ReportStatus): Promise<Report[]> {
  const base = requireApiBase();
  const params = new URLSearchParams({ limit: "500" });
  if (status) params.set("status", status);
  const response = await fetch(`${base}/api/v1/admin/reports?${params.toString()}`, {
    headers: { "X-Admin-Key": key },
  });
  const payload = await parseOrThrow<{ items: Report[] }>(response, "Unable to load reports");
  return payload.items;
}

export async function adminUpdateStatus(key: string, reference: string, status: ReportStatus): Promise<Report> {
  const base = requireApiBase();
  const response = await fetch(`${base}/api/v1/reports/${encodeURIComponent(reference)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Key": key },
    body: JSON.stringify({ status }),
  });
  return parseOrThrow<Report>(response, "Unable to update status");
}

export async function adminAnalytics(key: string): Promise<AnalyticsSummary> {
  const base = requireApiBase();
  const response = await fetch(`${base}/api/v1/admin/analytics`, { headers: { "X-Admin-Key": key } });
  return parseOrThrow<AnalyticsSummary>(response, "Unable to load analytics");
}
