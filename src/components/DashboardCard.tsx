import { useCallback, useMemo, useState } from 'react';
import { UDIVis } from 'udi-toolkit/react';
import type { DataSelections } from 'udi-toolkit/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { X, Settings2, Maximize2, Minimize2, Code2, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { PinnedVisualization } from '@/stores/dashboardStore';
import { useDashboard, useDashboardStore, useSelectionsStore, useDataFiltersStore, useMemoryBankStore } from '@/stores/UDIChatContext';
import { VizTweakComponent } from './VizTweakComponent';
import { cn } from '@/lib/utils';

interface DashboardCardProps {
  vizKey: string;
  viz: PinnedVisualization;
  selections: DataSelections;
}

export function DashboardCard({ vizKey, viz, selections }: DashboardCardProps) {
  const dashboardStore = useDashboardStore();
  const selectionsStore = useSelectionsStore();
  const dataFiltersStore = useDataFiltersStore();
  const memoryBankStore = useMemoryBankStore();
  const isExpanded = useDashboard((s) => s.isExpanded(vizKey));
  const isHovered = useDashboard((s) => s.hoveredVisualizationIndex === vizKey);

  const plainSpec = useMemo(
    () => JSON.parse(JSON.stringify(viz.interactiveSpec)),
    [viz.interactiveSpec],
  );

  // Fingerprint the spec so we can force UDIVis to remount when the spec
  // content changes — the Vue CE may not reliably re-render on prop updates
  // alone despite the useLayoutEffect fix in the wrapper.
  const specKey = useMemo(() => {
    const s = viz.interactiveSpec;
    const repr = JSON.stringify((s as any).representation);
    const src = JSON.stringify(s.source);
    return `${src}|${repr}`;
  }, [viz.interactiveSpec]);

  const externalSelections = useMemo(() => {
    const filtered: DataSelections = {};
    for (const [key, val] of Object.entries(selections)) {
      if (key !== viz.uuid) filtered[key] = val;
    }
    return JSON.parse(JSON.stringify(filtered)) as DataSelections;
  }, [selections, viz.uuid]);

  const handleClose = useCallback(() => {
    dashboardStore.getState().unpinVisualization(vizKey, memoryBankStore);
  }, [dashboardStore, vizKey, memoryBankStore]);

  const handleToggleExpand = useCallback(() => {
    dashboardStore.getState().toggleExpanded(vizKey);
    // Fire resize so Vega recalculates width
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }, [dashboardStore, vizKey]);

  const handleSelectionChange = useCallback(
    (newSelections: DataSelections) => {
      const plain = JSON.parse(JSON.stringify(newSelections)) as DataSelections;
      selectionsStore.getState().updateSelections(plain);
      dataFiltersStore.getState().updateInternalDataSelections(plain);
    },
    [selectionsStore, dataFiltersStore],
  );

  const [showTweak, setShowTweak] = useState(false);
  const [copied, setCopied] = useState(false);

  const specJson = useMemo(() => JSON.stringify(viz.spec, null, 2), [viz.spec]);

  const handleCopySpec = useCallback(() => {
    navigator.clipboard.writeText(specJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [specJson]);

  return (
    <Card
      className={cn(
        'relative transition-shadow',
        isExpanded && 'col-span-full',
        isHovered && 'ring-2 ring-primary/40',
      )}
      onMouseEnter={() => dashboardStore.getState().setHoveredVisualizationIndex(vizKey)}
      onMouseLeave={() => dashboardStore.getState().setHoveredVisualizationIndex(null)}
    >
      <CardHeader className="p-2 pb-0 flex-row items-center justify-between">
        <span className="text-xs font-medium truncate pr-2">
          {viz.title ?? viz.userPrompt}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowTweak((v) => !v)}
            title="Tweak fields"
          >
            <Settings2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleToggleExpand}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
          <Dialog>
            <DialogTrigger
              render={<Button variant="ghost" size="icon" className="h-6 w-6" title="View spec" />}
            >
              <Code2 className="h-3 w-3" />
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="text-sm">UDI Grammar Spec</DialogTitle>
              </DialogHeader>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-7 w-7"
                  onClick={handleCopySpec}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <pre className="text-xs overflow-auto max-h-[60vh] bg-muted p-3 rounded-md">
                  {specJson}
                </pre>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleClose}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      {showTweak && (
        <div className="px-2 pt-1">
          <VizTweakComponent
            spec={viz.spec}
            messageIndex={viz.index}
            toolCallIndex={viz.toolCallIndex}
          />
        </div>
      )}
      <CardContent className="p-2">
        <UDIVis
          key={specKey}
          spec={plainSpec}
          selections={externalSelections}
          onSelectionChange={handleSelectionChange}
        />
      </CardContent>
    </Card>
  );
}
