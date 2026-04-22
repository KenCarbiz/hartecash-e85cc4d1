export interface EquityResult {
  equity: number;
  label: 'hot' | 'warm' | 'cold' | 'negative';
  color: string;
  displayText: string;
}

export function calculateEquity(
  vehicleValue: number | null,
  loanPayoff: number | null
): EquityResult {
  if (!vehicleValue || vehicleValue <= 0) {
    return { equity: 0, label: 'cold', color: 'text-muted-foreground', displayText: 'No estimate' };
  }

  const payoff = loanPayoff ?? 0;
  const equity = vehicleValue - payoff;

  if (equity < 0) {
    return { equity, label: 'negative', color: 'text-destructive', displayText: `Underwater: $${Math.abs(equity).toLocaleString()}` };
  }
  if (equity >= 8000) {
    return { equity, label: 'hot', color: 'text-success', displayText: `$${equity.toLocaleString()} equity` };
  }
  if (equity >= 3000) {
    return { equity, label: 'warm', color: 'text-amber-600 dark:text-amber-400', displayText: `$${equity.toLocaleString()} equity` };
  }
  return { equity, label: 'cold', color: 'text-muted-foreground', displayText: `$${equity.toLocaleString()} equity` };
}
