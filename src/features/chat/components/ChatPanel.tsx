import { useCallback, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { useDataPackage, useGlobalStore } from '@/app/UDIChatContext';
import { ChatInput } from './ChatInput';
import { ApiKeyInput } from './ApiKeyInput';
import { MessageList } from './MessageList';
import { ChatHeaderBar } from './ChatHeaderBar';
import { DebugToggleSection } from './DebugToggleSection';
import { ClosedVisualizationsPanel } from './ClosedVisualizationsPanel';
import { useChatApi } from '../hooks/useChatApi';
import { useResetHandlers } from '../hooks/useResetHandlers';
import type { QueryConfig } from '../api/completions';

interface ChatPanelProps {
  config: QueryConfig;
  needsApiKey: boolean;
  hasApiKey: boolean;
  onSetApiKey: (key: string) => void;
  onClearApiKey: () => void;
  showDrawerToggle?: boolean;
  drawerOpen?: boolean;
  onToggleDrawer?: () => void;
}

export function ChatPanel({
  config,
  needsApiKey,
  hasApiKey,
  onSetApiKey,
  onClearApiKey,
  showDrawerToggle,
  onToggleDrawer,
}: ChatPanelProps) {
  const { sendMessage, isLoading, error } = useChatApi(config);
  const globalStore = useGlobalStore();
  const dataReady = useDataPackage((s) => s.loadingPhase === 'ready');
  const { handleReset } = useResetHandlers();
  const [showSystemPrompts, setShowSystemPrompts] = useState(false);

  // Single guarded entry point for every send path (ChatInput, example
  // prompts in ChatHeaderBar, suggested follow-ups in MessageList). Until
  // the data package is fully loaded, the LLM can't inspect data domains
  // or dispatch visualization tool calls, so we block the send entirely
  // instead of letting a half-initialized request go through.
  const handleSend = useCallback(
    (text: string) => {
      if (text.trim() === '!/admin') {
        globalStore.getState().toggleDebugMode();
        return;
      }
      if (!dataReady) return;
      sendMessage(text);
    },
    [sendMessage, globalStore, dataReady],
  );

  return (
    <div className="flex flex-col h-full">
      <ChatHeaderBar
        config={config}
        hasApiKey={hasApiKey}
        onClearApiKey={onClearApiKey}
        showDrawerToggle={showDrawerToggle}
        onToggleDrawer={onToggleDrawer}
        onReset={handleReset}
        onExampleClick={handleSend}
        isLoading={isLoading}
      />
      <Separator />
      <DebugToggleSection
        showSystemPrompts={showSystemPrompts}
        onShowSystemPromptsChange={setShowSystemPrompts}
      />
      <MessageList
        isLoading={isLoading}
        showSystemPrompts={showSystemPrompts}
        onSelectSuggestion={handleSend}
      />
      {error && (
        <div className="px-3 py-1">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      <ClosedVisualizationsPanel />
      {needsApiKey ? (
        <ApiKeyInput onSubmit={onSetApiKey} />
      ) : (
        <ChatInput
          onSend={handleSend}
          disabled={isLoading || !dataReady}
          placeholder={!dataReady ? 'Loading data...' : undefined}
        />
      )}
    </div>
  );
}
