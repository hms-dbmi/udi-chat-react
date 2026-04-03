import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDataFilters, useDataPackageStore } from '@/stores/UDIChatContext';
import type { DataSelection } from '@/stores/dataFiltersStore';

interface ChipInfo {
  id: string;
  dataSourceKey: string;
  type: string;
  label: string;
  value: string;
}

function formatSelectionValue(sel: DataSelection): { label: string; value: string } {
  for (const [field, raw] of Object.entries(sel.selection ?? {})) {
    if (sel.type === 'interval') {
      const arr = Array.isArray(raw) ? raw : [];
      const [min, max] = arr as [number | undefined, number | undefined];
      const minStr = typeof min === 'number' ? min.toFixed(0) : '...';
      const maxStr = typeof max === 'number' ? max.toFixed(0) : '...';
      return { label: field, value: `${minStr}\u2013${maxStr}` };
    } else if (sel.type === 'point') {
      const arr = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
      const displayArr = arr.map((v) => (v == null ? 'NULL' : String(v)));
      if (displayArr.length >= 3) {
        return { label: field, value: `${displayArr[0]}, ${displayArr[1]}, ...` };
      }
      return { label: field, value: displayArr.join(', ') };
    }
    return { label: field, value: JSON.stringify(raw) };
  }
  return { label: '', value: '' };
}

export function FilterToolbar() {
  const dataPackageStore = useDataPackageStore();
  const dataSelections = useDataFilters((s) => s.dataSelections);
  const internalDataSelections = useDataFilters((s) => s.internalDataSelections);
  const clearFilter = useDataFilters((s) => s.clearFilter);

  const chips = useMemo<ChipInfo[]>(() => {
    const validate = {
      isValidIntervalFilter: dataPackageStore.getState().isValidIntervalFilter,
      isValidPointFilter: dataPackageStore.getState().isValidPointFilter,
    };

    const validExternalSelections = Object.entries(dataSelections).filter(([key, sel]) => {
      if (!sel.selection || Object.keys(sel.selection).length === 0) return false;
      if (Object.values(sel.selection).every((v) => Array.isArray(v) && v.length === 0))
        return false;
      if (!key.startsWith('message-filter-')) return false;
      if (sel.type === 'interval') {
        return (
          validate.isValidIntervalFilter(sel.dataSourceKey, Object.keys(sel.selection)[0])
            .isValid === 'yes'
        );
      }
      if (sel.type === 'point') {
        return (
          validate.isValidPointFilter(
            sel.dataSourceKey,
            Object.keys(sel.selection)[0],
            Object.values(sel.selection)[0] as unknown[],
          ).isValid === 'yes'
        );
      }
      return false;
    });

    const allEntries = [
      ...validExternalSelections,
      ...Object.entries(internalDataSelections),
    ];

    return allEntries
      .filter(([, sel]) => {
        return (
          sel.selection != null &&
          !Object.values(sel.selection).every(
            (v) => v == null || (Array.isArray(v) && v.length === 0),
          )
        );
      })
      .map(([id, sel]) => {
        const { label, value } = formatSelectionValue(sel);
        return { id, dataSourceKey: sel.dataSourceKey, type: sel.type, label, value };
      });
  }, [dataSelections, internalDataSelections, dataPackageStore]);

  if (chips.length === 0) {
    return (
      <p className="text-xs text-muted-foreground px-1">
        Ask in the chat or interact with visualizations to add data filters.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {chips.map((chip) => (
        <div key={chip.id} className="group relative inline-block">
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-1.5 -right-1.5 z-10 h-4 w-4 rounded-full border bg-background shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => clearFilter(chip.id)}
          >
            <X className="h-2.5 w-2.5" />
          </Button>
          <Badge
            variant="outline"
            className="rounded-sm text-xs font-normal gap-1.5 cursor-default"
            title={`${chip.dataSourceKey} - ${chip.type}`}
          >
            <span className="font-medium">{chip.label}</span>
            <span className="font-mono">{chip.value}</span>
          </Badge>
        </div>
      ))}
    </div>
  );
}
