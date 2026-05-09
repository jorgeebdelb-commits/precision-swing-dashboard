export function safeNumber(value: unknown): number;
export function safeNumber(value: unknown, fallback: number): number;
export function safeNumber(value: unknown, fallback: null): number | null;
export function safeNumber(
  value: unknown,
  fallback: number | null = 0
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}
