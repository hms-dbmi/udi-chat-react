import { useCallback } from 'react';
import { IntervalFilterComponent, PointFilterComponent } from '@/features/tool-calls';
import { useBrushFilters, type BrushFilter, type DataSelection } from '@/features/dashboard';
import { useSelectionsStore } from '@/app/UDIChatContext';

function selectionIsEmpty(selection: DataSelection): boolean {
  const sel = selection.selection;
  if (sel == null) return true;
  const values = Object.values(sel);
  if (values.length === 0) return true;
  return values.every((v) => v == null || (Array.isArray(v) && v.length === 0));
}

function BrushFilterWidget({ brush }: { brush: BrushFilter }) {
  const selectionsStore = useSelectionsStore();

  const handleCommit = useCallback(
    (next: DataSelection) => {
      // An emptied selection (e.g. all categorical values unchecked) fully
      // clears the brush so the source viz remounts and its chip disappears,
      // matching the toolbar's clear behavior.
      const payload = selectionIsEmpty(next) ? { ...next, selection: null } : next;
      selectionsStore.getState().updateSelections({ [brush.uuid]: payload });
    },
    [selectionsStore, brush.uuid],
  );

  const { selection } = brush;
  const fields = Object.keys(selection.selection ?? {});

  if (selection.type === 'interval') {
    return (
      <div className="space-y-3 p-2">
        {fields.map((_, idx) => (
          <IntervalFilterComponent
            key={idx}
            dataSelection={selection}
            fieldIndex={idx}
            tweakable={false}
            filterKey={brush.uuid}
            onCommit={handleCommit}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="p-2">
      <PointFilterComponent
        dataSelection={selection}
        tweakable={false}
        filterKey={brush.uuid}
        onCommit={handleCommit}
      />
    </div>
  );
}

/**
 * Renders an adjustment widget in the chat for each active visualization brush
 * filter, mirroring how LLM-originated `FilterData` filters render. Brush
 * selections live in `selectionsStore` (not the conversation), so these never
 * leak into the LLM message history.
 */
export function BrushFilterWidgets() {
  const brushFilters = useBrushFilters();

  if (brushFilters.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
        Visualization filters
      </span>
      {brushFilters.map((brush) => (
        <div key={brush.uuid} className="rounded-lg border bg-muted/40">
          <div className="px-2 pt-2 text-xs font-medium truncate" title={brush.title}>
            {brush.title}
          </div>
          <BrushFilterWidget brush={brush} />
        </div>
      ))}
    </div>
  );
}
