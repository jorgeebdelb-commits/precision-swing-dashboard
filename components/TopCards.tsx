"use client";

type TopCardsProps = {
  hotSetups: number;
  redFlags: number;
  avgSwing: number;
  avgOpportunity: number;
};

function cardStyle() {
  return {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    minWidth: 180,
    flex: 1,
  } as const;
}

function labelStyle() {
  return {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 6,
  } as const;
}

function valueStyle() {
  return {
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1,
  } as const;
}

export default function TopCards({
  hotSetups,
  redFlags,
  avgSwing,
  avgOpportunity,
}: TopCardsProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(180px,1fr))",
        gap: 14,
        marginBottom: 18,
      }}
    >
      <div style={cardStyle()}>
        <div style={labelStyle()}>
          Hot Setups
        </div>
        <div
          style={{
            ...valueStyle(),
            color: "#16a34a",
          }}
        >
          {hotSetups}
        </div>
      </div>

      <div style={cardStyle()}>
        <div style={labelStyle()}>
          Red Flags
        </div>
        <div
          style={{
            ...valueStyle(),
            color: "#ef4444",
          }}
        >
          {redFlags}
        </div>
      </div>

      <div style={cardStyle()}>
        <div style={labelStyle()}>
          Avg Swing Score
        </div>
        <div style={valueStyle()}>
          {avgSwing}
        </div>
      </div>

      <div style={cardStyle()}>
        <div style={labelStyle()}>
          Avg Opportunity
        </div>
        <div style={valueStyle()}>
          {avgOpportunity}
        </div>
      </div>
    </div>
  );
}