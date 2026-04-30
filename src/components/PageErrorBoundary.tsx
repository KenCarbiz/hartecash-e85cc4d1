import { Component, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Where the "Back" button should send the user. Defaults to /admin. */
  backTo?: string;
  /** Override label for the back button. */
  backLabel?: string;
  /** Override the heading shown when an error is caught. */
  title?: string;
  /** Subtitle prefix shown in the error UI. The actual error message is appended. */
  subtitlePrefix?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Page-local error boundary. Shows a helpful UI with the actual error
 * message instead of bouncing to the global "Something went wrong" screen
 * which leaves the user stranded with no way back. Use it on long, data-
 * heavy admin pages (Appraisal, Inspection, etc.) where a missing column
 * or stale RPC could otherwise hard-crash the whole route.
 */
class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || "Unknown error" };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[PageErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const {
      backTo = "/admin",
      backLabel = "Back to Dashboard",
      title = "This page hit an error",
      subtitlePrefix = "Couldn't render the page.",
    } = this.props;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full bg-card rounded-2xl border border-border p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {subtitlePrefix} Most often this means the submission is missing
            data the page expects (no Black Book lookup yet, no VIN, no
            inspection record). Going back and re-running the relevant step
            usually clears it.
          </p>
          <pre className="text-[10px] text-left bg-muted/50 border border-border rounded-lg px-3 py-2 overflow-auto max-h-32 font-mono text-muted-foreground">
            {this.state.message}
          </pre>
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }
}

export default PageErrorBoundary;
