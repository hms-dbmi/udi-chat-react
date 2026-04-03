import { useDashboard, useSelections, useDashboardStore } from '@/stores/UDIChatContext';
import { DashboardCard } from './DashboardCard';
import { WelcomeSplash } from './WelcomeSplash';
import { FilterToolbar } from './FilterToolbar';
import { DataCounts } from './DataCounts';
import { DownloadButton } from './DownloadButton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function DashboardPanel() {
  const pinnedVisualizations = useDashboard((s) => s.pinnedVisualizations);
  const selections = useSelections((s) => s.selections);
  const filterAllNullValues = useDashboard((s) => s.filterAllNullValues);
  const dashboardStore = useDashboardStore();

  const entries = Array.from(pinnedVisualizations.entries()).reverse();

  if (entries.length === 0) {
    return <WelcomeSplash />;
  }

  return (
    <ScrollArea className="h-full p-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <DataCounts />
          <DownloadButton />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Filters
            </h3>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="null-filter" className="text-[10px] text-muted-foreground">
                Filter Nulls
              </Label>
              <Switch
                id="null-filter"
                checked={filterAllNullValues}
                onCheckedChange={(checked) =>
                  dashboardStore.getState().setFilterAllNullValues(!!checked)
                }
              />
            </div>
          </div>
          <FilterToolbar />
        </div>
        <Separator />
        {entries.map(([key, viz]) => (
          <DashboardCard key={key} vizKey={key} viz={viz} selections={selections} />
        ))}
      </div>
    </ScrollArea>
  );
}
