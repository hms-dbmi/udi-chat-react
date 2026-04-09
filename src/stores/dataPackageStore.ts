import { createStore } from 'zustand/vanilla';
import type {
  DataFieldDomain,
  DataPackage,
  CategoricalDomain,
  ValidStatus,
  EntityRelationship,
  ExportRowSet,
} from '@/types/dataPackage';
import { joinDataPath } from '@/utils/joinDataPath';

export interface DataPackageState {
  dataPackage: DataPackage | null;
  dataFieldDomains: DataFieldDomain[];
  loading: boolean;
  error: string | null;
  // Cached derived values (updated by fetchDataPackage, not recomputed per selector call)
  sourceFields: Record<string, string[]> | null;
  quantitativeSourceFields: Record<string, string[]> | null;
  categoricalSourceFields: Record<string, string[]> | null;
  entityNames: string[];
  dataPackageString: string;
  dataDomainsString: string;
  filteredData: Map<string, ExportRowSet>;
  fetchDataPackage: (path: string, fetchOptions?: RequestInit) => Promise<void>;
  setDataPackage: (
    dataPackage: DataPackage,
    precomputedDomains?: DataFieldDomain[],
    fetchOptions?: RequestInit,
  ) => Promise<void>;
  getDomainForField: (entity: string, field: string) => DataFieldDomain | undefined;
  isValidIntervalFilter: (entity: string, field: string) => ValidStatus;
  isValidPointFilter: (entity: string, field: string, values: unknown[]) => ValidStatus;
  getEntityRelationship: (originSource: string, targetSource: string) => EntityRelationship | null;
  setFilteredData: (entity: string, data: ExportRowSet) => void;
}

function removeVestigialInfo(data: any): any {
  if (!data?.resources || !Array.isArray(data.resources)) return data;
  const clone = jsonClone(data);
  for (const resource of clone.resources) {
    if (resource.schema?.fields && Array.isArray(resource.schema.fields)) {
      for (const field of resource.schema.fields) {
        delete field['udi:overlapping_fields'];
      }
    }
  }
  return clone;
}

function removeLongDomains(data: DataFieldDomain[], threshold = 80): DataFieldDomain[] {
  return data.filter(
    (d) => d.type === 'interval' || (d.domain as CategoricalDomain).values.length < threshold,
  );
}

function computeSourceFields(dp: DataPackage | null): Record<string, string[]> | null {
  if (!dp?.resources) return null;
  const fieldsMap: Record<string, string[]> = {};
  for (const resource of dp.resources) {
    if (!resource.name || !resource.schema?.fields) continue;
    fieldsMap[resource.name] = resource.schema.fields.map((f) => f.name);
  }
  return fieldsMap;
}

function computeQuantitativeSourceFields(dp: DataPackage | null): Record<string, string[]> | null {
  if (!dp?.resources) return null;
  const fieldsMap: Record<string, string[]> = {};
  for (const resource of dp.resources) {
    if (!resource.name || !resource.schema?.fields) continue;
    fieldsMap[resource.name] = resource.schema.fields
      .filter((f) => f['udi:data_type'] === 'quantitative')
      .map((f) => f.name);
  }
  return fieldsMap;
}

function computeCategoricalSourceFields(dp: DataPackage | null): Record<string, string[]> | null {
  if (!dp?.resources) return null;
  const fieldsMap: Record<string, string[]> = {};
  for (const resource of dp.resources) {
    if (!resource.name || !resource.schema?.fields) continue;
    fieldsMap[resource.name] = resource.schema.fields
      .filter((f) => f['udi:data_type'] === 'ordinal' || f['udi:data_type'] === 'nominal')
      .map((f) => f.name);
  }
  return fieldsMap;
}

function computeEntityNames(dp: DataPackage | null): string[] {
  if (!dp?.resources) return [];
  return dp.resources.map((r) => r.name);
}

function computeDataPackageString(dp: DataPackage | null): string {
  if (!dp) return '';
  return JSON.stringify(removeVestigialInfo(dp));
}

function computeDataDomainsString(domains: DataFieldDomain[]): string {
  if (domains.length === 0) return '';
  return JSON.stringify(removeLongDomains(domains));
}

export function createDataPackageStore() {
  return createStore<DataPackageState>()((set, get) => ({
    dataPackage: null,
    dataFieldDomains: [],
    loading: false,
    error: null,
    sourceFields: null,
    quantitativeSourceFields: null,
    categoricalSourceFields: null,
    entityNames: [],
    dataPackageString: '',
    dataDomainsString: '',
    filteredData: new Map(),

    getDomainForField: (entity: string, field: string) => {
      return get().dataFieldDomains.find((d) => d.entity === entity && d.field === field);
    },

    isValidIntervalFilter: (entity: string, field: string): ValidStatus => {
      const state = get();
      if (!state.dataPackage?.resources) return { isValid: 'unknown' };
      const domain = state.getDomainForField(entity, field);
      if (!domain) return { isValid: 'no' };
      return { isValid: 'yes' };
    },

    isValidPointFilter: (entity: string, field: string, values: unknown[]): ValidStatus => {
      const state = get();
      if (!state.dataPackage?.resources) return { isValid: 'unknown' };
      const domain = state.getDomainForField(entity, field);
      if (!domain) return { isValid: 'no' };
      const validValues = (domain.domain as CategoricalDomain).values;
      if (!validValues) return { isValid: 'no' };
      const isValid = values.every((v) => validValues.includes(v as string));
      return { isValid: isValid ? 'yes' : 'no' };
    },

    getEntityRelationship: (
      originSource: string,
      targetSource: string,
    ): EntityRelationship | null => {
      const dp = get().dataPackage;
      if (!dp?.resources) return null;

      const searchOneDirection = (source: string, target: string, reverse = false) => {
        for (const resource of dp.resources) {
          if (resource.name !== source) continue;
          const fks = resource.schema?.foreignKeys ?? [];
          for (const fk of fks) {
            if (fk.reference.resource === target) {
              const key1 = fk.fields[fk.fields.length - 1];
              const key2 = fk.reference.fields[fk.reference.fields.length - 1];
              if (reverse) return { originKey: key2, targetKey: key1 };
              return { originKey: key1, targetKey: key2 };
            }
          }
        }
        return null;
      };
      return (
        searchOneDirection(originSource, targetSource) ??
        searchOneDirection(targetSource, originSource, true)
      );
    },

    setFilteredData: (entity: string, data: ExportRowSet) => {
      set((state) => {
        const next = new Map(state.filteredData);
        next.set(entity, data);
        return { filteredData: next };
      });
    },

    fetchDataPackage: async (path: string, fetchOptions?: RequestInit) => {
      set({ loading: true, error: null });
      try {
        const response = await fetch(path, fetchOptions);
        const json = await response.json();
        if (json.resources && Array.isArray(json.resources)) {
          json.resources = json.resources.filter(
            (r: any) => r['udi:row_count'] && r['udi:row_count'] > 0,
          );
        }
        applyDataPackage(set, json);
        await loadDomainsFromCSVs(set, json, fetchOptions);
      } catch (e) {
        set({ error: String(e), loading: false });
      } finally {
        set({ loading: false });
      }
    },

    setDataPackage: async (
      dp: DataPackage,
      precomputedDomains?: DataFieldDomain[],
      fetchOptions?: RequestInit,
    ) => {
      set({ loading: true, error: null });
      try {
        const filtered: DataPackage = {
          ...dp,
          resources: (dp.resources ?? []).filter(
            (r) => r['udi:row_count'] && r['udi:row_count'] > 0,
          ),
        };
        applyDataPackage(set, filtered);

        if (precomputedDomains) {
          set({
            dataFieldDomains: precomputedDomains,
            dataDomainsString: computeDataDomainsString(precomputedDomains),
          });
          return;
        }

        await loadDomainsFromCSVs(set, filtered, fetchOptions);
      } catch (e) {
        set({ error: String(e), loading: false });
      } finally {
        set({ loading: false });
      }
    },
  }));
}

/** Set derived state from a parsed data package (shared by fetch and set paths).
 *  Does NOT set loading — the caller manages the loading lifecycle. */
function applyDataPackage(
  set: (partial: Partial<DataPackageState>) => void,
  json: DataPackage,
) {
  set({
    dataPackage: json,
    sourceFields: computeSourceFields(json),
    quantitativeSourceFields: computeQuantitativeSourceFields(json),
    categoricalSourceFields: computeCategoricalSourceFields(json),
    entityNames: computeEntityNames(json),
    dataPackageString: computeDataPackageString(json),
  });
}

/** Load CSVs and compute field domains. `fetchOptions` is forwarded to loadCSV. */
async function loadDomainsFromCSVs(
  set: (
    partial:
      | Partial<DataPackageState>
      | ((state: DataPackageState) => Partial<DataPackageState>),
  ) => void,
  dp: DataPackage,
  fetchOptions?: RequestInit,
) {
  const folderPath = dp['udi:path'];
  if (!folderPath) {
    console.warn('DataPackage has no udi:path — skipping CSV domain loading');
    return;
  }
  for (const resource of dp.resources ?? []) {
    const entityName = resource.name;
    const fullPath = joinDataPath(folderPath, resource.path);
    const fieldDescriptions: Record<string, string> = {};
    for (const f of resource.schema?.fields ?? []) {
      fieldDescriptions[f.name] = f.description ?? '';
    }
    try {
      const { loadCSV } = await import('arquero');
      const loadOptions: any = { ...fetchOptions };
      if (fullPath.endsWith('.tsv')) loadOptions.delimiter = '\t';
      const table = await loadCSV(fullPath, loadOptions);
      const cols = table.columnNames();
      const domains: DataFieldDomain[] = [];
      for (const col of cols) {
        const series = table.array(col);
        const isNumeric = series.every((v: any) => v == null || !isNaN(+v));
        if (isNumeric) {
          const stats = table
            .rollup({
              min: `(d) => op.min(d["${col}"])`,
              max: `(d) => op.max(d["${col}"])`,
            })
            .objects()[0] as any;
          domains.push({
            entity: entityName,
            field: col,
            type: 'interval',
            fieldDescription: fieldDescriptions[col] ?? '',
            domain: { min: stats.min, max: stats.max },
          });
        } else {
          domains.push({
            entity: entityName,
            field: col,
            type: 'point',
            fieldDescription: fieldDescriptions[col] ?? '',
            domain: { values: Array.from(new Set(series)) as string[] },
          });
        }
      }
      set((state) => {
        const nextDomains = [...state.dataFieldDomains, ...domains];
        return {
          dataFieldDomains: nextDomains,
          dataDomainsString: computeDataDomainsString(nextDomains),
        };
      });
    } catch (e) {
      console.error(`Failed to load data for ${entityName}:`, e);
    }
  }
}

function jsonClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
