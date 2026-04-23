export const num = (v: unknown, d = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export const clamp = (
  v: unknown,
  min = 0,
  max = 100
): number => {
  return Math.max(min, Math.min(max, num(v)));
};

export const formatPrice = (v: number): string => {
  return `$${num(v).toFixed(2)}`;
};

export const pct = (v: number): string => {
  return `${num(v).toFixed(2)}%`;
};

export const safeDivide = (
  a: number,
  b: number,
  fallback = 0
): number => {
  if (!b) return fallback;
  return a / b;
};

export const round = (
  v: number,
  decimals = 0
): number => {
  const p = Math.pow(10, decimals);
  return Math.round(v * p) / p;
};

export const upper = (v: string): string => {
  return v.trim().toUpperCase();
};