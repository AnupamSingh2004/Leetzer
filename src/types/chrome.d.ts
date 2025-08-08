// Chrome Extension API type definitions
declare namespace chrome {
  namespace runtime {
    interface Event<T extends Function> {
      addListener(callback: T): void;
      removeListener(callback: T): void;
      hasListener(callback: T): boolean;
    }

    interface InstalledDetails {
      reason: 'install' | 'update' | 'chrome_update' | 'shared_module_update';
      previousVersion?: string;
    }

    interface MessageSender {
      tab?: chrome.tabs.Tab;
      frameId?: number;
      id?: string;
      url?: string;
      tlsChannelId?: string;
    }

    const onInstalled: Event<(details: InstalledDetails) => void>;
    const onMessage: Event<(message: any, sender: MessageSender, sendResponse: (response: any) => void) => void>;
    const onStartup: Event<() => void>;

    function getURL(path: string): string;
    function sendMessage(message: any): Promise<any>;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      index: number;
      windowId: number;
      highlighted: boolean;
      active: boolean;
      pinned: boolean;
      url?: string;
      title?: string;
      incognito: boolean;
    }

    interface CreateProperties {
      url?: string;
      active?: boolean;
      pinned?: boolean;
      index?: number;
      windowId?: number;
    }

    function create(createProperties: CreateProperties): Promise<Tab>;
    function query(queryInfo: { active?: boolean; currentWindow?: boolean }): Promise<Tab[]>;
  }

  namespace storage {
    interface StorageArea {
      get(keys?: string | string[] | { [key: string]: any } | null): Promise<{ [key: string]: any }>;
      set(items: { [key: string]: any }): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
    }

    const local: StorageArea;
    const sync: StorageArea;
  }
}