import { ReactNode } from "react";

/**
 * RoleGate — show children only if the current user's role is in the
 * allowed list. Thin wrapper around a conditional render; use it when
 * you have a single block that needs gating so the intent is visible
 * in JSX (vs. a `{cond && ...}` expression buried in a larger tree).
 *
 * For read-vs-edit distinctions prefer passing a boolean down (e.g.
 * canEditPricing) — that keeps the edit affordance wired to a prop
 * instead of a wrapper.
 *
 * Example:
 *   <RoleGate role={userRole} allow={["admin", "gm"]}>
 *     <ExecutiveHUD />
 *   </RoleGate>
 */

interface Props {
  role: string | null | undefined;
  allow: readonly string[];
  children: ReactNode;
  /**
   * Optional fallback when the role is not in the allow list. Default
   * is to render nothing. Provide a fallback if the customer-facing
   * context expects something in the slot.
   */
  fallback?: ReactNode;
}

const RoleGate = ({ role, allow, children, fallback = null }: Props) => {
  if (!role) return <>{fallback}</>;
  return allow.includes(role) ? <>{children}</> : <>{fallback}</>;
};

export default RoleGate;
