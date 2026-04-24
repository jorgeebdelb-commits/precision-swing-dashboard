const MIN_SCORE = 1;
const MAX_SCORE = 10;

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_SCORE;
  }

  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, Number(value.toFixed(2))));
}

export function averageScores(values: number[]): number {
  if (!values.length) {
    return MIN_SCORE;
  }

  const total = values.reduce((sum, score) => sum + clampScore(score), 0);
  return clampScore(total / values.length);
}
