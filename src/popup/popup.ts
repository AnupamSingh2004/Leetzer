/// <reference path="../types/chrome.d.ts" />

class PopupManager {
  private apiStatusIndicator: HTMLElement | null = null;
  private apiStatusText: HTMLElement | null = null;
  private recentActivityList: HTMLElement | null = null;
  private statisticsElements: Record<string, HTMLElement | null> = {};

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.setupElements();
      this.setupEventListeners();
      await this.loadAndDisplayData();
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showErrorState();
    }
  }

  private setupElements(): void {
    this.apiStatusIndicator = document.querySelector('.status-dot');
    this.apiStatusText = document.querySelector('.status-text');
    this.recentActivityList = document.getElementById('recent-activity');
    
    // Statistics elements
    this.statisticsElements = {
      problemsAnalyzed: document.getElementById('problems-analyzed'),
      errorsFound: document.getElementById('errors-found'),
      solutionsGenerated: document.getElementById('solutions-generated'),
      optimizationsSuggested: document.getElementById('optimizations-suggested')
    };
  }

  private setupEventListeners(): void {
    // Quick action buttons
    document.getElementById('analyze-current')?.addEventListener('click', () => {
      this.analyzeCurrentCode();
    });

    document.getElementById('check-complexity')?.addEventListener('click', () => {
      this.checkTimeComplexity();
    });

    document.getElementById('find-errors')?.addEventListener('click', () => {
      this.findCodeErrors();
    });

    document.getElementById('open-settings')?.addEventListener('click', () => {
      this.openSettings();
    });

    // Footer links
    document.getElementById('privacy-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openPrivacyPolicy();
    });

    document.getElementById('support-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openSupport();
    });

    document.getElementById('feedback-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openFeedback();
    });
  }

  private async loadAndDisplayData(): Promise<void> {
    await Promise.all([
      this.checkApiStatus(),
      this.loadRecentActivity(),
      this.loadStatistics()
    ]);
  }

  private async checkApiStatus(): Promise<void> {
    try {
      this.updateApiStatus('checking', 'Checking...');

      const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
      
      if (response.success && response.data) {
        const statusResponse = await chrome.storage.local.get(['apiKeyStatus']);
        const apiKeyStatus = statusResponse.apiKeyStatus;

        if (apiKeyStatus?.isValid) {
          this.updateApiStatus('connected', 'Connected');
        } else {
          this.updateApiStatus('disconnected', apiKeyStatus?.error || 'Invalid API key');
        }
      } else {
        this.updateApiStatus('disconnected', 'No API key configured');
      }
    } catch (error) {
      this.updateApiStatus('disconnected', 'Connection failed');
    }
  }

  private updateApiStatus(status: 'checking' | 'connected' | 'disconnected', text: string): void {
    if (this.apiStatusIndicator) {
      this.apiStatusIndicator.className = `status-dot ${status}`;
    }
    
    if (this.apiStatusText) {
      this.apiStatusText.textContent = text;
    }
  }

  private async loadRecentActivity(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['recentActivity']);
      const activities = result.recentActivity || [];

      if (this.recentActivityList) {
        if (activities.length === 0) {
          this.recentActivityList.innerHTML = `
            <div class="activity-item">
              <span class="activity-icon">📊</span>
              <div class="activity-content">
                <div class="activity-title">No recent activity</div>
                <div class="activity-time">Start analyzing problems to see history</div>
              </div>
            </div>
          `;
        } else {
          this.recentActivityList.innerHTML = activities
            .slice(0, 3)
            .map((activity: any) => `
              <div class="activity-item">
                <span class="activity-icon">${this.getActivityIcon(activity.type)}</span>
                <div class="activity-content">
                  <div class="activity-title">${this.escapeHtml(activity.title)}</div>
                  <div class="activity-time">${this.formatTime(activity.timestamp)}</div>
                </div>
              </div>
            `).join('');
        }
      }
    } catch (error) {
      console.error('Failed to load recent activity:', error);
    }
  }

  private async loadStatistics(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['statistics']);
      const stats = result.statistics || {
        problemsAnalyzed: 0,
        errorsFound: 0,
        solutionsGenerated: 0,
        optimizationsSuggested: 0
      };

      this.updateStatistic('problemsAnalyzed', stats.problemsAnalyzed);
      this.updateStatistic('errorsFound', stats.errorsFound);
      this.updateStatistic('solutionsGenerated', stats.solutionsGenerated);
      this.updateStatistic('optimizationsSuggested', stats.optimizationsSuggested);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }

  private updateStatistic(key: string, value: number): void {
    const element = this.statisticsElements[key];
    if (element) {
      element.textContent = value.toString();
    }
  }

  private async openCurrentPage(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab?.url?.includes('leetcode.com/problems/')) {
        window.close();
      } else {
        chrome.tabs.create({ url: 'https://leetcode.com/problemset/all/' });
        window.close();
      }
    } catch (error) {
      console.error('Failed to open current page:', error);
    }
  }

  private openSettings(): void {
    chrome.tabs.create({ 
      url: chrome.runtime.getURL('dist/setup/apiSetup.html') 
    });
    window.close();
  }

  private openHelp(): void {
    chrome.tabs.create({ 
      url: 'https://github.com/your-username/leetcode-analyzer/wiki' 
    });
    window.close();
  }

  private openPrivacyPolicy(): void {
    chrome.tabs.create({ 
      url: 'https://github.com/your-username/leetcode-analyzer/blob/main/PRIVACY.md' // Replace with actual privacy URL
    });
  }

  private async analyzeCurrentCode(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      console.log('Current tab URL:', tab?.url);
      
      if (!tab?.url?.includes('leetcode.com/problems/')) {
        this.showNotification('Please navigate to a LeetCode problem page first');
        return;
      }

      if (!tab.id) {
        this.showNotification('Unable to access current tab');
        return;
      }

      console.log('Sending TRIGGER_ANALYSIS message to tab:', tab.id);

      let contentScriptLoaded = false;
      try {
        const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
        if (pingResponse && pingResponse.loaded) {
          contentScriptLoaded = true;
          console.log('Content script already loaded and responsive');
        }
      } catch (pingError) {
        console.log('Content script not responding to ping:', pingError);
      }

      if (contentScriptLoaded) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { 
            type: 'TRIGGER_ANALYSIS',
            action: 'analyze'
          });
          
          console.log('Response from content script:', response);
          this.showNotification('Code analysis started!');
          window.close();
          return;
        } catch (messageError) {
          console.log('Failed to trigger analysis despite ping success:', messageError);
        }
      }

      console.log('Injecting content script manually...');
      
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { 
          type: 'TRIGGER_ANALYSIS',
          action: 'analyze'
        });
        
        console.log('Response from content script:', response);
        this.showNotification('Code analysis started!');
        window.close();
      } catch (messageError) {
        console.log('Content script not loaded, injecting it manually...', messageError);
        
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['dist/content/content-bundled.js']
          });

          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['dist/content/content.css']
          });

          console.log('Scripts injected successfully, waiting...');

          await new Promise(resolve => setTimeout(resolve, 2000));

          console.log('Attempting to send message after injection...');

          const response = await chrome.tabs.sendMessage(tab.id, { 
            type: 'TRIGGER_ANALYSIS',
            action: 'analyze'
          });
          
          console.log('Response after manual injection:', response);
          this.showNotification('Code analysis started!');
          window.close();
        } catch (injectionError) {
          console.error('Script injection failed:', injectionError);
          this.showNotification('Failed to load extension on this page. Please refresh the page and try again.');
        }
      }
    } catch (error) {
      console.error('Error in analyzeCurrentCode:', error);
      if (error instanceof Error && error.message.includes('Could not establish connection')) {
        this.showNotification('Unable to connect to page. Please refresh and try again.');
      } else if (error instanceof Error && error.message.includes('Receiving end does not exist')) {
        this.showNotification('Page communication failed. Please refresh and try again.');
      } else {
        this.showNotification('Failed to analyze code. Please refresh the page and try again.');
      }
    }
  }

  private async checkTimeComplexity(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.url?.includes('leetcode.com/problems/')) {
        this.showNotification('Please navigate to a LeetCode problem page first');
        return;
      }

      if (!tab.id) {
        this.showNotification('Unable to access current tab');
        return;
      }

      try {
        const response = await chrome.tabs.sendMessage(tab.id, { 
          type: 'TRIGGER_ANALYSIS',
          action: 'complexity'
        });
        
        this.showNotification('Time complexity analysis started!');
        window.close();
      } catch (messageError) {
        console.log('Content script not loaded for complexity check, injecting it manually...', messageError);
        
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['dist/content/content-bundled.js']
          });

          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['dist/content/content.css']
          });

          console.log('Scripts injected for complexity check, waiting...');
          
          await new Promise(resolve => setTimeout(resolve, 2000));

          const response = await chrome.tabs.sendMessage(tab.id, { 
            type: 'TRIGGER_ANALYSIS',
            action: 'complexity'
          });
          
          this.showNotification('Time complexity analysis started!');
          window.close();
        } catch (injectionError) {
          console.error('Script injection failed for complexity check:', injectionError);
          this.showNotification('Failed to load extension on this page. Please refresh the page and try again.');
        }
      }
    } catch (error) {
      console.error('Error in checkTimeComplexity:', error);
      this.showNotification('Failed to analyze complexity. Please refresh the page and try again.');
    }
  }

  private async findCodeErrors(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.url?.includes('leetcode.com/problems/')) {
        this.showNotification('Please navigate to a LeetCode problem page first');
        return;
      }

      if (!tab.id) {
        this.showNotification('Unable to access current tab');
        return;
      }

      try {
        const response = await chrome.tabs.sendMessage(tab.id, { 
          type: 'TRIGGER_ANALYSIS',
          action: 'errors'
        });
        
        this.showNotification('Error detection started!');
        window.close();
      } catch (messageError) {
        console.log('Content script not loaded for error detection, injecting it manually...', messageError);
        
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['dist/content/content-bundled.js']
          });

          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['dist/content/content.css']
          });

          console.log('Scripts injected for error detection, waiting...');
          
          await new Promise(resolve => setTimeout(resolve, 2000));

          const response = await chrome.tabs.sendMessage(tab.id, { 
            type: 'TRIGGER_ANALYSIS',
            action: 'errors'
          });
          
          this.showNotification('Error detection started!');
          window.close();
        } catch (injectionError) {
          console.error('Script injection failed for error detection:', injectionError);
          this.showNotification('Failed to load extension on this page. Please refresh the page and try again.');
        }
      }
    } catch (error) {
      console.error('Error in findCodeErrors:', error);
      this.showNotification('Failed to detect errors. Please refresh the page and try again.');
    }
  }

  private showNotification(message: string): void {
    const notification = document.createElement('div');
    notification.className = 'popup-notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  private openSupport(): void {
    chrome.tabs.create({ 
      url: 'https://github.com/your-username/leetcode-analyzer/issues' // Replace with actual support URL
    });
  }

  private openFeedback(): void {
    chrome.tabs.create({ 
      url: 'https://forms.gle/your-feedback-form' // Replace with actual feedback URL
    });
  }

  private getActivityIcon(type: string): string {
    const icons = {
      analyze: '🔍',
      solution: '💡',
      complexity: '⏱️',
      optimize: '🚀',
      error: '❌',
      default: '📊'
    } as const;
    
    return (icons as any)[type] || icons.default;
  }

  private formatTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (diff < 86400000) { // Less than 1 day
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diff / 86400000);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private showErrorState(): void {
    const content = document.querySelector('.popup-content');
    if (content) {
      content.innerHTML = `
        <div class="error-state">
          <div class="error-icon">⚠️</div>
          <div class="error-message">Failed to load extension data</div>
          <button class="retry-btn" onclick="window.location.reload()">Retry</button>
        </div>
      `;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PopupManager());
} else {
  new PopupManager();
}
