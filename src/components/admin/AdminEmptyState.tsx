import { Inbox, type LucideIcon } from "lucide-react";

interface AdminEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Label for an optional primary action button */
  actionLabel?: string;
  /** Callback fired when the primary action button is clicked */
  onAction?: () => void;
  /** Label for an optional secondary link */
  secondaryLabel?: string;
  /** URL for the secondary link (renders an anchor tag) */
  secondaryHref?: string;
}

const AdminEmptyState = ({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  secondaryHref,
}: AdminEmptyStateProps) => {
  const hasActions = (actionLabel && onAction) || (secondaryLabel && secondaryHref);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-in fade-in duration-500">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shadow-sm border border-border">
          <Icon className="w-9 h-9 text-muted-foreground/40" />
        </div>
        <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-primary/5 to-transparent -z-10" />
      </div>
      <h3 className="text-lg font-semibold text-card-foreground mb-1.5 tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      )}

      {hasActions && (
        <div className="flex items-center gap-3 mt-6">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
            >
              {actionLabel}
            </button>
          )}
          {secondaryLabel && secondaryHref && (
            <a
              href={secondaryHref}
              className="inline-flex items-center justify-center rounded-2xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
            >
              {secondaryLabel}
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminEmptyState;
