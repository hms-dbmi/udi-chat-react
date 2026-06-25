import { useMemo } from 'react';
import type { DataSelections } from 'udi-toolkit/react';
import type { DataSelection } from '../stores/dataFiltersStore';
import type { ActiveVisualization } from '../stores/dashboardStore';
import { useSelections, useDashboard } from '@/app/UDIChatContext';

export interface BrushFilter {
  /** Selection key — the source visualization's uuid. */
  uuid: string;
  /** Dashboard key of the source visualization (for remount/hover coordination). */
  vizKey: string;
  /** Human-readable label for the source visualization. */
  title: string;
  selection: DataSelection;
}

function hasActiveSelection(selection: DataSelection): boolean {
  const sel = selection.selection;
  if (sel == null) return false;
  const values = Object.values(sel);
  if (values.length === 0) return false;
  return !values.every((v) => v == null || (Array.isArray(v) && v.length === 0));
}

/**
 * Pure derivation of brush filters from raw selections + active visualizations.
 * Gated to currently-active vizzes (so a closed viz's stale selection never
 * shows) and to non-empty selections. Exported for unit testing.
 */
export function selectBrushFilters(
  selections: DataSelections,
  activeVisualizations: Map<string, ActiveVisualization>,
): BrushFilter[] {
  const byUuid = new Map<string, { vizKey: string; title: string }>();
  for (const [vizKey, viz] of activeVisualizations.entries()) {
    byUuid.set(viz.uuid, { vizKey, title: viz.title ?? viz.userPrompt ?? 'Visualization' });
  }

  const result: BrushFilter[] = [];
  for (const [uuid, selection] of Object.entries(selections)) {
    const meta = byUuid.get(uuid);
    if (!meta) continue;
    if (!hasActiveSelection(selection)) continue;
    result.push({ uuid, vizKey: meta.vizKey, title: meta.title, selection });
  }
  return result;
}

/**
 * Brush/click selections created by interacting with a visualization live in
 * `selectionsStore`, keyed by the source viz's uuid. This hook surfaces them
 * as first-class filters for the filter toolbar and the chat adjustment
 * widgets.
 */
export function useBrushFilters(): BrushFilter[] {
  const selections = useSelections((s) => s.selections);
  const activeVisualizations = useDashboard((s) => s.activeVisualizations);

  return useMemo(
    () => selectBrushFilters(selections, activeVisualizations),
    [selections, activeVisualizations],
  );
}
