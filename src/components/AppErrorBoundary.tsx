import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary for the entire app. Catches render errors that
 * escape page-level boundaries so a broken page never produces a white screen.
 */
class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Surface to console in all envs so ops dashboards (Sentry wrappers, etc.)
    // can pick it up. Avoid leaking the stack to end-users.
    console.error("[AppErrorBoundary] render error:", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    // Full reload ensures any corrupted module state is flushed.
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="min-h-screen flex items-center justify-center bg-background px-4"
      >
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            We hit an unexpected error. Our team has been notified. Please try
            reloading the page.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
