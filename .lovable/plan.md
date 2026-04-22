
## Onboarding Wizard Rework

### Step 1: Architecture Selection (Full-screen premium cards)
- **Single Store** — One rooftop, simple setup
- **Single Store + Secondary** — Primary + satellite (buying center, used lot)
- **Multi-Location** — Multiple stores under one brand
- **Dealer Group** — Multiple brands/franchises under corporate umbrella
- **Enterprise** — 11+ locations, custom build

Each card: large icon, title, subtitle, example use case. Premium glass-card styling with hover effects.

### Step 2: Context-Aware Details
- **Single Store**: Ask if they have a secondary location (buying center/standalone lot)
- **Multi-Location / Dealer Group**: Ask how many locations, list location names
- **Enterprise**: Show "Custom Build — our team will configure" message
- Basic info: dealership name, slug, custom domain, plan tier (auto-set from architecture)

### Step 3: AI Website Scrape (per location)
- Corporate website scrape first (pulls corporate identity)
- For multi-location: scrape each location's website if different
- Auto-extract: name, phone, address, hours, OEM brands, logos, colors, about story
- Logo collection panel: corporate logo (light + dark), location logo (light + dark), OEM logos
- The scraper should identify and pull logos automatically

### Step 4: Logo & Branding Review
- Show all extracted logos with light/dark variants
- Upload slots for: corporate logo, corporate logo (dark), location logo, location logo (dark)
- OEM Logo Library integration for quick brand additions
- Color palette extracted and editable

### Step 5: Review & Launch
- Summary of all locations, branding, configuration
- "Create Tenant" button provisions everything

### Files to create/modify:
1. `src/components/admin/onboarding/ArchitectureSelector.tsx` — Step 1 premium cards
2. `src/components/admin/onboarding/TenantDetailsStep.tsx` — Step 2 context form
3. `src/components/admin/onboarding/WebsiteScrapeStep.tsx` — Step 3 AI scan
4. `src/components/admin/onboarding/BrandingReviewStep.tsx` — Step 4 logos/colors
5. `src/components/admin/onboarding/ReviewLaunchStep.tsx` — Step 5 summary
6. `src/components/admin/AddTenantWizard.tsx` — Rewrite as orchestrator
