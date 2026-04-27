"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type InfoHelpProps = {
  title: string;
  content: ReactNode;
  size?: number;
  placement?: "top" | "bottom" | "left" | "right";
};

const placementStyles: Record<NonNullable<InfoHelpProps["placement"]>, CSSProperties> = {
  top: { bottom: "calc(100% + 10px)", right: 0 },
  bottom: { top: "calc(100% + 10px)", right: 0 },
  left: { right: "calc(100% + 10px)", top: 0 },
  right: { left: "calc(100% + 10px)", top: 0 },
};

export default function InfoHelp({
  title,
  content,
  size = 16,
  placement = "bottom",
}: InfoHelpProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`About ${title}`}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: size + 12,
          height: size + 12,
          borderRadius: 999,
          border: "1px solid rgba(148,163,184,0.35)",
          background: "rgba(15,23,42,0.82)",
          color: "#cbd5e1",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1,
          boxShadow: open ? "0 0 14px rgba(56,189,248,0.38)" : "0 0 0 rgba(0,0,0,0)",
          transition: "box-shadow 150ms ease, border-color 150ms ease, color 150ms ease",
        }}
      >
        ⓘ
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={`${title} help`}
          style={{
            position: "absolute",
            zIndex: 20,
            minWidth: 240,
            maxWidth: 320,
            padding: "12px 13px",
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,0.22)",
            background: "rgba(2,6,23,0.96)",
            color: "#cbd5e1",
            boxShadow: "0 16px 40px rgba(2,6,23,0.6)",
            backdropFilter: "blur(8px)",
            ...placementStyles[placement],
          }}
        >
          <div style={{ fontSize: 12, color: "#67e8f9", fontWeight: 700, marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>{content}</div>
        </div>
      ) : null}
    </div>
  );
}
