/** Format a condition grade for display: "good" → "Good", "very_good" → "Very Good" */
export function formatGrade(grade: string | null | undefined): string {
  if (!grade) return "";
  return grade
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
