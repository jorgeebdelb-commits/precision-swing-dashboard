import type { Item } from "../types/dashboard";
import { num, clamp } from "../app/lib/helpers";

export const normalizeVolumeRatio = (
  v: number
): number => {
  if (v <= 0.8) return 20;
  if (v <= 1.0) return 35;
  if (v <= 1.3) return 50;
  if (v <= 1.7) return 65;
  if (v <= 2.2) return 80;
  return 92;
};

export const getRSIMomentumScore = (
  rsi: number
): number => {
  const value = num(rsi, 50);

  if (value >= 58 && value <= 68) return 90;
  if (value >= 52) return 75;
  if (value >= 45) return 58;
  if (value >= 38) return 42;

  return 28;
};

export const getPricePositionScore = (
  item: Item
): number => {
  const support = num(item.support);
  const resistance = num(item.resistance);
  const price = num(item.price);

  if (price <= 0) return 10;
  if (resistance <= support) return 50;

  const raw =
    ((price - support) /
      (resistance - support)) * 100;

  return clamp(raw);
};

export const getBaseSignal = (
  score: number
): string => {
  if (score >= 85) return "Strong Buy";
  if (score >= 75) return "Buy";
  if (score >= 65) return "Watch";
  if (score >= 55) return "Caution";
  return "Avoid";
};

export const computeWhaleV2 = (
  item: Item
): number => {
  const technical = clamp(item.technicalScore);
  const macro = clamp(item.macroScore);
  const political = clamp(item.politicalScore);

  const volume =
    normalizeVolumeRatio(
      num(item.volumeRatio, 1)
    );

  const rsi =
    getRSIMomentumScore(
      num(item.rsi, 50)
    );

  const position =
    getPricePositionScore(item);

  const biasBoost =
    item.bias === "Bullish"
      ? 8
      : item.bias === "Bearish"
      ? -8
      : 0;

  const score =
    technical * 0.24 +
    volume * 0.24 +
    rsi * 0.18 +
    position * 0.14 +
    macro * 0.10 +
    political * 0.10 +
    biasBoost;

  return Math.round(clamp(score));
};