/**
 * Static reference data for the YMM cascade. Years and makes are
 * baked in so the form opens instantly; Models come from NHTSA vPIC
 * (no auth needed) and Trim is a free-text fallback because vPIC
 * doesn't return trim-level granularity. Trim is optional — the
 * appraiser fills it in at inspection if missing.
 */

const currentYear = new Date().getFullYear();
export const YEAR_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: currentYear + 1 - 1990 + 1 },
  (_, i) => {
    const y = currentYear + 1 - i;
    return { value: String(y), label: String(y) };
  },
);

export const MAKE_OPTIONS: { value: string; label: string }[] = [
  "Acura","AFEELA","Alfa Romeo","Aston Martin","Audi","Bentley","BMW","Buick",
  "Cadillac","Chevrolet","Chrysler","Dodge","Fiat","Ferrari","Fisker","Ford",
  "Genesis","GMC","Honda","Hyundai","INEOS","Infiniti","Jaguar","Jeep","Karma",
  "Kia","Lamborghini","Land Rover","Lexus","Lincoln","Lotus","Lucid","Maserati",
  "Mazda","McLaren","Mercedes-Benz","MINI","Mitsubishi","Nissan","Polestar",
  "Porsche","Ram","Rivian","Rolls-Royce","Scion","Smart","Subaru","Suzuki",
  "Tesla","Toyota","Volkswagen","Volvo","VinFast",
].map((m) => ({ value: m, label: m }));

/**
 * Fetch the model list from NHTSA's free vPIC API. Returns a
 * deduped + alphabetized array. Falls back to [] on any error so
 * the form stays usable (the user can pick a Make, get an empty
 * Model dropdown, and continue via VIN instead).
 */
export async function fetchModelsForMakeYear(make: string, year: string): Promise<{ value: string; label: string }[]> {
  if (!make || !year) return [];
  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${encodeURIComponent(year)}?format=json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json() as { Results?: { Model_Name?: string }[] };
    const names = (json.Results ?? [])
      .map((r) => r.Model_Name?.trim())
      .filter((n): n is string => !!n);
    const unique = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    return unique.map((m) => ({ value: m, label: m }));
  } catch {
    return [];
  }
}
