export const getSignalColor = (signal: string): string => {
  if (signal === "Strong Buy") return "#16a34a";
  if (signal === "Buy") return "#22c55e";
  if (signal === "Watch") return "#f59e0b";
  if (signal === "Caution") return "#fb923c";
  return "#ef4444";
};

export const getRiskColor = (
  risk: "Low" | "Medium" | "High"
): string => {
  if (risk === "Low") return "#16a34a";
  if (risk === "Medium") return "#f59e0b";
  return "#ef4444";
};

export const getCardBackground = (
  signal: string
): string => {
  if (signal === "Strong Buy") return "#dcfce7";
  if (signal === "Buy") return "#ecfccb";
  if (signal === "Watch") return "#fef3c7";
  if (signal === "Caution") return "#ffedd5";
  return "#fee2e2";
};

export const getScoreColor = (
  score: number
): string => {
  if (score >= 78) return "#16a34a";
  if (score >= 64) return "#f59e0b";
  return "#ef4444";
};

export const getMutedText = (): string => "#6b7280";