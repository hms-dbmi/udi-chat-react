import { useEffect, useMemo, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useConversation, useDataFilters, useGlobal } from '@/app/UDIChatContext';
import { generateFilterMessage } from '@/features/dashboard';
import { MessageBubble } from './MessageBubble';
import { Loader2 } from 'lucide-react';
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
  const debugMode = useGlobal((s) => s.debugMode);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading, brushMessages.length]);

  const displayed = messages.filter((m) => m.role !== 'system' || (debugMode && showSystemPrompts));

  return (
    <ScrollArea className="flex-1 min-h-0 px-3">
      <div className="flex flex-col gap-3 py-3">
        {displayed.map((msg) => {
          // Find the real index in messages (accounting for filtered system messages)
          const realIndex = messages.indexOf(msg);
          return (
            <MessageBubble
              key={realIndex}
              message={msg}
              messageIndex={realIndex}
              onSelectSuggestion={onSelectSuggestion}
            />
          );
        })}
        {brushMessages.map((msg, i) => (
          <MessageBubble
            key={`brush-${msg.linkedVisFilterId ?? i}`}
            message={msg}
            // Negative sentinel: not a real conversation index, won't
            // collide with vizKey lookups for active visualizations.
            messageIndex={-1 - i}
            onSelectSuggestion={onSelectSuggestion}
          />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
