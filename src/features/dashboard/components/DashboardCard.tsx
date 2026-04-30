import { useCallback, useMemo, useState } from 'react';
import { UDIVis } from 'udi-toolkit/react';
import type { DataSelections } from 'udi-toolkit/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  X,
  Settings2,
  Maximize2,
  Minimize2,
  Code2,
  Copy,
  Check,
  Table2,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { compressToEncodedURIComponent } from 'lz-string';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { PinnedVisualization } from '../stores/dashboardStore';
import {
  useDashboard,
  useDashboardStore,
  useSelectionsStore,
  useMemoryBankStore,
  useDataPackage,
  useDataFiltersStore,
} from '@/app/UDIChatContext';
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
  const sourceResolver = useDataPackage((s) => s.sourceResolver);
  const isExpanded = useDashboard((s) => s.isExpanded(vizKey));
  const isTableView = useDashboard((s) => s.isTableView(vizKey));
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
    const repr = JSON.stringify(s.representation);
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

  // Track whether this viz currently owns a brush so we can detect a
  // clear-transition (own selection going from present → absent) and
  // bump a remount counter. Vega manages its own brush rectangle
  // internally, so when the FilterToolbar X-button clears
  // selectionsStore[viz.uuid] there's no native way to ask the chart
  // to drop the rectangle. Forcing UDIVis to remount via a key change
  // is the simplest reliable reset.
  const ownHasBrush = selections[viz.uuid] != null;
  const [trackedHasBrush, setTrackedHasBrush] = useState(false);
  const [brushClearedCount, setBrushClearedCount] = useState(0);
  if (ownHasBrush !== trackedHasBrush) {
    setTrackedHasBrush(ownHasBrush);
    if (!ownHasBrush) setBrushClearedCount((c) => c + 1);
  }

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
      // Mirror this viz's brush into dataFiltersStore.dataSelections under a
      // `viz-brush-` key so it surfaces as a FilterToolbar chip AND drives a
      // user-side FilterComponent widget in the chat (the synthetic message
      // is generated from this entry by MessageList). Cross-chart filtering
      // still flows through the Pinia DataSourcesStore + named-filter
      // entries in each viz's interactiveSpec.transformation; this mirror
      // is the display-and-adjust copy.
      const own = plain[viz.uuid];
      const brushKey = `viz-brush-${viz.uuid}`;
      const mirrorValue =
        own && own.selection
          ? {
              dataSourceKey: own.dataSourceKey,
              type: own.type as 'interval' | 'point',
              selection: own.selection as Record<string, unknown[]>,
            }
          : {
              dataSourceKey: '',
              type: 'interval' as const,
              selection: {} as Record<string, unknown[]>,
            };
      dataFiltersStore.getState().setDataSelection(brushKey, mirrorValue);
    },
    [selectionsStore, dataFiltersStore, viz.uuid],
  );

  const [showTweak, setShowTweak] = useState(false);
  const [copied, setCopied] = useState(false);

  // For table view: strip representation so UDIVis renders as a table
  const tableSpec = useMemo(() => {
    if (!isTableView) return plainSpec;
    const s = JSON.parse(JSON.stringify(plainSpec));
    delete s.representation;
    return s;
  }, [plainSpec, isTableView]);

  const specJson = useMemo(() => JSON.stringify(viz.spec, null, 2), [viz.spec]);

  const specEditorUrl = useMemo(() => {
    const compressed = compressToEncodedURIComponent(specJson);
    return `https://hms-dbmi.github.io/udi-grammar/#/Editor?spec=${compressed}`;
  }, [specJson]);

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
        <span className="text-xs font-medium truncate pr-2">{viz.title ?? viz.userPrompt}</span>
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
            onClick={() => dashboardStore.getState().toggleTableView(vizKey)}
            title={isTableView ? 'Show chart' : 'Show table'}
          >
            {isTableView ? <BarChart3 className="h-3 w-3" /> : <Table2 className="h-3 w-3" />}
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
                <div className="flex gap-1 absolute top-1 right-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleCopySpec}
                    title="Copy spec"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => window.open(specEditorUrl, '_blank')}
                    title="Open in UDI Grammar Editor"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <pre className="text-xs overflow-auto max-h-[60vh] bg-muted p-3 rounded-md">
                  {specJson}
                </pre>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClose}>
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
          key={`${isTableView ? `table-${specKey}` : specKey}-c${brushClearedCount}`}
          spec={isTableView ? tableSpec : plainSpec}
          selections={externalSelections}
          sourceResolver={sourceResolver}
          onSelectionChange={handleSelectionChange}
        />
      </CardContent>
    </Card>
  );
}
