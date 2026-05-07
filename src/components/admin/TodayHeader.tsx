/**
 * Shared header for the Today / Front Desk surfaces. The audit's
 * collapse recommendation (item 26) is to keep the three Today
 * surfaces visually consistent so a salesperson and a receptionist
 * see the same chrome even when the body content differs by role.
 *
 * One primitive, used by both TodayHome and FrontDesk:
 *   - Date line in muted micro
 *   - Greeting headline ("Good morning, Sarah.")
 *   - Optional subtitle ("Here's what needs you today.")
 *
 * Pure component — no data fetching, no router, no toast. Easy to
 * drop into any role-parameterized Today body.
 */

interface TodayHeaderProps {
  /** First name only — full names render too long on mobile. */
  firstName: string;
  /** Override the default subtitle for role-specific framing
   *  (e.g. receptionist gets "Today's check-ins."). */
  subtitle?: string;
  /** Override the date format if the parent already has one. */
  dateLabelOverride?: string;
}

const greetingFor = (now: Date) => {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const formatDateLabel = (now: Date) =>
  now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

const TodayHeader = ({ firstName, subtitle, dateLabelOverride }: TodayHeaderProps) => {
  const now = new Date();
  const dateLabel = dateLabelOverride ?? formatDateLabel(now);
  return (
    <header>
      <p className="text-caption text-muted-foreground">{dateLabel}</p>
      <h1 className="text-3xl font-bold tracking-tight mt-1">
        {greetingFor(now)}, {firstName}.
      </h1>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      )}
    </header>
  );
};

export default TodayHeader;
