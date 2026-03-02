const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function getImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}
