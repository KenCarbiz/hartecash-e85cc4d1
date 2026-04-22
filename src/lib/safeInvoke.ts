import { supabase } from "@/integrations/supabase/client";
import { captureException } from "@/lib/errorReporting";

/**
 * Fire-and-forget edge-function invocation with structured error reporting.
 *
 * Replaces scattered `.catch(console.error)` patterns that silently drop
 * failures. Every invocation is tagged with the function name and any
 * provided context so failures are actionable from logs / Sentry /
 * error_log without digging through UI state.
 *
 * This is intentionally non-throwing: notification / analytics side
 * effects should never break the user flow that triggered them.
 */
export async function safeInvoke<TBody extends Record<string, unknown>>(
  functionName: string,
  options: { body?: TBody; context?: Record<string, unknown> } = {},
): Promise<void> {
  const { body, context } = options;
  try {
    const { error } = await supabase.functions.invoke(functionName, {
      body: body as TBody,
    });
    if (error) {
      captureException(
        new Error(`safeInvoke(${functionName}): ${error.message || "unknown"}`),
        {
          function: functionName,
          body,
          ...context,
        },
      );
    }
  } catch (e) {
    captureException(
      e instanceof Error ? e : new Error(`safeInvoke(${functionName}) threw`),
      {
        function: functionName,
        body,
        ...context,
      },
    );
  }
}
