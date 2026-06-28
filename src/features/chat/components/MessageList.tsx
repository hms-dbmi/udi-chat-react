import { Fragment, useMemo } from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useConversation, useDashboard, useDataFilters, useGlobal } from '@/app/UDIChatContext';
import { generateFilterMessage } from '@/features/dashboard';
import { MessageBubble } from './MessageBubble';
import { useMessageListScroll } from '../hooks/useMessageListScroll';
import type { Message } from '@/types/messages';

interface MessageListProps {
  isLoading: boolean;
  showSystemPrompts?: boolean;
  onSelectSuggestion?: (suggestion: string) => void;
}

const BRUSH_KEY_PREFIX = 'viz-brush-';

export function MessageList({
  isLoading,
  showSystemPrompts,
  onSelectSuggestion,
}: MessageListProps) {
  const messages = useConversation((s) => s.messages);
  const dataSelections = useDataFilters((s) => s.dataSelections);
  const activeVisualizations = useDashboard((s) => s.activeVisualizations);
  const debugMode = useGlobal((s) => s.debugMode);
  const { contentRef, firstUnreadIndex, scrollToBottom } = useMessageListScroll(messages);

  // Synthesize a user-side bubble for each active brush filter so the chat
  // surfaces an adjustment widget alongside the FilterToolbar chip. The
  // messages live only here at render time — they aren't appended to
  // conversationStore, so they don't bleed into the LLM prompt.
  const brushMessages = useMemo<Message[]>(() => {
    const out: Message[] = [];
    for (const [key, sel] of Object.entries(dataSelections)) {
      if (!key.startsWith(BRUSH_KEY_PREFIX)) continue;
      const msg = generateFilterMessage(key, sel);
      if (msg) out.push(msg);
    }
    return out;
  }, [dataSelections]);

  // Anchor each brush widget to the conversation position of the
  // visualization that produced it, so adjustment widgets stay inline with
  // their source viz instead of all collecting at the bottom of the list.
  const brushMessageAnchors = useMemo(() => {
    const uuidToVizIndex = new Map<string, number>();
    for (const viz of activeVisualizations.values()) {
      uuidToVizIndex.set(viz.uuid, viz.index);
    }
    const byIndex = new Map<number, { msg: Message; i: number }[]>();
    const orphans: { msg: Message; i: number }[] = [];
    brushMessages.forEach((msg, i) => {
      const uuid = msg.linkedVisFilterId?.slice(BRUSH_KEY_PREFIX.length) ?? '';
      const vizIndex = uuidToVizIndex.get(uuid);
      const entry = { msg, i };
      if (vizIndex == null) {
        orphans.push(entry);
        return;
      }
      const bucket = byIndex.get(vizIndex);
      if (bucket) bucket.push(entry);
      else byIndex.set(vizIndex, [entry]);
    });
    return { byIndex, orphans };
  }, [brushMessages, activeVisualizations]);

  // Negative sentinel index: not a real conversation position, so it won't
  // collide with vizKey lookups for active visualizations.
  const renderBrush = ({ msg, i }: { msg: Message; i: number }) => (
    <MessageBubble
      key={`brush-${msg.linkedVisFilterId ?? i}`}
      message={msg}
      messageIndex={-1 - i}
      onSelectSuggestion={onSelectSuggestion}
    />
  );

  const displayed = messages.filter((m) => m.role !== 'system' || (debugMode && showSystemPrompts));

  return (
    <div className="relative flex-1 min-h-0">
      <ScrollArea className="h-full px-3">
        <div ref={contentRef} className="flex flex-col gap-3 py-3">
          {displayed.map((msg) => {
            const realIndex = messages.indexOf(msg);
            const showDivider = firstUnreadIndex !== null && realIndex === firstUnreadIndex;
            return (
              <Fragment key={realIndex}>
                {showDivider && <NewMessageDivider />}
                <MessageBubble
                  message={msg}
                  messageIndex={realIndex}
                  onSelectSuggestion={onSelectSuggestion}
                />
                {brushMessageAnchors.byIndex.get(realIndex)?.map(renderBrush)}
              </Fragment>
            );
          })}
          {brushMessageAnchors.orphans.map(renderBrush)}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      {firstUnreadIndex !== null && (
        <Button
          size="sm"
          onClick={scrollToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-md"
        >
          <ArrowDown />
          new message
        </Button>
      )}
    </div>
  );
}

function NewMessageDivider() {
  return (
    <div className="flex items-center gap-2" role="separator" aria-label="new messages below">
      <div className="flex-1 h-px bg-primary" />
      <span className="text-xs font-medium text-primary">new message</span>
      <div className="flex-1 h-px bg-primary" />
    </div>
  );
}
