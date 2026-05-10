import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TokenStatus } from "@/lib/tokenStatus";

interface TokenErrorScreenProps {
  status: TokenStatus | "error";
  /** Override default heading copy. */
  title?: string;
  /** Override default body copy. */
  description?: string;
  /** Called when the user clicks the "Try again" button. Omit to hide. */
  onRetry?: () => void;
  /** Hide the "Look up your submission" link for embedded contexts. */
  hideLookupLink?: boolean;
}

/**
 * Shared error screen for unauthenticated submission flows when the
 * URL token is missing, expired, or otherwise unresolvable. Gives the
 * customer a clear next step (re-request a fresh link, retry, or
 * return to lookup) rather than a dead-end "not found" message.
 */
const TokenErrorScreen = ({
  status,
  title,
  description,
  onRetry,
  hideLookupLink,
}: TokenErrorScreenProps) => {
  const isExpired = status === "expired";
  const Icon = isExpired ? Clock : AlertTriangle;

  const headline =
    title ??
    (isExpired
      ? "This link has expired"
      : status === "missing"
        ? "Submission Not Found"
        : "We couldn't load your submission");

  const body =
    description ??
    (isExpired
      ? "For your security, links expire after 90 days. Look up your submission below to get a fresh link sent to your phone or email."
      : status === "missing"
        ? "We couldn't find a submission for this link. Please double-check the URL or look up your submission."
        : "Something went wrong while loading your submission. Please try again — if the problem continues, look up your submission to get a fresh link.");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-sm">
        <div
          className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
            isExpired ? "bg-amber-500/10" : "bg-muted/60"
          }`}
        >
          <Icon
            className={`w-7 h-7 ${
              isExpired ? "text-amber-600" : "text-muted-foreground"
            }`}
          />
        </div>
        <h1 className="text-xl font-display font-bold text-foreground mb-2">
          {headline}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>

        <div className="mt-6 flex flex-col items-center gap-3">
          {onRetry && (
            <Button
              type="button"
              onClick={onRetry}
              variant="outline"
              className="gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try again
            </Button>
          )}
          {!hideLookupLink && (
            <Link
              to="/my-submission"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Look up your submission
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenErrorScreen;
