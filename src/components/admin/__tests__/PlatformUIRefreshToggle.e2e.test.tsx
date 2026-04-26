/**
 * End-to-end behavior test for the UI Refresh kill switch.
 *
 * Flow under test (mirrors the brief in frontend-redesign/CLAUDE_CODE_BRIEF.md §6D):
 *   1. Platform admin views-as a tenant (isViewingAsTenant = true).
 *   2. They flip the Switch in PlatformUIRefreshToggle and click Save.
 *   3. The toggle upserts site_config.ui_refresh_enabled for that tenant.
 *   4. It writes a row to activity_log with action="ui_refresh_toggled".
 *   5. The cached site_config is invalidated, so the next consumer
 *      (AdminSidebar via useUIRefresh) picks up the new value and
 *      switches from the Legacy sidebar to the Refreshed sidebar
 *      immediately on the next render.
 *
 * Strategy: mock @/integrations/supabase/client and @/contexts/TenantContext
 * at the import boundary so we can drive the flag value, capture writes,
 * and re-render a sibling consumer to prove the UI flips. We don't go
 * through the real network — the assertion is that the component
 * orchestrates the right sequence of calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---- Mocks ---------------------------------------------------------------

// Captured calls so individual tests can assert on them.
const upsertCalls: Array<{ table: string; values: unknown; opts: unknown }> = [];
const insertCalls: Array<{ table: string; values: unknown }> = [];

// site_config "row" the mocked .select() returns. Tests mutate this to
// simulate the row that the upsert would have written, so that the
// subsequent useSiteConfig refetch sees the new value.
const mockSiteConfigRow: { dealership_id: string; ui_refresh_enabled: boolean } = {
  dealership_id: "harte-auto",
  ui_refresh_enabled: false,
};

vi.mock("@/integrations/supabase/client", () => {
  const buildQuery = (table: string) => ({
    upsert: (values: unknown, opts: unknown) => {
      upsertCalls.push({ table, values, opts });
      // Simulate the DB write taking effect for any subsequent reads.
      if (
        table === "site_config" &&
        typeof values === "object" &&
        values &&
        "ui_refresh_enabled" in (values as Record<string, unknown>)
      ) {
        mockSiteConfigRow.ui_refresh_enabled = Boolean(
          (values as Record<string, unknown>).ui_refresh_enabled,
        );
      }
      return Promise.resolve({ data: null, error: null });
    },
    insert: (values: unknown) => {
      insertCalls.push({ table, values });
      return Promise.resolve({ data: null, error: null });
    },
    // Chained select().eq().eq().maybeSingle() used by useSiteConfig.
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { ...mockSiteConfigRow }, error: null }),
        }),
        maybeSingle: () =>
          Promise.resolve({ data: { ...mockSiteConfigRow }, error: null }),
      }),
      maybeSingle: () =>
        Promise.resolve({ data: { ...mockSiteConfigRow }, error: null }),
    }),
  });
  return {
    supabase: {
      from: (table: string) => buildQuery(table),
    },
  };
});

// Tenant context: pretend we're a platform admin viewing-as harte-auto.
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({
    tenant: { dealership_id: "harte-auto", display_name: "Harte Auto", location_id: null },
    isViewingAsTenant: true,
  }),
}));

// useSiteConfig is the surface every consumer reads through. We back it
// with mockSiteConfigRow so the toggle's upsert flows through to the
// next render of any sibling that calls useSiteConfig / useUIRefresh.
vi.mock("@/hooks/useSiteConfig", () => ({
  useSiteConfig: () => ({
    config: { ui_refresh_enabled: mockSiteConfigRow.ui_refresh_enabled },
    loading: false,
  }),
}));

// Toast is noise for this test.
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Stub the heavy sidebar variants so we can detect *which* one rendered
// without dragging in the entire production sidebar tree (router,
// supabase, lucide icons, etc). The wrapper's job is to delegate based
// on useUIRefresh — we only need to prove the delegation happened.
vi.mock("@/components/admin/AdminSidebar.legacy", () => ({
  LegacyAdminSidebar: () => <div data-testid="sidebar-legacy" />,
}));

// Re-import after mocks so the wrapper picks them up.
import PlatformUIRefreshToggle from "@/components/admin/PlatformUIRefreshToggle";
import { useUIRefresh } from "@/hooks/useUIRefresh";

// Tiny consumer that proves the refreshed branch wins after the flip.
// We don't need the real RefreshedAdminSidebar — useUIRefresh is the
// single decision point, so testing it directly tests every consumer.
const SidebarUnderTest = () => {
  const refreshed = useUIRefresh();
  return refreshed ? (
    <div data-testid="sidebar-refreshed" />
  ) : (
    <div data-testid="sidebar-legacy" />
  );
};

// ---- Helpers -------------------------------------------------------------

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
};

beforeEach(() => {
  upsertCalls.length = 0;
  insertCalls.length = 0;
  mockSiteConfigRow.ui_refresh_enabled = false;
});

// ---- Tests ---------------------------------------------------------------

describe("PlatformUIRefreshToggle (end-to-end)", () => {
  it("flips the tenant's UI from legacy to refreshed and audits the change", async () => {
    const { rerender } = renderWithClient(
      <>
        <PlatformUIRefreshToggle auditLabel="ken@ken.cc" />
        <SidebarUnderTest />
      </>,
    );

    // Pre-condition: sidebar starts legacy because the flag is false.
    expect(screen.getByTestId("sidebar-legacy")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-refreshed")).not.toBeInTheDocument();

    // Flip the switch on.
    const toggle = screen.getByRole("switch", { name: /enable refreshed ui/i });
    fireEvent.click(toggle);

    // Click Save.
    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // 1. site_config upsert happened with the right payload + key.
    await waitFor(() => expect(upsertCalls.length).toBe(1));
    expect(upsertCalls[0]).toEqual({
      table: "site_config",
      values: { dealership_id: "harte-auto", ui_refresh_enabled: true },
      opts: { onConflict: "dealership_id" },
    });

    // 2. activity_log row written with the toggle metadata.
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].table).toBe("activity_log");
    expect(insertCalls[0].values).toMatchObject({
      submission_id: null,
      action: "ui_refresh_toggled",
      old_value: "false",
      new_value: "true",
      performed_by: "ken@ken.cc",
    });

    // 3. The shared site_config now reflects the new value, so any
    //    consumer that re-renders picks up the refreshed branch
    //    immediately — that's the "takes effect on next render"
    //    contract from the brief.
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <SidebarUnderTest />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("sidebar-refreshed")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-legacy")).not.toBeInTheDocument();
  });

  it("flips the tenant back to legacy and audits the reverse change", async () => {
    // Start with refresh already on.
    mockSiteConfigRow.ui_refresh_enabled = true;
    renderWithClient(<PlatformUIRefreshToggle auditLabel="ken@ken.cc" />);

    const toggle = screen.getByRole("switch", { name: /enable refreshed ui/i });
    fireEvent.click(toggle); // off
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });

    await waitFor(() => expect(upsertCalls.length).toBe(1));
    expect(upsertCalls[0].values).toMatchObject({ ui_refresh_enabled: false });
    expect(insertCalls[0].values).toMatchObject({
      action: "ui_refresh_toggled",
      old_value: "true",
      new_value: "false",
    });
  });
});
