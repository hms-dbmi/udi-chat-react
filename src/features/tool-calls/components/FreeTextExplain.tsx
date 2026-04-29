import { Fragment, useMemo } from 'react';
import type { FreeTextExplainArgs, TextSegment } from '../types';
import { useDataPackageStore } from '@/app/UDIChatContext';
import {
  evaluateStructuredText,
  hasStructuredReferences,
  type StructuredTextSegment,
} from '@/features/data-package';
import { MarkdownText } from '@/components/MarkdownText';
import { FieldListChip } from './FieldListChip';

function segmentsToMarkdown(segments: TextSegment[]): string {
  return segments
    .map((seg) => {
      if (typeof seg === 'string') return seg;
      const value = seg.value ?? JSON.stringify(seg);
      return `**${value}**`;
    })
    .join('');
}

function renderStructuredSegments(segments: StructuredTextSegment[]) {
  // Coalesce contiguous text/value segments into a single MarkdownText render
  // so markdown spans (bold, links, lists) survive across them. Break the run
  // when a field_list segment appears — it renders as its own block widget.
  const nodes: Array<{ key: string; node: React.ReactNode }> = [];
  let buffer = '';
  let bufferIndex = 0;
  const flush = () => {
    if (!buffer) return;
    nodes.push({ key: `md-${bufferIndex}`, node: <MarkdownText>{buffer}</MarkdownText> });
    buffer = '';
  };
  segments.forEach((seg, i) => {
    if (seg.type === 'text') {
      buffer += seg.content;
    } else if (seg.type === 'value') {
      buffer += `**${seg.content}**`;
    } else {
      flush();
      bufferIndex = i + 1;
      nodes.push({
        key: `fl-${i}`,
        node: <FieldListChip entity={seg.entity} fields={seg.fields} />,
      });
    }
  });
  flush();
  return nodes.map(({ key, node }) => <Fragment key={key}>{node}</Fragment>);
}

export function FreeTextExplain({ text, has_structured_elements }: FreeTextExplainArgs) {
  const dataPackageStore = useDataPackageStore();

  const md = useMemo(() => segmentsToMarkdown(text), [text]);

  if (has_structured_elements && hasStructuredReferences(md)) {
    const dpState = dataPackageStore.getState();
    const segments = evaluateStructuredText(md, dpState);
    return <div className="px-2 pb-2">{renderStructuredSegments(segments)}</div>;
  }

  return <MarkdownText className="px-2 pb-2">{md}</MarkdownText>;
}
