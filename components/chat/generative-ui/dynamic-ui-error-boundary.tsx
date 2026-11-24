"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface DynamicUIErrorBoundaryProps {
  fallback: (error: Error) => ReactNode;
  children: ReactNode;
}

interface DynamicUIErrorBoundaryState {
  error: Error | null;
}

/**
 * Isolates runtime render exceptions inside LLM-generated UI specs so a
 * malformed component prop never crashes the surrounding chat thread or Canvas.
 */
export class DynamicUIErrorBoundary extends Component<
  DynamicUIErrorBoundaryProps,
  DynamicUIErrorBoundaryState
> {
  state: DynamicUIErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): DynamicUIErrorBoundaryState {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Handled visually via the scoped fallback alert + raw code block.
  }

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}
