"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error) => void;
};

type State = { hasError: boolean; message: string };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? "Unknown render failure" };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div style={{ padding: 12, border: "1px solid #7f1d1d", borderRadius: 8, color: "#fecaca" }}>
            <strong>Panel failed safely.</strong>
            <div>{this.state.message || "Unknown component error."}</div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
