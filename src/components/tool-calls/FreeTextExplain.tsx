import { useMemo } from 'react';
import Markdown from 'react-markdown';
import type { FreeTextExplainArgs, TextSegment } from '@/types/toolCallArgs';
import { useDataPackageStore } from '@/stores/UDIChatContext';
import { evaluateStructuredText, hasStructuredReferences } from '@/utils/structuredTextParser';

function segmentsToMarkdown(segments: TextSegment[]): string {
  return segments
    .map((seg) => {
      if (typeof seg === 'string') return seg;
      const value = seg.value ?? JSON.stringify(seg);
      return `**${value}**`;
    })
    .join('');
}

export function FreeTextExplain({ text, has_structured_elements }: FreeTextExplainArgs) {
  const dataPackageStore = useDataPackageStore();

  const md = useMemo(() => {
    let raw = segmentsToMarkdown(text);
    if (has_structured_elements && hasStructuredReferences(raw)) {
      const dpState = dataPackageStore.getState();
      const segments = evaluateStructuredText(raw, dpState);
      raw = segments
        .map((s) => (s.type === 'value' ? `**${s.content}**` : s.content))
        .join('');
    }
    return raw;
  }, [text, has_structured_elements, dataPackageStore]);

  return (
    <div className="px-2 pb-2 prose prose-sm max-w-none">
      <Markdown>{md}</Markdown>
    </div>
  );
}
