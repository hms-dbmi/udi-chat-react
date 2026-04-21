import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useConversation, useGlobal } from '@/app/UDIChatContext';
import { MessageBubble } from './MessageBubble';
import { Loader2 } from 'lucide-react';

interface MessageListProps {
  isLoading: boolean;
  showSystemPrompts?: boolean;
  onSelectSuggestion?: (suggestion: string) => void;
}

const PIN_THRESHOLD_PX = 64;

export function MessageList({
  isLoading,
  showSystemPrompts,
  onSelectSuggestion,
}: MessageListProps) {
  const messages = useConversation((s) => s.messages);
  const debugMode = useGlobal((s) => s.debugMode);

  const contentRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const prevLengthRef = useRef(messages.length);
  // Start pinned so the initial mount scrolls to the latest message.
  const pinnedRef = useRef(true);
  const justAddedMessageRef = useRef(false);

  // Resolve the scroll viewport once the content is mounted, jump to the bottom
  // on initial render, and keep pinnedRef in sync with user scroll position.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const root = content.closest<HTMLElement>('[data-slot="scroll-area"]');
    const viewport = root?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!viewport) return;
    viewportRef.current = viewport;
    viewport.scrollTop = viewport.scrollHeight;

    const handleScroll = () => {
      const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      pinnedRef.current = distance < PIN_THRESHOLD_PX;
    };
    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, []);

  // On new-message arrival: if the user is pinned to the bottom, align the
  // start of the new message with the top of the viewport so its first line
  // is visible rather than scrolling past it.
  useEffect(() => {
    const prev = prevLengthRef.current;
    prevLengthRef.current = messages.length;
    if (messages.length <= prev) return;
    if (!pinnedRef.current) return;

    justAddedMessageRef.current = true;
    const frame = requestAnimationFrame(() => {
      const items = contentRef.current?.querySelectorAll<HTMLElement>('[data-message]');
      const last = items?.[items.length - 1];
      last?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      requestAnimationFrame(() => {
        justAddedMessageRef.current = false;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length]);

  // Streaming updates: when the last message grows in place and the user is
  // still pinned to the bottom, keep the tail glued to the viewport bottom
  // without overriding the just-added-message alignment.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      if (justAddedMessageRef.current) return;
      if (!pinnedRef.current) return;
      const viewport = viewportRef.current;
      if (!viewport) return;
      viewport.scrollTop = viewport.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const displayed = messages.filter((m) => m.role !== 'system' || (debugMode && showSystemPrompts));

  return (
    <ScrollArea className="flex-1 min-h-0 px-3">
      <div ref={contentRef} className="flex flex-col gap-3 py-3">
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
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
