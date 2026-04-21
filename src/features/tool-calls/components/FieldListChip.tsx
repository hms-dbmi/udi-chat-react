import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface FieldListChipProps {
  entity: string;
  fields: string[];
}

const DEFAULT_VISIBLE = 5;

/**
 * Renders a field list as a compact chip cluster. The first DEFAULT_VISIBLE
 * fields are shown by default; the rest are hidden behind an expand toggle so
 * datasets with hundreds of fields (e.g. HubMap) don't flood the chat.
 */
export function FieldListChip({ entity, fields }: FieldListChipProps) {
  const [expanded, setExpanded] = useState(false);

  if (fields.length === 0) {
    return <span className="text-xs text-muted-foreground">(no fields)</span>;
  }

  const visible = expanded ? fields : fields.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = fields.length - DEFAULT_VISIBLE;
  const hasMore = hiddenCount > 0;

  return (
    <div className="my-2 rounded border bg-background/50 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {entity ? `${entity} fields` : 'Fields'} ({fields.length})
        </span>
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 gap-1 px-1.5 text-[10px]"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Show all
              </>
            )}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {visible.map((field) => (
          <Badge key={field} variant="secondary" className="font-mono text-[10px]">
            {field}
          </Badge>
        ))}
        {!expanded && hasMore && (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            +{hiddenCount} more
          </Badge>
        )}
      </div>
    </div>
  );
}
