import * as React from "react";

interface SlotBoundaryProps {
  extensionName?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface SlotBoundaryState {
  error: Error | null;
}

// Per-slot error boundary: a throwing remote component must never take down
// the shell or the host page — only the slot degrades.
export class SlotBoundary extends React.Component<SlotBoundaryProps, SlotBoundaryState> {
  state: SlotBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SlotBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error(
      `[inari] extension slot render failed${this.props.extensionName ? ` (${this.props.extensionName})` : ""}:`,
      error,
    );
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <span className="text-xs text-muted-foreground" role="note">
            Extension content unavailable
          </span>
        )
      );
    }
    return this.props.children;
  }
}
