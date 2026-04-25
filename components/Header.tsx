"use client";

type HeaderProps = {
  lastRefresh: string;
  totalSymbols: number;
};

export default function Header({
  lastRefresh,
  totalSymbols,
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
    </div>
  );
}
