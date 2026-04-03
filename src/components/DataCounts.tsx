import { useMemo } from 'react';
import { Users, FlaskConical, Table2 } from 'lucide-react';
import { useDataPackage } from '@/stores/UDIChatContext';

const ENTITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  donors: Users,
  donor: Users,
  subject: Users,
  subjects: Users,
  samples: FlaskConical,
  sample: FlaskConical,
  biosample: FlaskConical,
  biosamples: FlaskConical,
  dataset: Table2,
  datasets: Table2,
};

export function DataCounts() {
  const dataPackage = useDataPackage((s) => s.dataPackage);
  const entityNames = useDataPackage((s) => s.entityNames);

  const chips = useMemo(() => {
    if (!dataPackage?.resources) return [];
    return entityNames
      .map((name) => {
        const resource = dataPackage.resources.find((r) => r.name === name);
        const totalCount = resource?.['udi:row_count'] ?? 0;
        if (totalCount <= 1) return null;
        return {
          id: name,
          label: name,
          totalCount,
          Icon: ENTITY_ICONS[name] ?? Table2,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [dataPackage, entityNames]);

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {chips.map((chip) => (
        <div
          key={chip.id}
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5"
          title={chip.label}
        >
          <chip.Icon className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex flex-col items-center text-center leading-tight">
            <span className="text-base font-bold">{chip.totalCount.toLocaleString()}</span>
            <span className="text-[11px] text-muted-foreground">{chip.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
