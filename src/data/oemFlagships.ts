// Default OEM → flagship vehicle mapping used by the homepage Value
// Tracker mockup. Admins can override any of these entries (or add
// new ones) via Branding → Tracker Vehicles. Stored on
// site_config.tracker_oem_flagships as a JSON object keyed by the
// same lowercase brand substring.
export interface FlagshipEntry {
  year: string;
  make: string;
  model: string;
  style: string;
  specs: string;
}

export const DEFAULT_OEM_FLAGSHIPS: Record<string, FlagshipEntry> = {
  ford:        { year: "2022", make: "Ford",        model: "Explorer",  style: "XLT",      specs: "4D SUV · 2.3L EcoBoost · 38,450 mi" },
  chevrolet:   { year: "2022", make: "Chevrolet",   model: "Silverado", style: "LT",       specs: "Crew Cab · 5.3L V8 · 36,200 mi" },
  chevy:       { year: "2022", make: "Chevrolet",   model: "Silverado", style: "LT",       specs: "Crew Cab · 5.3L V8 · 36,200 mi" },
  gmc:         { year: "2022", make: "GMC",         model: "Sierra",    style: "SLT",      specs: "Crew Cab · 5.3L V8 · 34,100 mi" },
  buick:       { year: "2022", make: "Buick",       model: "Enclave",   style: "Premium",  specs: "4D SUV · 3.6L V6 · 32,800 mi" },
  cadillac:    { year: "2022", make: "Cadillac",    model: "Escalade",  style: "Premium",  specs: "4D SUV · 6.2L V8 · 28,900 mi" },
  ram:         { year: "2022", make: "Ram",         model: "1500",      style: "Big Horn", specs: "Crew Cab · 5.7L HEMI · 39,200 mi" },
  dodge:       { year: "2022", make: "Dodge",       model: "Charger",   style: "GT",       specs: "Sedan · 3.6L V6 · 31,400 mi" },
  jeep:        { year: "2022", make: "Jeep",        model: "Grand Cherokee", style: "Limited", specs: "4D SUV · 3.6L V6 · 34,700 mi" },
  chrysler:    { year: "2022", make: "Chrysler",    model: "Pacifica",  style: "Touring L", specs: "Minivan · 3.6L V6 · 33,500 mi" },
  toyota:      { year: "2022", make: "Toyota",      model: "RAV4",      style: "XLE",      specs: "4D SUV · 2.5L · 36,100 mi" },
  lexus:       { year: "2022", make: "Lexus",       model: "RX 350",    style: "Premium",  specs: "4D SUV · 3.5L V6 · 29,800 mi" },
  honda:       { year: "2022", make: "Honda",       model: "CR-V",      style: "EX-L",     specs: "4D SUV · 1.5L Turbo · 37,400 mi" },
  acura:       { year: "2022", make: "Acura",       model: "MDX",       style: "Technology", specs: "4D SUV · 3.5L V6 · 30,200 mi" },
  nissan:      { year: "2022", make: "Nissan",      model: "Rogue",     style: "SV",       specs: "4D SUV · 2.5L · 38,900 mi" },
  infiniti:    { year: "2022", make: "Infiniti",    model: "QX60",      style: "Luxe",     specs: "4D SUV · 3.5L V6 · 31,600 mi" },
  hyundai:     { year: "2022", make: "Hyundai",     model: "Tucson",    style: "SEL",      specs: "4D SUV · 2.5L · 35,800 mi" },
  kia:         { year: "2022", make: "Kia",         model: "Telluride", style: "EX",       specs: "4D SUV · 3.8L V6 · 32,400 mi" },
  genesis:     { year: "2022", make: "Genesis",     model: "GV80",      style: "3.5T",     specs: "4D SUV · 3.5L Twin-Turbo · 28,100 mi" },
  subaru:      { year: "2022", make: "Subaru",      model: "Outback",   style: "Premium",  specs: "Wagon · 2.5L · 36,700 mi" },
  mazda:       { year: "2022", make: "Mazda",       model: "CX-5",      style: "Touring",  specs: "4D SUV · 2.5L · 34,500 mi" },
  volkswagen:  { year: "2022", make: "Volkswagen",  model: "Atlas",     style: "SE",       specs: "4D SUV · 3.6L V6 · 35,200 mi" },
  vw:          { year: "2022", make: "Volkswagen",  model: "Atlas",     style: "SE",       specs: "4D SUV · 3.6L V6 · 35,200 mi" },
  audi:        { year: "2022", make: "Audi",        model: "Q5",        style: "Premium",  specs: "4D SUV · 2.0L Turbo · 29,400 mi" },
  bmw:         { year: "2022", make: "BMW",         model: "X5",        style: "xDrive40i", specs: "4D SUV · 3.0L Turbo · 30,900 mi" },
  mercedes:    { year: "2022", make: "Mercedes-Benz", model: "GLE 350", style: "4MATIC",   specs: "4D SUV · 2.0L Turbo · 28,700 mi" },
  porsche:     { year: "2022", make: "Porsche",     model: "Macan",     style: "Base",     specs: "4D SUV · 2.0L Turbo · 26,500 mi" },
  volvo:       { year: "2022", make: "Volvo",       model: "XC60",      style: "Momentum", specs: "4D SUV · 2.0L Turbo · 30,300 mi" },
  mini:        { year: "2022", make: "MINI",        model: "Cooper",    style: "S",        specs: "Hatchback · 2.0L Turbo · 27,800 mi" },
  mitsubishi:  { year: "2022", make: "Mitsubishi",  model: "Outlander", style: "SEL",      specs: "4D SUV · 2.5L · 33,900 mi" },
  tesla:       { year: "2022", make: "Tesla",       model: "Model Y",   style: "Long Range", specs: "4D SUV · Dual Motor · 28,400 mi" },
  lincoln:     { year: "2022", make: "Lincoln",     model: "Nautilus",  style: "Reserve",  specs: "4D SUV · 2.0L Turbo · 29,600 mi" },
};

export const DEFAULT_FLAGSHIP: FlagshipEntry = DEFAULT_OEM_FLAGSHIPS.ford;

/**
 * Merge built-in defaults with admin overrides. Overrides can replace
 * an existing OEM key or add a new one. An override whose required
 * fields are all empty is ignored.
 */
export function mergeFlagships(
  overrides?: Record<string, Partial<FlagshipEntry>> | null,
): Record<string, FlagshipEntry> {
  const merged: Record<string, FlagshipEntry> = { ...DEFAULT_OEM_FLAGSHIPS };
  if (!overrides) return merged;
  for (const [rawKey, val] of Object.entries(overrides)) {
    if (!val) continue;
    const key = rawKey.trim().toLowerCase();
    if (!key) continue;
    const base = merged[key] ?? DEFAULT_FLAGSHIP;
    merged[key] = {
      year:  (val.year  ?? base.year).toString(),
      make:  (val.make  ?? base.make),
      model: (val.model ?? base.model),
      style: (val.style ?? base.style),
      specs: (val.specs ?? base.specs),
    };
  }
  return merged;
}

/** Search a dealership name for the best OEM key match (longest-first). */
export function resolveFlagship(
  displayName: string | undefined,
  map: Record<string, FlagshipEntry>,
): FlagshipEntry {
  if (!displayName) return map.ford ?? DEFAULT_FLAGSHIP;
  const name = displayName.toLowerCase();
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (name.includes(key)) return map[key];
  }
  return map.ford ?? DEFAULT_FLAGSHIP;
}
