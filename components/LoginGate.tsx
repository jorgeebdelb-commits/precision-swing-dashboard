"use client";

type LoginGateProps = {
  passwordInput: string;
  setPasswordInput: (value: string) => void;
  handleLogin: () => void;
  loginError: string;
};

export default function LoginGate({
  passwordInput,
  setPasswordInput,
  handleLogin,
  loginError,
}: LoginGateProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0f172a",
        color: "#fff",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#111827",
          borderRadius: 14,
          padding: 24,
          boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Precision Swing Dashboard V6.1</h1>

        <p style={{ color: "#cbd5e1" }}>
          Live Alpha Engine • movers • refresh all • top setups
        </p>

        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="Password"
          style={{
            width: "100%",
            padding: 10,
            marginTop: 12,
            borderRadius: 8,
            border: "1px solid #374151",
            background: "#1f2937",
            color: "#fff",
            boxSizing: "border-box",
          }}
        />

        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: 10,
            marginTop: 12,
            border: "none",
            borderRadius: 8,
            background: "#2563eb",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Login
        </button>

        {loginError ? (
          <p style={{ color: "#f87171", marginTop: 10 }}>{loginError}</p>
        ) : null}
      </div>
    </div>
  );
}