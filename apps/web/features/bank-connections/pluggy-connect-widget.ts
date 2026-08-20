/**
 * Thin wrapper around the Pluggy Connect widget (hosted by Pluggy, loaded via
 * their public CDN script per https://docs.pluggy.ai/docs/pluggy-connect-introduction).
 * The widget handles bank-credential entry entirely client-side — this app
 * never sees or stores those credentials (FR-001, research.md R2).
 */

export interface PluggyItemSuccessData {
  item: { id: string };
}

export interface PluggyConnectHandlers {
  onSuccess: (itemId: string) => void;
  onError: (error: unknown) => void;
  onClose?: () => void;
}

interface PluggyConnectInstance {
  init(): void;
}

interface PluggyConnectConstructor {
  new (options: {
    connectToken: string;
    includeSandbox?: boolean;
    onSuccess: (data: PluggyItemSuccessData) => void;
    onError: (error: unknown) => void;
    onClose?: () => void;
  }): PluggyConnectInstance;
}

declare global {
  interface Window {
    PluggyConnect?: PluggyConnectConstructor;
  }
}

const WIDGET_SCRIPT_SRC = 'https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js';

let widgetScriptPromise: Promise<void> | null = null;

function loadWidgetScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Pluggy Connect widget requires a browser environment'));
  }
  if (window.PluggyConnect) return Promise.resolve();
  if (!widgetScriptPromise) {
    widgetScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = WIDGET_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Falha ao carregar o widget Pluggy Connect'));
      document.body.appendChild(script);
    });
  }
  return widgetScriptPromise;
}

/** Loads (if needed) and opens the Pluggy Connect widget for the given connect token. */
export async function openPluggyConnect(
  connectToken: string,
  { onSuccess, onError, onClose }: PluggyConnectHandlers,
): Promise<void> {
  await loadWidgetScript();
  if (!window.PluggyConnect) {
    onError(new Error('Widget Pluggy Connect indisponível'));
    return;
  }
  const widget = new window.PluggyConnect({
    connectToken,
    // Pluggy hides sandbox institutions from the widget by default — needed until the
    // Pluggy app is approved for production connectors (https://docs.pluggy.ai/docs/connectors).
    // includeSandbox: process.env.NEXT_PUBLIC_PLUGGY_INCLUDE_SANDBOX === 'true',
    includeSandbox: true,
    onSuccess: (data) => onSuccess(data.item.id),
    onError,
    onClose,
  });
  widget.init();
}
