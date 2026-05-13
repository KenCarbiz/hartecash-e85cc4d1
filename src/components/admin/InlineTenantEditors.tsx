import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Loader2, Check, Copy, Globe, AlertTriangle, ExternalLink, Trash2 } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Slug rules — kebab-case, 2-63 chars, no leading/trailing hyphen.
// Same shape used to derive slugs from display names in the big
// create dialog so dealers see consistent behavior everywhere.
// ─────────────────────────────────────────────────────────────

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;
const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
// Subdomain labels are a single DNS segment — no dots, kebab-case OK.
const SUBDOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function validateSlug(slug: string): string | null {
  if (!slug) return "Slug is required.";
  if (slug.length < 2) return "Slug must be at least 2 characters.";
  if (slug.length > 63) return "Slug must be 63 characters or fewer.";
  if (!SLUG_PATTERN.test(slug)) return "Use lowercase letters, numbers, and hyphens. No leading or trailing hyphen.";
  return null;
}

function validateDomain(domain: string): string | null {
  if (!domain) return null; // optional
  if (!DOMAIN_PATTERN.test(domain)) return "Enter a valid hostname (e.g. sellmycar.smithmotors.com).";
  if (domain.length > 253) return "Domain too long.";
  return null;
}

function normalizeSubdomainLabel(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

function validateSubdomainLabel(label: string): string | null {
  if (!label) return null; // clearing is allowed
  if (label.length > 63) return "Subdomain must be 63 characters or fewer.";
  if (!SUBDOMAIN_LABEL_PATTERN.test(label)) return "Use lowercase letters, numbers, and hyphens. No dots, no leading or trailing hyphen.";
  return null;
}

// ─────────────────────────────────────────────────────────────
// Audit helper — fire-and-forget write to tenant_edit_log so
// inline slug/domain/subdomain changes show up in UnifiedAuditLog.
// RLS gates writes to platform admins; if it errors we swallow so
// the user's actual save isn't held up by audit logging.
// ─────────────────────────────────────────────────────────────

type AuditField = "slug" | "custom_domain" | "subdomain_label" | "parent_domain";

async function writeTenantEdit(
  tenantId: string,
  dealershipId: string,
  field: AuditField,
  oldValue: string | null,
  newValue: string | null,
) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    await supabase.from("tenant_edit_log" as never).insert({
      tenant_id: tenantId,
      dealership_id: dealershipId,
      field,
      old_value: oldValue,
      new_value: newValue,
      performed_by_email: user?.email ?? null,
      performed_by_user_id: user?.id ?? null,
    } as never);
  } catch {
    // Audit failures are non-fatal — the underlying update already
    // succeeded by the time this runs.
  }
}

// ─────────────────────────────────────────────────────────────
// Slug editor — popover anchored on the slug cell.
// ─────────────────────────────────────────────────────────────

interface SlugEditorProps {
  tenantId: string;
  dealershipId: string;
  currentSlug: string;
  onSaved: () => void;
}

export function InlineSlugEditor({ tenantId, dealershipId, currentSlug, onSaved }: SlugEditorProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentSlug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (next: string) => {
    setValue(next);
    setError(null);
  };

  const save = async () => {
    const slug = normalizeSlug(value);
    const validationError = validateSlug(slug);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (slug === currentSlug) {
      setOpen(false);
      return;
    }
    setSaving(true);
    // Uniqueness check
    const { data: collision } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .neq("id", tenantId)
      .maybeSingle();
    if (collision) {
      setError("That slug is already in use by another dealer.");
      setSaving(false);
      return;
    }
    const { error: updateError } = await supabase
      .from("tenants")
      .update({ slug })
      .eq("id", tenantId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    writeTenantEdit(tenantId, dealershipId, "slug", currentSlug, slug);
    toast({ title: "Slug updated", description: `Live at /locations/${slug}` });
    setOpen(false);
    onSaved();
  };

  const previewUrl = `${window.location.host}/locations/${normalizeSlug(value) || currentSlug}`;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setValue(currentSlug); setError(null); } }}>
      <PopoverTrigger asChild>
        <button className="text-muted-foreground hover:text-foreground p-0.5 rounded transition" title="Edit slug">
          <Pencil className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">URL Slug</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">Lowercase, hyphens only. Used in the path.</p>
          </div>
          <div>
            <Input
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={() => setValue(normalizeSlug(value))}
              placeholder="smith-toyota"
              className="font-mono text-sm"
              autoFocus
            />
            {error && (
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-destructive">
                <AlertTriangle className="w-3 h-3" />
                <span>{error}</span>
              </div>
            )}
          </div>
          <div className="rounded-md bg-muted/50 border border-border px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Live URL preview</div>
            <code className="text-xs font-mono break-all">{previewUrl}</code>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────
// Copy-link button — shows the full path-based URL.
// ─────────────────────────────────────────────────────────────

interface CopyUrlButtonProps {
  slug: string;
}

export function CopyUrlButton({ slug }: CopyUrlButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const url = `${window.location.protocol}//${window.location.host}/locations/${slug}`;
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast({ title: "URL copied", description: url });
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-muted-foreground hover:text-foreground p-0.5 rounded transition"
      title={url}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Domain editor — popover with DNS readiness check.
// DNS is verified by issuing a HEAD request to https://<domain>
// and checking whether the response is reachable. We don't need
// a perfect cert/A-record check inline; reachability is enough
// of a signal for an admin to know whether propagation is done.
// ─────────────────────────────────────────────────────────────

const EXPECTED_IP = "185.158.133.1";

interface DomainEditorProps {
  tenantId: string;
  dealershipId: string;
  currentDomain: string | null;
  onSaved: () => void;
}

type DnsStatus = "idle" | "checking" | "reachable" | "unreachable";

export function InlineDomainEditor({ tenantId, dealershipId, currentDomain, onSaved }: DomainEditorProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentDomain || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dnsStatus, setDnsStatus] = useState<DnsStatus>("idle");

  const checkDns = async (domain: string) => {
    setDnsStatus("checking");
    try {
      // Reachability ping. no-cors + HEAD keeps it lightweight; opaque
      // responses still tell us "the host answered."
      await fetch(`https://${domain}/`, { method: "HEAD", mode: "no-cors", cache: "no-store" });
      setDnsStatus("reachable");
    } catch {
      setDnsStatus("unreachable");
    }
  };

  const save = async () => {
    const domain = value.trim().toLowerCase();
    const validationError = validateDomain(domain);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (domain === (currentDomain || "")) {
      setOpen(false);
      return;
    }
    setSaving(true);
    if (domain) {
      const { data: collision } = await supabase
        .from("tenants")
        .select("id")
        .eq("custom_domain", domain)
        .neq("id", tenantId)
        .maybeSingle();
      if (collision) {
        setError("That domain is already mapped to another dealer.");
        setSaving(false);
        return;
      }
    }
    const { error: updateError } = await supabase
      .from("tenants")
      .update({ custom_domain: domain || null })
      .eq("id", tenantId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    writeTenantEdit(tenantId, dealershipId, "custom_domain", currentDomain, domain || null);
    toast({ title: domain ? "Domain mapped" : "Domain removed", description: domain || "Custom domain cleared." });
    setOpen(false);
    onSaved();
  };

  const remove = async () => {
    setSaving(true);
    const { error: updateError } = await supabase
      .from("tenants")
      .update({ custom_domain: null })
      .eq("id", tenantId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    writeTenantEdit(tenantId, dealershipId, "custom_domain", currentDomain, null);
    toast({ title: "Domain removed" });
    setOpen(false);
    onSaved();
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setValue(currentDomain || ""); setError(null); setDnsStatus("idle"); } }}>
      <PopoverTrigger asChild>
        <button className="text-muted-foreground hover:text-foreground p-0.5 rounded transition" title={currentDomain ? "Edit domain" : "Map a domain"}>
          <Pencil className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">Custom Domain</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              The dealer must add A records pointing to <code className="font-mono bg-muted px-1 rounded text-[10px]">{EXPECTED_IP}</code> before this goes live.
            </p>
          </div>
          <div>
            <Input
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(null); setDnsStatus("idle"); }}
              placeholder="sellmycar.smithmotors.com"
              className="font-mono text-sm"
              autoFocus
            />
            {error && (
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-destructive">
                <AlertTriangle className="w-3 h-3" />
                <span>{error}</span>
              </div>
            )}
          </div>
          {value && (
            <div className="flex items-center justify-between rounded-md bg-muted/50 border border-border px-2.5 py-2 text-[11px]">
              <span className="text-muted-foreground">DNS status</span>
              <div className="flex items-center gap-2">
                <DnsBadge status={dnsStatus} />
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => checkDns(value.trim().toLowerCase())} disabled={dnsStatus === "checking"}>
                  {dnsStatus === "checking" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                  Check
                </Button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 justify-end">
            {currentDomain && (
              <Button variant="ghost" size="sm" onClick={remove} className="text-destructive hover:text-destructive mr-auto" disabled={saving}>
                <Trash2 className="w-3 h-3 mr-1" /> Remove
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DnsBadge({ status }: { status: DnsStatus }) {
  if (status === "idle") return <span className="text-muted-foreground">Not checked</span>;
  if (status === "checking") return <span className="text-muted-foreground">Checking…</span>;
  if (status === "reachable") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold">
        <Check className="w-3 h-3" /> Reachable
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-semibold">
      <AlertTriangle className="w-3 h-3" /> Not reachable
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Tiny external-link pill for the domain cell — opens the domain
// in a new tab so admins can sanity-check it lands on the tenant.
// ─────────────────────────────────────────────────────────────

export function OpenDomainButton({ domain }: { domain: string }) {
  return (
    <a
      href={`https://${domain}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-muted-foreground hover:text-foreground p-0.5 rounded transition"
      title={`Open ${domain}`}
    >
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}

// ─────────────────────────────────────────────────────────────
// Subdomain editor — popover that sets <label>.<parent_domain>
// for a sister-store rooftop. Only renders when a parent domain
// is available (resolved by the caller from the dealer group).
// ─────────────────────────────────────────────────────────────

interface SubdomainEditorProps {
  tenantId: string;
  dealershipId: string;
  parentDomain: string;
  currentLabel: string | null;
  currentParentDomain: string | null;
  defaultLabel?: string | null;
  onSaved: () => void;
}

export function InlineSubdomainEditor({ tenantId, dealershipId, parentDomain, currentLabel, currentParentDomain, defaultLabel, onSaved }: SubdomainEditorProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentLabel || defaultLabel || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dnsStatus, setDnsStatus] = useState<DnsStatus>("idle");

  const checkDns = async (host: string) => {
    setDnsStatus("checking");
    try {
      await fetch(`https://${host}/`, { method: "HEAD", mode: "no-cors", cache: "no-store" });
      setDnsStatus("reachable");
    } catch {
      setDnsStatus("unreachable");
    }
  };

  const save = async () => {
    const label = normalizeSubdomainLabel(value);
    const validationError = validateSubdomainLabel(label);
    if (validationError) {
      setError(validationError);
      return;
    }
    if ((label || null) === currentLabel) {
      setOpen(false);
      return;
    }
    setSaving(true);
    if (label) {
      const { data: collision } = await supabase
        .from("tenants")
        .select("id")
        .eq("parent_domain", parentDomain)
        .eq("subdomain_label", label)
        .neq("id", tenantId)
        .maybeSingle();
      if (collision) {
        setError(`That subdomain is already taken under ${parentDomain}.`);
        setSaving(false);
        return;
      }
    }
    const newParent = label ? parentDomain : null;
    const { error: updateError } = await supabase
      .from("tenants")
      .update({
        subdomain_label: label || null,
        parent_domain: newParent,
      } as never)
      .eq("id", tenantId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    writeTenantEdit(tenantId, dealershipId, "subdomain_label", currentLabel, label || null);
    if ((currentParentDomain || null) !== newParent) {
      writeTenantEdit(tenantId, dealershipId, "parent_domain", currentParentDomain, newParent);
    }
    toast({
      title: label ? "Subdomain mapped" : "Subdomain removed",
      description: label ? `${label}.${parentDomain}` : "Sister-store subdomain cleared.",
    });
    setOpen(false);
    onSaved();
  };

  const remove = async () => {
    setSaving(true);
    const { error: updateError } = await supabase
      .from("tenants")
      .update({ subdomain_label: null, parent_domain: null } as never)
      .eq("id", tenantId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    writeTenantEdit(tenantId, dealershipId, "subdomain_label", currentLabel, null);
    if (currentParentDomain) {
      writeTenantEdit(tenantId, dealershipId, "parent_domain", currentParentDomain, null);
    }
    toast({ title: "Subdomain removed" });
    setOpen(false);
    onSaved();
  };

  const previewHost = `${normalizeSubdomainLabel(value) || "store"}.${parentDomain}`;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setValue(currentLabel || defaultLabel || ""); setError(null); setDnsStatus("idle"); } }}>
      <PopoverTrigger asChild>
        <button className="text-muted-foreground hover:text-foreground p-0.5 rounded transition" title={currentLabel ? "Edit subdomain" : `Map a subdomain under ${parentDomain}`}>
          <Pencil className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px]" align="start">
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">Sister-store Subdomain</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Routes this store at <code className="font-mono bg-muted px-1 rounded text-[10px]">&lt;label&gt;.{parentDomain}</code>.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <Input
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(null); setDnsStatus("idle"); }}
                onBlur={() => setValue(normalizeSubdomainLabel(value))}
                placeholder="toyota"
                className="font-mono text-sm flex-1"
                autoFocus
              />
              <span className="text-xs text-muted-foreground">.{parentDomain}</span>
            </div>
            {error && (
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-destructive">
                <AlertTriangle className="w-3 h-3" />
                <span>{error}</span>
              </div>
            )}
          </div>
          <div className="rounded-md bg-muted/50 border border-border px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Live URL preview</div>
            <code className="text-xs font-mono break-all">https://{previewHost}</code>
          </div>
          {value && (
            <div className="flex items-center justify-between rounded-md bg-muted/50 border border-border px-2.5 py-2 text-[11px]">
              <span className="text-muted-foreground">DNS status</span>
              <div className="flex items-center gap-2">
                <DnsBadge status={dnsStatus} />
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => checkDns(previewHost)} disabled={dnsStatus === "checking"}>
                  {dnsStatus === "checking" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                  Check
                </Button>
              </div>
            </div>
          )}
          <div className="rounded-md border border-border bg-card px-2.5 py-2 text-[11px] space-y-1.5">
            <div className="font-semibold text-foreground">DNS — pick one:</div>
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <Check className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">Recommended:</strong> wildcard record <code className="font-mono bg-muted px-1 rounded text-[10px]">*.{parentDomain}</code> → <code className="font-mono bg-muted px-1 rounded text-[10px]">{EXPECTED_IP}</code>
                <div className="text-[10px] mt-0.5">One DNS entry covers every sister store, current and future.</div>
              </div>
            </div>
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <Check className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">Alternative:</strong> single A record <code className="font-mono bg-muted px-1 rounded text-[10px]">{previewHost}</code> → <code className="font-mono bg-muted px-1 rounded text-[10px]">{EXPECTED_IP}</code>
                <div className="text-[10px] mt-0.5">This store only. Repeat per sister store.</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            {currentLabel && (
              <Button variant="ghost" size="sm" onClick={remove} className="text-destructive hover:text-destructive mr-auto" disabled={saving}>
                <Trash2 className="w-3 h-3 mr-1" /> Remove
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
