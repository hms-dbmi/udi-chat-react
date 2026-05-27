import { useCallback, useEffect, useRef } from 'react';
import {
  queryData,
  subscribeToSelections,
  type DataSelections,
  type QueryDataOptions,
  type QueryDataResult,
  type QueryDataSpec,
} from 'udi-toolkit/react';

interface UseEntityQueryPumpArgs {
  /** Per-entity queryData spec map. Reference-stable memoization is not
   *  required — the pump always reads the latest value via a ref. */
  specs: Record<string, QueryDataSpec>;
  /** External (non-brush) selections passed through to queryData. Brush
   *  state is read directly from the shared Pinia DataSourcesStore by
   *  queryData itself; we don't pass it here. */
  selections: DataSelections;
  /** Called once per entity when its queryData result resolves. The
   *  callback is captured into a ref, so identity changes don't restart
   *  the pump — keep it inline. */
  onResult: (entityName: string, result: QueryDataResult | null) => void;
  /** Gate the pump. Typically a "data ready" flag from the data package
   *  store. When false, no queries run and no subscriptions are set up. */
  enabled: boolean;
  /** Forwarded to queryData. Omit to rely on the auto-defaults
   *  (displayDataOnly=true when the spec ends with a rollup). */
  options?: QueryDataOptions;
}

/**
 * Live-updating per-entity queryData runner.
 *
 * Pattern: a single self-rescheduling pump runs queryData for every entry
 * in `specs`, awaiting each call sequentially so the shared Pinia
 * DataSourcesStore never sees concurrent transformation passes. While a
 * pump cycle is in flight, brush events / spec changes flip a "requested"
 * flag; when the cycle finishes it loops again with the latest values.
 * No work is cancelled mid-flight, so partial state never leaks past a
 * pump boundary and chips always reflect the most recent committed
 * computation.
 *
 * Triggers:
 *   - On mount and whenever `specs` or `selections` change (React deps)
 *   - On brush ticks via subscribeToSelections (no re-render of the host
 *     component)
 */
export function useEntityQueryPump({
  specs,
  selections,
  onResult,
  enabled,
  options,
}: UseEntityQueryPumpArgs): void {
  const specsRef = useRef(specs);
  const selectionsRef = useRef(selections);
  const onResultRef = useRef(onResult);
  const optionsRef = useRef(options);
  const runningRef = useRef(false);
  const requestedRef = useRef(false);

  // Sync the latest props/state into refs after each commit so the pump's
  // next iteration sees the freshest values without restarting.
  useEffect(() => {
    specsRef.current = specs;
    selectionsRef.current = selections;
    onResultRef.current = onResult;
    optionsRef.current = options;
  });

  const trigger = useCallback(() => {
    requestedRef.current = true;
    if (runningRef.current) return;
    runningRef.current = true;
    (async () => {
      while (requestedRef.current) {
        requestedRef.current = false;
        const currentSpecs = specsRef.current;
        const currentSelections = selectionsRef.current;
        const callback = onResultRef.current;
        const opts = optionsRef.current;
        for (const [entityName, spec] of Object.entries(currentSpecs)) {
          try {
            const result = await queryData(spec, currentSelections, opts);
            callback(entityName, result);
          } catch (e) {
            console.error(`useEntityQueryPump: query failed for ${entityName}:`, e);
          }
        }
      }
      runningRef.current = false;
    })();
  }, []);

  // Trigger on React-observed changes (LLM filters, viz open/close, etc.).
  useEffect(() => {
    if (!enabled) return;
    trigger();
  }, [enabled, specs, selections, trigger]);

  // Trigger on Pinia selection changes (brushes) without re-rendering the host.
  useEffect(() => {
    if (!enabled) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    subscribeToSelections(trigger).then((u: () => void) => {
      if (cancelled) u();
      else unsubscribe = u;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [enabled, trigger]);
}
