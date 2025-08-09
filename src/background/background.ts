/// <reference path="../types/chrome.d.ts" />

import { 
  ChromeMessage, 
  ChromeMessageResponse, 
  StorageData, 
  ExtensionSettings,
  ApiKeyStatus
} from '../types/index.js';
import { GeminiClient } from '../utils/geminiClient.js';

class BackgroundService {
  private static readonly DEFAULT_SETTINGS: ExtensionSettings = {
    theme: 'auto',
    autoAnalyze: true,
    showNotifications: true,
    analysisDelay: 2000
  };

  constructor() {
    console.log('Background service initializing...');
    this.setupEventListeners();
    this.initializeExtension();
  }

  private setupEventListeners(): void {
    console.log('Setting up background event listeners...');
    
    chrome.runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
      console.log('Extension installed/updated:', details.reason);
      if (details.reason === 'install') {
        this.handleFirstInstall();
      } else if (details.reason === 'update') {
        this.handleUpdate(details.previousVersion);
      }
    });

    chrome.runtime.onMessage.addListener((
      message: ChromeMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: ChromeMessageResponse) => void
    ) => {
      console.log('Message received in background:', message.type, message);
      
      // Handle the message asynchronously
      this.handleMessage(message, sender, sendResponse)
        .catch(error => {
          console.error('Error handling message:', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        });
      
      return true; // Keep message channel open for async response
    });

    chrome.runtime.onStartup.addListener(() => {
      console.log('Extension startup');
      this.initializeExtension();
    });

    console.log('Background event listeners setup complete');
  }

  private async handleFirstInstall(): Promise<void> {
    try {
      await this.setDefaultSettings();
      chrome.tabs.create({
        url: chrome.runtime.getURL('dist/setup/apiSetup.html')
      });
    } catch (error) {
      console.error('Failed to handle first install:', error);
    }
  }

  private async handleUpdate(previousVersion?: string): Promise<void> {
    try {
      await this.migrateSettings(previousVersion);
    } catch (error) {
      console.error('Failed to handle update:', error);
    }
  }

  private async initializeExtension(): Promise<void> {
    try {
      const settings = await this.getSettings();
      if (!settings) {
        await this.setDefaultSettings();
      }

      const apiKey = await this.getApiKey();
      if (apiKey) {
        await this.validateApiKey(apiKey);
      }
    } catch (error) {
      console.error('Failed to initialize extension:', error);
    }
  }

  private async handleMessage(
    message: ChromeMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ChromeMessageResponse) => void
  ): Promise<void> {
    try {
      console.log('Handling message:', message.type);
      
      switch (message.type) {
        case 'GET_API_KEY':
          const apiKey = await this.getApiKey();
          sendResponse({ success: true, data: apiKey });
          break;

        case 'SET_API_KEY':
          const isValid = await this.setApiKey(message.data);
          sendResponse({ success: isValid, data: isValid });
          break;

        case 'TEST_API_KEY':
          console.log('Testing API key in background script...');
          const testResult = await this.testApiKey(message.data);
          console.log('Test result:', testResult);
          sendResponse({ 
            success: testResult.isValid, 
            ...(testResult.error && { error: testResult.error })
          });
          break;

        case 'PING':
          console.log('Ping received in background');
          sendResponse({ success: true, data: 'pong' });
          break;

        case 'GET_SETTINGS':
          const settings = await this.getSettings();
          sendResponse({ success: true, data: settings });
          break;

        case 'SET_SETTINGS':
          await this.setSettings(message.data);
          sendResponse({ success: true });
          break;

        case 'ANALYZE_CODE':
          sendResponse({ success: true, data: 'Analysis request received' });
          break;

        default:
          console.warn('Unknown message type:', message.type);
          sendResponse({ 
            success: false, 
            error: `Unknown message type: ${message.type}` 
          });
      }
    } catch (error) {
      console.error('Error in handleMessage:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private async getApiKey(): Promise<string | undefined> {
    try {
      const result = await chrome.storage.local.get(['apiKey']);
      return result.apiKey;
    } catch (error) {
      console.error('Failed to get API key:', error);
      return undefined;
    }
  }

  private async setApiKey(apiKey: string): Promise<boolean> {
    try {
      const validation = await GeminiClient.testApiKey(apiKey);
      
      if (validation.isValid) {
        await chrome.storage.local.set({ apiKey });
        
        const status: ApiKeyStatus = {
          isValid: true,
          lastChecked: Date.now()
        };
        await chrome.storage.local.set({ apiKeyStatus: status });
        
        return true;
      } else {
        const status: ApiKeyStatus = {
          isValid: false,
          lastChecked: Date.now(),
          ...(validation.error && { error: validation.error })
        };
        await chrome.storage.local.set({ apiKeyStatus: status });
        
        return false;
      }
    } catch (error) {
      console.error('Failed to set API key:', error);
      return false;
    }
  }

  private async testApiKey(apiKey: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      console.log('Background: testing API key...');
      const result = await GeminiClient.testApiKey(apiKey);
      console.log('Background: test result:', result);
      return result;
    } catch (error) {
      console.error('Background: test error:', error);
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async validateApiKey(apiKey: string): Promise<void> {
    try {
      const validation = await GeminiClient.testApiKey(apiKey);
      
      const status: ApiKeyStatus = {
        isValid: validation.isValid,
        lastChecked: Date.now(),
        ...(validation.error && { error: validation.error })
      };
      
      await chrome.storage.local.set({ apiKeyStatus: status });
    } catch (error) {
      console.error('Failed to validate API key:', error);
      
      const status: ApiKeyStatus = {
        isValid: false,
        lastChecked: Date.now(),
        error: 'Validation failed'
      };
      
      await chrome.storage.local.set({ apiKeyStatus: status });
    }
  }

  private async getSettings(): Promise<ExtensionSettings | undefined> {
    try {
      const result = await chrome.storage.local.get(['settings']);
      return result.settings;
    } catch (error) {
      console.error('Failed to get settings:', error);
      return undefined;
    }
  }

  private async setSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings() || BackgroundService.DEFAULT_SETTINGS;
      const newSettings = { ...currentSettings, ...settings };
      await chrome.storage.local.set({ settings: newSettings });
    } catch (error) {
      console.error('Failed to set settings:', error);
      throw error;
    }
  }

  private async setDefaultSettings(): Promise<void> {
    try {
      await chrome.storage.local.set({ 
        settings: BackgroundService.DEFAULT_SETTINGS 
      });
    } catch (error) {
      console.error('Failed to set default settings:', error);
      throw error;
    }
  }

  private async migrateSettings(previousVersion?: string): Promise<void> {
    try {
      console.log(`Migrating from version ${previousVersion}`);
    } catch (error) {
      console.error('Failed to migrate settings:', error);
    }
  }

  private async getAllStorageData(): Promise<Partial<StorageData>> {
    try {
      const result = await chrome.storage.local.get();
      return result as Partial<StorageData>;
    } catch (error) {
      console.error('Failed to get storage data:', error);
      return {};
    }
  }

  private async clearAllData(): Promise<void> {
    try {
      await chrome.storage.local.clear();
      await this.setDefaultSettings();
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw error;
    }
  }
}

// Initialize the background service immediately
console.log('Initializing background service...');
const backgroundService = new BackgroundService();
console.log('Background service initialized');
