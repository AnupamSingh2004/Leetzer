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

  /**
   * Sets up DOM element references
   */
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

  /**
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    // Quick action buttons
    document.getElementById('open-current-page')?.addEventListener('click', () => {
      this.openCurrentPage();
    });

    document.getElementById('open-settings')?.addEventListener('click', () => {
      this.openSettings();
    });

    document.getElementById('view-help')?.addEventListener('click', () => {
      this.openHelp();
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

  /**
   * Loads and displays all data
   */
  private async loadAndDisplayData(): Promise<void> {
    await Promise.all([
      this.checkApiStatus(),
      this.loadRecentActivity(),
      this.loadStatistics()
    ]);
  }

  /**
   * Checks API status
   */
  private async checkApiStatus(): Promise<void> {
    try {
      this.updateApiStatus('checking', 'Checking...');

      const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
      
      if (response.success && response.data) {
        // API key exists, check if it's valid
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

  /**
   * Updates API status display
   */
  private updateApiStatus(status: 'checking' | 'connected' | 'disconnected', text: string): void {
    if (this.apiStatusIndicator) {
      this.apiStatusIndicator.className = `status-dot ${status}`;
    }
    
    if (this.apiStatusText) {
      this.apiStatusText.textContent = text;
    }
  }

  /**
   * Loads recent activity
   */
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
            .slice(0, 3) // Show only last 3 activities
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

  /**
   * Loads statistics
   */
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

  /**
   * Updates a statistic display
   */
  private updateStatistic(key: string, value: number): void {
    const element = this.statisticsElements[key];
    if (element) {
      element.textContent = value.toString();
    }
  }

  /**
   * Opens the current LeetCode page with analyzer
   */
  private async openCurrentPage(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab?.url?.includes('leetcode.com/problems/')) {
        // Already on a LeetCode problem page, just close popup
        window.close();
      } else {
        // Navigate to LeetCode
        chrome.tabs.create({ url: 'https://leetcode.com/problemset/all/' });
        window.close();
      }
    } catch (error) {
      console.error('Failed to open current page:', error);
    }
  }

  /**
   * Opens the settings page
   */
  private openSettings(): void {
    chrome.tabs.create({ 
      url: chrome.runtime.getURL('dist/setup/apiSetup.html') 
    });
    window.close();
  }

  /**
   * Opens the help documentation
   */
  private openHelp(): void {
    chrome.tabs.create({ 
      url: 'https://github.com/your-username/leetcode-analyzer/wiki' // Replace with actual help URL
    });
    window.close();
  }

  /**
   * Opens privacy policy
   */
  private openPrivacyPolicy(): void {
    chrome.tabs.create({ 
      url: 'https://github.com/your-username/leetcode-analyzer/blob/main/PRIVACY.md' // Replace with actual privacy URL
    });
  }

  /**
   * Opens support page
   */
  private openSupport(): void {
    chrome.tabs.create({ 
      url: 'https://github.com/your-username/leetcode-analyzer/issues' // Replace with actual support URL
    });
  }

  /**
   * Opens feedback form
   */
  private openFeedback(): void {
    chrome.tabs.create({ 
      url: 'https://forms.gle/your-feedback-form' // Replace with actual feedback URL
    });
  }

  /**
   * Gets activity icon based on type
   */
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

  /**
   * Formats timestamp for display
   */
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

  /**
   * Escapes HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Shows error state
   */
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

// Initialize popup when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PopupManager());
} else {
  new PopupManager();
}
