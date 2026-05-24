# AutoCurb — Recommendations: Things to Strengthen

> Prioritized engineering + product punch list derived from the May 2026 code review,
> competitive research, and the expert-panel assessment. Ordered by what unlocks
> **revenue and enterprise/venture readiness** first. Each item: **why it matters**,
> **where it lives**, and **rough effort**. Written to be handed to an engineer or to
> Claude Code / Lovable as scoped work.

Legend — Effort: **S** ≤ few days · **M** ~1–2 wks · **L** multi-week / cross-cutting.

---

## P0 — Gates revenue & enterprise (do first)

### 1. Wire real AI usage metering + billing
**Why:** The "$2,495 + metered AI" model is **not enforceable today** — the overage prices
(voice min / re-appraisals / images) are UI config only; there are no Stripe usage-record /
meter-event calls anywhere. Premium AI usage is currently a margin leak, and the headline
pricing can't actually bill.
**Where:** `dealer_subscriptions`, `platform_pricing_model`, the billing/Stripe edge
functions, and the points where AI is consumed (Voice-AI call completion in
`supabase/functions/launch-voice-call` + `VoiceAICampaigns`, AI re-appraisal in
`StepBoost*` / boost-evaluate, `generate-vehicle-image`). Emit a metered event per
unit consumed, aggregate per rooftop/billing period, report to Stripe metered billing.
**Effort:** L

### 2. Native DMS write (vAuto live + one of CDK / Reynolds / Tekion)
**Why:** The **#1 enterprise dealbreaker** (every operator/CEO reviewer flagged it). The
vAuto push is a sandbox stub (`isSandbox` short-circuits transmission); CDK/Reynolds/Tekion
appear only as scraper strings. An acquisition tool that can't write a clean ACV/inventory
record into the system of record causes double entry → managers abandon it in ~60 days.
**Where:** the vAuto integration module (remove the sandbox short-circuit, wire real Cox
credentials + transmit), plus a new adapter for at least one native DMS write API.
**Effort:** L

### 3. Group/enterprise infrastructure (SSO, consolidated billing, tenant-isolation proof)
**Why:** Groups won't sign per-store, and the repo itself flags group billing + RLS cascade
+ SSO as "the single biggest gap." Needed for the MSA-level motion the pricing assumes.
**Where:** finish SSO/SAML (currently config-only), build cross-rooftop consolidated
billing + reporting on the `dealer_groups` model, and produce a tenant-isolation test
suite + SOC 2 readiness checklist (RLS coverage across all tenant tables).
**Effort:** L

---

## P1 — Trust, compliance & quality (do next)

### 4. Human-in-the-loop gate on Voice-AI price moves
**Why:** NADA + the mega-dealer both made this a condition of adoption. Autonomous AI
*offering to beat a competitor* or bumping price above a threshold is brand/CX/liability
risk the dealer owns. AI should schedule/inform/confirm; humans approve real price moves.
**Where:** Voice-AI agent config + `launch-voice-call` / boost re-offer path — add a
per-dealership "max autonomous bump" threshold above which the call routes to a human
(warm transfer / approval queue) instead of committing.
**Effort:** M

### 5. Compliance hardening
**Why:** The compliance base is genuinely strong (consent block, calling hours, recording
disclosure, kill-switch) — protect that lead and close the edges.
**Where:** replace the **ZIP-prefix timezone fallback** with precise geocoding (too coarse
for a national group); add a **consent audit trail + export**; add **GLBA/DPA + customer
data export & delete-on-termination** (a data-egress function exists — extend it).
**Effort:** M

### 6. Make AI re-appraisal demonstrably vision-grounded (and labeled honestly)
**Why:** The "AI photo re-appraisal" is largely a deterministic, capped bump table on a
Black Book re-pull (with a condition score feeding it). That's *auditable and good* — but
don't market it as black-box "AI magic." Either deepen the vision judgment or surface the
factors + a confidence/explanation so dealers and customers trust the number.
**Where:** boost-evaluate / `StepBoost*` and the condition-scoring function; add an
explanation payload (what raised/lowered the offer).
**Effort:** M

### 7. Retire or finish the OpenAI voice provider stub
**Why:** `openai_bridge_not_yet_implemented` is a dead path; Bland.ai works. Remove it (or
finish it) so there's no half-wired provider in a customer-facing, compliance-sensitive flow.
**Where:** the voice provider abstraction in `supabase/functions/`.
**Effort:** S

---

## P2 — Proof, pricing hygiene & GTM

### 8. Instrument ROI proof (the metrics buyers demand for pilots)
**Why:** Every operator wants pilot proof: incremental acquired units/rooftop/mo,
offer → appointment → acquired conversion, cost-per-acquired-unit, and voice-call
complaint rate (< 0.5%). Today there's no surfaced ROI dashboard tying acquisitions back
to the funnel.
**Where:** ExecutiveDashboard / Analytics — add an acquisition-attribution + ROI view.
**Effort:** M

### 9. Reconcile pricing config to the new model
**Why:** The repo's pricing config / investor brief still shows ~$299/$499 ARPU vs. the
proposed $1,495 / $2,495 + metered. Align `platform_pricing_model` + `PlanPage` so the
product reflects the real tiers, allowances, overage, and enterprise/performance options.
**Where:** `platform_pricing_model`, `src/pages/PlanPage.tsx`.
**Effort:** S

### 10. Performance-pricing plumbing (per-acquired-unit)
**Why:** The pricing/GTM expert recommends a performance plan ($25–$50 per *acquired* unit,
monthly-capped) as an alternative to flat SaaS — it aligns price to value and lowers the
"$1.5k for AI?" objection. Needs acquisition events + capped billing.
**Where:** depends on #1 (metering) + #8 (acquisition attribution); add a per-acquisition
billing mode.
**Effort:** M

---

## Sequencing
1. **#1 + #9** together (you can't sell the new pricing until it bills and the config matches).
2. **#2** in parallel (longest pole for enterprise; start the vAuto live-write immediately).
3. **#4 + #5** before turning Voice-AI on for any group pilot.
4. **#8** before the first pilot so you can prove ROI; **#3** before group-wide rollout.
5. **#6, #7, #10** as fast-follows.

**One-line strategic frame:** the work that converts the big logos and earns the moat isn't
more features — it's **real DMS/vAuto integration, group SSO/billing/SOC 2, enforceable
metering, and human-in-the-loop voice guardrails**, proven out on a small paid pilot.
