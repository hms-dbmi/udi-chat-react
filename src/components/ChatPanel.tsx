import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RotateCcw, KeyRound, RotateCw, Save } from 'lucide-react';
import { useConversation, useGlobal, useGlobalStore } from '@/stores/UDIChatContext';
import { ChatInput } from './ChatInput';
import { ApiKeyInput } from './ApiKeyInput';
import { MessageList } from './MessageList';
import { useChatApi } from '@/hooks/useChatApi';
import { useConversationStore, useDashboardStore, useSelectionsStore, useMemoryBank, useMemoryBankStore, useDataFiltersStore } from '@/stores/UDIChatContext';
import type { QueryConfig } from '@/api/completions';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ChatPanelProps {
  config: QueryConfig;
  needsApiKey: boolean;
  hasApiKey: boolean;
  onSetApiKey: (key: string) => void;
  onClearApiKey: () => void;
}

export function ChatPanel({ config, needsApiKey, hasApiKey, onSetApiKey, onClearApiKey }: ChatPanelProps) {
  const { sendMessage, isLoading, error } = useChatApi(config);
  const messages = useConversation((s) => s.messages);
  const conversationStore = useConversationStore();
  const globalStore = useGlobalStore();
  const debugMode = useGlobal((s) => s.debugMode);
  const [examplePrompts, setExamplePrompts] = useState<string[]>([]);
  const hasUserMessages = messages.some((m) => m.role === 'user');

  useEffect(() => {
    if (!config.apiBaseUrl) return;
    fetch(`${config.apiBaseUrl}/v1/yac/examples`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data)) {
          const prompts = data
            .map((p: unknown) => (typeof p === 'string' ? p.trim() : ''))
            .filter((p: string) => p.length > 0);
          setExamplePrompts(prompts);
        }
      })
      .catch(() => {});
  }, [config.apiBaseUrl]);
  const dashboardStore = useDashboardStore();
  const selectionsStore = useSelectionsStore();
  const memoryBankStore = useMemoryBankStore();
  const dataFiltersStore = useDataFiltersStore();
  const closedVisualizations = useMemoryBank((s) => s.closedVisualizations);

  const handleReset = useCallback(() => {
    conversationStore.getState().newConversation();
    dashboardStore.getState().clearAllVisualizations();
    selectionsStore.getState().clearSelections();
    memoryBankStore.getState().clearMemoryBank();
    dataFiltersStore.getState().resetFilters();
  }, [conversationStore, dashboardStore, selectionsStore, memoryBankStore, dataFiltersStore]);

  const handleRestore = useCallback(
    (key: string) => {
      dashboardStore.getState().restoreFromMemoryBank(key, memoryBankStore);
    },
    [dashboardStore, memoryBankStore],
  );

  const handleSend = useCallback(
    (text: string) => {
      if (text.trim() === '!/admin') {
        globalStore.getState().toggleDebugMode();
        return;
      }
      sendMessage(text);
    },
    [sendMessage, globalStore],
  );

  const handleSuggestion = useCallback(
    (suggestion: string) => {
      sendMessage(suggestion);
    },
    [sendMessage],
  );

  const handleSaveConversation = useCallback(() => {
    const json = conversationStore.getState().exportConversation();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `udi-conversation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [conversationStore]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-sm font-semibold">Chat</h2>
        <div className="flex items-center gap-1">
          {hasApiKey && (
            <Tooltip>
              <TooltipTrigger
                render={<Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClearApiKey} />}
              >
                <KeyRound className="h-3.5 w-3.5 text-green-600" />
              </TooltipTrigger>
              <TooltipContent>API key set — click to clear</TooltipContent>
            </Tooltip>
          )}
          {debugMode && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveConversation} title="Save conversation">
              <Save className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <Separator />

      {/* Messages */}
      <MessageList isLoading={isLoading} onSelectSuggestion={handleSuggestion} />

      {/* Error */}
      {error && (
        <div className="px-3 py-1">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Recently closed visualizations */}
      {closedVisualizations.size > 0 && (
        <div className="px-3 py-1.5 border-t">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Recently Closed
          </p>
          <div className="flex flex-col gap-0.5 max-h-20 overflow-y-auto">
            {Array.from(closedVisualizations.entries()).map(([key, viz]) => (
              <button
                key={key}
                className="flex items-center gap-1.5 text-xs text-left hover:bg-muted rounded px-1.5 py-0.5 w-full"
                onClick={() => handleRestore(key)}
              >
                <RotateCw className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{viz.title ?? viz.userPrompt}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Example prompts */}
      {!hasUserMessages && examplePrompts.length > 0 && !needsApiKey && (
        <div className="px-3 py-1.5 border-t">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Try asking
          </p>
          <div className="flex flex-col gap-0.5 max-h-28 overflow-y-auto">
            {examplePrompts.map((prompt, i) => (
              <button
                key={i}
                className="text-xs text-left text-foreground hover:bg-muted rounded px-1.5 py-1 w-full truncate shrink-0"
                onClick={() => sendMessage(prompt)}
                disabled={isLoading}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area: either API key prompt or chat input */}
      {needsApiKey ? (
        <ApiKeyInput onSubmit={onSetApiKey} />
      ) : (
        <ChatInput onSend={handleSend} disabled={isLoading} />
      )}
    </div>
  );
}
