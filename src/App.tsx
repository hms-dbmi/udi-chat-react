import { UDIChat } from '@/components/UDIChat';

/**
 * Standalone dev/demo entry. Configuration is driven by Vite env vars so the
 * same bundle can target different backends and datasets:
 *
 *   VITE_UDI_API_BASE_URL    UDIAgent server (default: http://localhost:8007)
 *   VITE_UDI_DATA_PACKAGE    Path/URL to a datapackage_udi.json
 *                            (default: /data/hubmap_2025-05-05/datapackage_udi.json)
 *   VITE_UDI_REQUIRE_API_KEY "true" to prompt for an OpenAI key in-app
 *   VITE_UDI_MODEL           Optional LLM model name override
 *
 * For the inline-DataPackage pattern (e.g. consuming a remote portal directly),
 * see `examples/hubmap-remote.tsx`.
 */
function App() {
  const apiBaseUrl = import.meta.env.VITE_UDI_API_BASE_URL ?? 'http://localhost:8007';
  const dataPackagePath =
    import.meta.env.VITE_UDI_DATA_PACKAGE ?? '/data/hubmap_2025-05-05/datapackage_udi.json';
  // Default ON for the standalone dev app — matches the original App.tsx
  // behavior. Set VITE_UDI_REQUIRE_API_KEY=false to skip the prompt.
  const requireApiKey = import.meta.env.VITE_UDI_REQUIRE_API_KEY !== 'false';
  const model = import.meta.env.VITE_UDI_MODEL;

  return (
    <div className="h-screen">
      <UDIChat
        apiBaseUrl={apiBaseUrl}
        dataPackagePath={dataPackagePath}
        requireApiKey={requireApiKey}
        model={model}
      />
    </div>
  );
}

export default App;
