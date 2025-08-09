/// <reference types="../types/chrome"/>

/**
 * API Setup page script
 */
class ApiSetupManager {
  private apiKeyInput: HTMLInputElement | null = null;
  private toggleVisibilityBtn: HTMLElement | null = null;
  private testBtn: HTMLElement | null = null;
  private saveBtn: HTMLElement | null = null;
  private validationResult: HTMLElement | null = null;
  private statusIndicator: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;
  private settingsElements: Record<string, HTMLElement> = {};

  constructor() {
    this.init();
  }

  /**
   * Initializes the setup page
   */
  private async init(): Promise<void> {
    try {
      this.setupElements();
      this.setupEventListeners();
      await this.loadCurrentSettings();
      await this.checkCurrentStatus();
    } catch (error) {
      console.error('Failed to initialize API setup:', error);
      this.showError('Failed to initialize setup page');
    }
  }

  /**
   * Sets up DOM element references
   */
  private setupElements(): void {
    this.apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
    this.toggleVisibilityBtn = document.getElementById('toggle-visibility');
    this.testBtn = document.getElementById('test-api-key');
    this.saveBtn = document.getElementById('save-api-key');
    this.validationResult = document.getElementById('validation-result');
    this.statusIndicator = document.querySelector('.status-dot');
    this.statusText = document.querySelector('.status-text');

    // Settings elements
    this.settingsElements = {
      theme: document.getElementById('theme-select') as HTMLSelectElement,
      autoAnalyze: document.getElementById('auto-analyze') as HTMLInputElement,
      showNotifications: document.getElementById('show-notifications') as HTMLInputElement,
      analysisDelay: document.getElementById('analysis-delay') as HTMLSelectElement
    };
  }

  /**
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    console.log('Setting up event listeners...');
    
    // API key input
    if (this.apiKeyInput) {
      console.log('API key input found, adding listeners');
      this.apiKeyInput.addEventListener('input', () => {
        console.log('Input event triggered');
        this.onApiKeyChange();
      });

      this.apiKeyInput.addEventListener('paste', () => {
        console.log('Paste event triggered');
        // Small delay to allow paste to complete
        setTimeout(() => this.onApiKeyChange(), 10);
      });

      this.apiKeyInput.addEventListener('keyup', () => {
        console.log('Keyup event triggered');
        this.onApiKeyChange();
      });
    } else {
      console.error('API key input not found!');
    }

    // Toggle visibility
    this.toggleVisibilityBtn?.addEventListener('click', () => {
      this.toggleApiKeyVisibility();
    });

    // Buttons
    if (this.testBtn) {
      console.log('Test button found, adding listener');
      this.testBtn.addEventListener('click', () => {
        console.log('Test button clicked');
        this.testApiKey();
      });
    } else {
      console.error('Test button not found!');
    }

    if (this.saveBtn) {
      console.log('Save button found, adding listener');
      this.saveBtn.addEventListener('click', () => {
        console.log('Save button clicked');
        this.saveApiKey();
      });
    } else {
      console.error('Save button not found!');
    }

    // Settings
    document.getElementById('save-settings')?.addEventListener('click', () => {
      this.saveSettings();
    });

    // Footer links
    document.getElementById('privacy-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openPrivacyPolicy();
    });

    document.getElementById('help-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openHelp();
    });

    document.getElementById('feedback-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openFeedback();
    });

    console.log('Event listeners setup complete');
  }

  /**
   * Handles API key input changes
   */
  private onApiKeyChange(): void {
    const apiKey = this.apiKeyInput?.value.trim() || '';
    const isValid = this.isValidApiKeyFormat(apiKey);

    console.log('API key changed:', { 
      length: apiKey.length, 
      isValid, 
      prefix: apiKey.substring(0, 4) 
    });

    // Update button states
    if (this.testBtn) {
      (this.testBtn as HTMLButtonElement).disabled = !isValid;
      console.log('Test button disabled:', !isValid);
    }
    if (this.saveBtn) {
      (this.saveBtn as HTMLButtonElement).disabled = !isValid;
      console.log('Save button disabled:', !isValid);
    }

    // Update input styling
    if (this.apiKeyInput) {
      this.apiKeyInput.classList.remove('valid', 'invalid');
      if (apiKey.length > 0) {
        this.apiKeyInput.classList.add(isValid ? 'valid' : 'invalid');
      }
    }

    // Hide validation result when user types
    this.hideValidationResult();
  }

  /**
   * Validates API key format
   */
  private isValidApiKeyFormat(apiKey: string): boolean {
    // Gemini API keys can start with different prefixes and have varying lengths
    // Common formats: AIzaXXX, AIzaSyXXX, etc.
    // Length is typically between 35-45 characters
    return (
      apiKey.length >= 20 && 
      apiKey.length <= 100 && 
      /^[A-Za-z0-9_-]+$/.test(apiKey) &&
      (apiKey.startsWith('AIza') || apiKey.startsWith('ya29') || apiKey.length >= 35)
    );
  }

  /**
   * Toggles API key visibility
   */
  private toggleApiKeyVisibility(): void {
    if (!this.apiKeyInput) return;

    const isPassword = this.apiKeyInput.type === 'password';
    this.apiKeyInput.type = isPassword ? 'text' : 'password';
    
    if (this.toggleVisibilityBtn) {
      this.toggleVisibilityBtn.textContent = isPassword ? '🙈' : '👁️';
    }
  }

  /**
   * Tests the API key
   */
  private async testApiKey(): Promise<void> {
    const apiKey = this.apiKeyInput?.value.trim();
    if (!apiKey || !this.isValidApiKeyFormat(apiKey)) {
      this.showValidationResult('Please enter a valid API key', 'error');
      return;
    }

    try {
      console.log('Starting API key test...');
      this.setButtonLoading(this.testBtn, true);
      this.hideValidationResult();

      // Skip ping test for now and go directly to API test
      console.log('Skipping ping test, testing API key directly...');

      // Test the API key with a timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('API test timed out after 20 seconds')), 20000);
      });

      const testPromise = chrome.runtime.sendMessage({
        type: 'TEST_API_KEY',
        data: apiKey
      });

      const response = await Promise.race([testPromise, timeoutPromise]);
      console.log('API test response received:', response);

      if (response && response.success) {
        this.showValidationResult('✅ API key is valid and working!', 'success');
        this.updateStatus('connected', 'Connected');
      } else {
        const errorMessage = response?.error || 'API key validation failed';
        this.showValidationResult(`❌ ${errorMessage}`, 'error');
        this.updateStatus('disconnected', 'Invalid API key');
      }
    } catch (error) {
      console.error('Test API key error:', error);
      if (error instanceof Error && error.message.includes('timed out')) {
        this.showValidationResult('❌ Test request timed out. Please check your internet connection and try again.', 'error');
      } else if (error instanceof Error && error.message.includes('Extension context invalidated')) {
        this.showValidationResult('❌ Extension was reloaded. Please refresh this page and try again.', 'error');
      } else if (error instanceof Error && error.message.includes('Could not establish connection')) {
        this.showValidationResult('❌ Could not connect to extension background. Please reload the extension.', 'error');
      } else if (error instanceof Error && error.message.includes('Receiving end does not exist')) {
        this.showValidationResult('❌ Extension background script not loaded. Please reload the extension.', 'error');
      } else {
        this.showValidationResult('❌ Failed to test API key. Please reload the extension and try again.', 'error');
      }
      this.updateStatus('disconnected', 'Connection failed');
    } finally {
      this.setButtonLoading(this.testBtn, false);
    }
  }

  /**
   * Saves the API key
   */
  private async saveApiKey(): Promise<void> {
    const apiKey = this.apiKeyInput?.value.trim();
    if (!apiKey || !this.isValidApiKeyFormat(apiKey)) {
      this.showValidationResult('Please enter a valid API key', 'error');
      return;
    }

    try {
      this.setButtonLoading(this.saveBtn, true);
      this.hideValidationResult();

      const response = await chrome.runtime.sendMessage({
        type: 'SET_API_KEY',
        data: apiKey
      });

      if (response.success) {
        this.showValidationResult('✅ API key saved successfully!', 'success');
        this.updateStatus('connected', 'Connected');
        
        // Flash success
        document.body.classList.add('success-flash');
        setTimeout(() => {
          document.body.classList.remove('success-flash');
        }, 500);

        // Redirect after a delay
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        this.showValidationResult(`❌ ${response.error || 'Failed to save API key'}`, 'error');
      }
    } catch (error) {
      this.showValidationResult('❌ Failed to save API key', 'error');
    } finally {
      this.setButtonLoading(this.saveBtn, false);
    }
  }

  /**
   * Saves extension settings
   */
  private async saveSettings(): Promise<void> {
    try {
      const settings = {
        theme: (this.settingsElements.theme as HTMLSelectElement).value,
        autoAnalyze: (this.settingsElements.autoAnalyze as HTMLInputElement).checked,
        showNotifications: (this.settingsElements.showNotifications as HTMLInputElement).checked,
        analysisDelay: parseInt((this.settingsElements.analysisDelay as HTMLSelectElement).value)
      };

      const response = await chrome.runtime.sendMessage({
        type: 'SET_SETTINGS',
        data: settings
      });

      if (response.success) {
        this.showNotification('Settings saved successfully!');
      } else {
        this.showNotification('Failed to save settings', 'error');
      }
    } catch (error) {
      this.showNotification('Failed to save settings', 'error');
    }
  }

  /**
   * Loads current settings
   */
  private async loadCurrentSettings(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      
      if (response.success && response.data) {
        const settings = response.data;
        
        if (this.settingsElements.theme) {
          (this.settingsElements.theme as HTMLSelectElement).value = settings.theme || 'auto';
        }
        if (this.settingsElements.autoAnalyze) {
          (this.settingsElements.autoAnalyze as HTMLInputElement).checked = settings.autoAnalyze ?? true;
        }
        if (this.settingsElements.showNotifications) {
          (this.settingsElements.showNotifications as HTMLInputElement).checked = settings.showNotifications ?? true;
        }
        if (this.settingsElements.analysisDelay) {
          (this.settingsElements.analysisDelay as HTMLSelectElement).value = (settings.analysisDelay || 2000).toString();
        }
      }

      // Load API key
      const apiResponse = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
      if (apiResponse.success && apiResponse.data && this.apiKeyInput) {
        this.apiKeyInput.value = apiResponse.data;
        this.onApiKeyChange();
      }
    } catch (error) {
      console.error('Failed to load current settings:', error);
    }
  }

  /**
   * Checks current API status
   */
  private async checkCurrentStatus(): Promise<void> {
    try {
      this.updateStatus('checking', 'Checking...');

      const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
      
      if (response.success && response.data) {
        // Check stored status
        const statusResult = await chrome.storage.local.get(['apiKeyStatus']);
        const apiKeyStatus = statusResult.apiKeyStatus;

        if (apiKeyStatus?.isValid) {
          this.updateStatus('connected', 'Connected');
        } else {
          this.updateStatus('disconnected', apiKeyStatus?.error || 'Invalid API key');
        }
      } else {
        this.updateStatus('disconnected', 'No API key configured');
      }
    } catch (error) {
      this.updateStatus('disconnected', 'Status check failed');
    }
  }

  /**
   * Updates status display
   */
  private updateStatus(status: 'checking' | 'connected' | 'disconnected', text: string): void {
    if (this.statusIndicator) {
      this.statusIndicator.className = `status-dot ${status}`;
    }
    
    if (this.statusText) {
      this.statusText.textContent = text;
    }
  }

  /**
   * Shows validation result
   */
  private showValidationResult(message: string, type: 'success' | 'error'): void {
    if (!this.validationResult) return;

    this.validationResult.textContent = message;
    this.validationResult.className = `validation-result ${type}`;
    this.validationResult.style.display = 'block';
  }

  /**
   * Hides validation result
   */
  private hideValidationResult(): void {
    if (this.validationResult) {
      this.validationResult.style.display = 'none';
    }
  }

  /**
   * Sets button loading state
   */
  private setButtonLoading(button: HTMLElement | null, isLoading: boolean): void {
    if (!button) return;

    const text = button.querySelector('.btn-text') as HTMLElement;
    const loader = button.querySelector('.btn-loader') as HTMLElement;
    
    if (text && loader) {
      text.style.display = isLoading ? 'none' : 'inline';
      loader.style.display = isLoading ? 'inline' : 'none';
    }
    
    (button as HTMLButtonElement).disabled = isLoading;
  }

  /**
   * Shows notification
   */
  private showNotification(message: string, type: 'success' | 'error' = 'success'): void {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ef4444' : '#10b981'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-size: 14px;
      transition: all 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Shows error message
   */
  private showError(message: string): void {
    this.showValidationResult(`❌ ${message}`, 'error');
  }

  /**
   * Opens privacy policy
   */
  private openPrivacyPolicy(): void {
    chrome.tabs.create({ 
      url: 'https://github.com/your-username/leetcode-analyzer/blob/main/PRIVACY.md'
    });
  }

  /**
   * Opens help documentation
   */
  private openHelp(): void {
    chrome.tabs.create({ 
      url: 'https://github.com/your-username/leetcode-analyzer/wiki'
    });
  }

  /**
   * Opens feedback form
   */
  private openFeedback(): void {
    chrome.tabs.create({ 
      url: 'https://forms.gle/your-feedback-form'
    });
  }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ApiSetupManager());
} else {
  new ApiSetupManager();
}
