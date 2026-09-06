import * as React from "react";

import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// App-level last line of defense: without a root boundary, any uncaught
// render error unmounts the whole React tree and leaves a blank white page
// with no feedback. This degrades to a recoverable fallback instead.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[inari] unhandled UI render error:", error, info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-lg font-semibold">Something went wrong</p>
          <p className="max-w-md text-sm text-muted-foreground">
            The console hit an unexpected error. Reload to try again; if the
            problem persists after a reload, contact a platform administrator.
          </p>
          <p className="max-w-md break-all text-xs text-muted-foreground">
            {this.state.error.message}
          </p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
