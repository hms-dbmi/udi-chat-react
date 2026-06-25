import { describe, it, expect } from 'vitest';
import type { DataSelections } from 'udi-toolkit/react';
import { selectBrushFilters } from './useBrushFilters';
import type { ActiveVisualization } from '../stores/dashboardStore';

function viz(uuid: string, overrides: Partial<ActiveVisualization> = {}): ActiveVisualization {
  return {
    index: 0,
    toolCallIndex: 0,
    spec: {} as ActiveVisualization['spec'],
    interactiveSpec: {} as ActiveVisualization['interactiveSpec'],
    userPrompt: 'prompt',
    uuid,
    ...overrides,
  };
}

const intervalSel = (dataSourceKey: string): DataSelections[string] => ({
  dataSourceKey,
  type: 'interval',
  selection: { age: [10, 90] },
});

describe('selectBrushFilters', () => {
  it('returns a brush filter for an active viz with a non-empty selection', () => {
    const active = new Map([['viz-key-1', viz('uuid-1', { title: 'Ages' })]]);
    const selections: DataSelections = { 'uuid-1': intervalSel('donors') };

    const result = selectBrushFilters(selections, active);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ uuid: 'uuid-1', vizKey: 'viz-key-1', title: 'Ages' });
    expect(result[0].selection.dataSourceKey).toBe('donors');
  });

  it('ignores selections whose uuid is not an active visualization (stale/closed viz)', () => {
    const active = new Map([['viz-key-1', viz('uuid-1')]]);
    const selections: DataSelections = { 'uuid-closed': intervalSel('donors') };

    expect(selectBrushFilters(selections, active)).toEqual([]);
  });

  it('ignores empty selections', () => {
    const active = new Map([['viz-key-1', viz('uuid-1')]]);
    const selections: DataSelections = {
      'uuid-1': { dataSourceKey: 'donors', type: 'point', selection: { sex: [] } },
    };

    expect(selectBrushFilters(selections, active)).toEqual([]);
  });

  it('ignores null selections', () => {
    const active = new Map([['viz-key-1', viz('uuid-1')]]);
    const selections: DataSelections = {
      'uuid-1': { dataSourceKey: 'donors', type: 'interval', selection: null },
    };

    expect(selectBrushFilters(selections, active)).toEqual([]);
  });

  it('falls back to userPrompt when the viz has no title', () => {
    const active = new Map([
      ['viz-key-1', viz('uuid-1', { userPrompt: 'show ages', title: undefined })],
    ]);
    const selections: DataSelections = { 'uuid-1': intervalSel('donors') };

    expect(selectBrushFilters(selections, active)[0].title).toBe('show ages');
  });
});
