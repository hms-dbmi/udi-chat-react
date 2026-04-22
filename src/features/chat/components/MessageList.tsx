import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useConversation, useGlobal } from '@/app/UDIChatContext';
import { MessageBubble } from './MessageBubble';

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

  // Index of the first message the user hasn't seen yet. Set when a new
  // message lands while the user is scrolled away from the bottom.
  const [firstUnreadIndex, setFirstUnreadIndex] = useState<number | null>(null);

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

  // On new-message arrival: if the user is pinned, scroll the newest message
  // to the top of the viewport; otherwise mark the first unread boundary so a
  // divider + "new message" pill can surface the fact that content arrived
  // out of view.
  useEffect(() => {
    const prev = prevLengthRef.current;
    prevLengthRef.current = messages.length;
    if (messages.length <= prev) return;

    if (!pinnedRef.current) {
      // Preserve the earliest unread boundary across successive arrivals —
      // once a gap opens, the divider should anchor to where reading stopped,
      // not creep forward with every new message.
      setFirstUnreadIndex((current) => current ?? prev);
      return;
    }

    setFirstUnreadIndex(null);
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

  const scrollToBottom = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
  };

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
              </Fragment>
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
