import { useMemo } from 'react';
import { UDIVis } from 'udi-toolkit/react';
import type { UDIGrammar } from 'udi-toolkit/react';
import { Badge } from '@/components/ui/badge';
import { VizTweakComponent } from '@/features/dashboard';
import { useDashboard, useDataPackage } from '@/app/UDIChatContext';

interface VisualizationCardProps {
  spec: UDIGrammar;
  isActive: boolean;
  title?: string;
  messageIndex?: number;
  toolCallIndex?: number;
}

export function VisualizationCard({
  spec,
  isActive,
  title,
  messageIndex,
  toolCallIndex,
}: VisualizationCardProps) {
  const displaySpec = useMemo(() => spec, [spec]);
  const sourceResolver = useDataPackage((s) => s.sourceResolver);
  const activeVisualizations = useDashboard((s) => s.activeVisualizations);

  // Use the dashboard store's spec if available (it reflects VizTweak changes),
  // otherwise fall back to the original spec from the message.
  const currentSpec = useMemo(() => {
    if (messageIndex == null || toolCallIndex == null) return spec;
    const key = `${messageIndex}-${toolCallIndex}`;
    const active = activeVisualizations.get(key);
    return active?.spec ?? spec;
  }, [spec, messageIndex, toolCallIndex, activeVisualizations]);

  if (isActive) {
    return (
      <div className="py-1">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Active on dashboard
          </Badge>
          {title && <span className="text-xs text-muted-foreground truncate">{title}</span>}
        </div>
        {messageIndex != null && toolCallIndex != null && (
          <div className="mt-1">
            <VizTweakComponent
              spec={currentSpec}
              messageIndex={messageIndex}
              toolCallIndex={toolCallIndex}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-1">
      {title && <p className="text-xs font-medium mb-1">{title}</p>}
      <div className="w-full max-w-[300px]">
        <UDIVis spec={displaySpec} sourceResolver={sourceResolver} />
      </div>
      {messageIndex != null && toolCallIndex != null && (
        <div className="mt-1">
          <VizTweakComponent
            spec={currentSpec}
            messageIndex={messageIndex}
            toolCallIndex={toolCallIndex}
          />
        </div>
      )}
    </div>
  );
}
