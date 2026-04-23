"use client";

type HeaderProps = {
  lastRefresh: string;
  totalSymbols: number;
  refreshing: boolean;
  onRefreshAll: () => void;
};

export default function Header({
  lastRefresh,
  totalSymbols,
  refreshing,
  onRefreshAll,
}: HeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 20,
      }}
    >
      <div>
        <h1 style={{ margin: 0 }}>
          Precision Swing Dashboard
        </h1>

        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
            marginTop: 4,
          }}
        >
          Symbols: {totalSymbols} • Last Refresh: {lastRefresh}
        </div>
      </div>

      <button
        onClick={onRefreshAll}
        disabled={refreshing}
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          fontWeight: 700,
          background: refreshing
            ? "#9ca3af"
            : "#16a34a",
          color: "#fff",
        }}
      >
        {refreshing
          ? "Refreshing..."
          : "Refresh All"}
      </button>
    </div>
  );
}