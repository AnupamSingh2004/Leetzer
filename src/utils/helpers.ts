import { 
  NotificationOptions, 
  Theme, 
  ProblemInfo, 
  Debounced, 
  TimeoutId 
} from '../types/index.js';

/**
 * Helper utility functions for the LeetCode Code Analyzer extension
 */
export class Helpers {
  private static notificationContainer: HTMLElement | null = null;

  /**
   * Creates a debounced function that delays invoking func until after wait milliseconds
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T, 
    wait: number
  ): Debounced<T> {
    let timeout: TimeoutId | null = null;
    
    const debounced = function executedFunction(...args: Parameters<T>) {
      const later = () => {
        timeout = null;
        func(...args);
      };
      
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(later, wait);
    } as Debounced<T>;

    debounced.cancel = () => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    debounced.flush = () => {
      if (timeout !== null) {
        clearTimeout(timeout);
        func();
        timeout = null;
      }
    };

    return debounced;
  }

  /**
   * Sanitizes HTML input to prevent XSS attacks
   */
  static sanitizeInput(input: string): string {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  /**
   * Shows a notification to the user
   */
  static showNotification(
    message: string, 
    type: NotificationOptions['type'] = 'info',
    duration: number = 3000
  ): void {
    if (!this.notificationContainer) {
      this.createNotificationContainer();
    }

    const notification = document.createElement('div');
    notification.className = `leetcode-analyzer-notification ${type}`;
    notification.textContent = message;
    
    const colors: Record<NotificationOptions['type'], string> = {
      error: '#ef4444',
      success: '#10b981',
      warning: '#f59e0b',
      info: '#3b82f6'
    };

    notification.style.cssText = `
      background: ${colors[type]};
      color: white;
      padding: 12px 16px;
      margin-bottom: 8px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 300px;
      transition: all 0.3s ease;
      transform: translateX(100%);
      opacity: 0;
    `;
    
    this.notificationContainer!.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
      notification.style.transform = 'translateX(0)';
      notification.style.opacity = '1';
    });
    
    // Animate out and remove
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, duration);
  }

  /**
   * Creates the notification container if it doesn't exist
   */
  private static createNotificationContainer(): void {
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      pointer-events: none;
    `;
    document.body.appendChild(this.notificationContainer);
  }

  /**
   * Detects the current theme of the LeetCode page
   */
  static detectTheme(): Theme {
    const isDark = document.documentElement.classList.contains('dark') ||
                   document.body.classList.contains('dark') ||
                   getComputedStyle(document.body).backgroundColor === 'rgb(17, 17, 17)' ||
                   getComputedStyle(document.body).backgroundColor === 'rgb(26, 26, 26)';
    return isDark ? 'dark' : 'light';
  }

  /**
   * Formats complexity notation for display
   */
  static formatComplexity(complexity: string): string {
    if (!complexity) return 'N/A';
    return complexity.replace(/O\(([^)]+)\)/, 'O($1)');
  }

  /**
   * Copies text to clipboard with fallback for older browsers
   */
  static async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.showNotification('Code copied to clipboard!', 'success');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        this.showNotification('Code copied to clipboard!', 'success');
      } catch (fallbackError) {
        this.showNotification('Failed to copy to clipboard', 'error');
      }
      
      document.body.removeChild(textArea);
    }
  }

  /**
   * Extracts problem information from the current LeetCode page
   */
  static extractProblemInfo(): ProblemInfo {
    const title = document.querySelector('[data-cy="question-title"]')?.textContent?.trim() ||
                  document.querySelector('h1')?.textContent?.trim() ||
                  'Unknown Problem';
    
    const difficultyElement = document.querySelector('[diff]') ||
                             document.querySelector('.text-difficulty-easy, .text-difficulty-medium, .text-difficulty-hard');
    
    let difficulty: ProblemInfo['difficulty'] = 'Unknown';
    if (difficultyElement) {
      const diffText = difficultyElement.getAttribute('diff') || difficultyElement.textContent?.trim().toLowerCase();
      switch (diffText) {
        case 'easy':
        case 'Easy':
          difficulty = 'Easy';
          break;
        case 'medium':
        case 'Medium':
          difficulty = 'Medium';
          break;
        case 'hard':
        case 'Hard':
          difficulty = 'Hard';
          break;
      }
    }
    
    const description = document.querySelector('[data-track-load="description_content"]')?.textContent?.trim() ||
                       document.querySelector('.content__u3I1')?.textContent?.trim() ||
                       '';

    // Extract tags if available
    const tagElements = document.querySelectorAll('[data-cy="topic-tag"]');
    const tags = Array.from(tagElements).map(el => el.textContent?.trim()).filter(Boolean) as string[];

    return { title, difficulty, description, tags };
  }

  /**
   * Waits for an element to appear in the DOM
   */
  static waitForElement(selector: string, timeout: number = 5000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkForElement = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          return;
        }
        
        if (Date.now() - startTime >= timeout) {
          reject(new Error(`Element ${selector} not found within ${timeout}ms`));
          return;
        }
        
        setTimeout(checkForElement, 100);
      };
      
      checkForElement();
    });
  }

  /**
   * Generates a unique ID for DOM elements
   */
  static generateUniqueId(): string {
    return 'lca_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Escapes HTML characters to prevent XSS
   */
  static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m] || m);
  }

  /**
   * Creates a loading spinner element
   */
  static createLoadingSpinner(): HTMLElement {
    const spinner = document.createElement('div');
    spinner.className = 'leetcode-analyzer-spinner';
    spinner.innerHTML = `
      <div class="spinner-ring"></div>
    `;
    
    spinner.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
    `;

    const style = document.createElement('style');
    style.textContent = `
      .leetcode-analyzer-spinner .spinner-ring {
        width: 16px;
        height: 16px;
        border: 2px solid transparent;
        border-top-color: currentColor;
        border-radius: 50%;
        animation: lca-spin 1s linear infinite;
      }
      
      @keyframes lca-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `;
    
    if (!document.head.querySelector('style[data-lca-spinner]')) {
      style.setAttribute('data-lca-spinner', 'true');
      document.head.appendChild(style);
    }

    return spinner;
  }

  /**
   * Throttles function execution to at most once per interval
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T, 
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean = false;
    
    return function(this: any, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  }

  /**
   * Deep clones an object
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as T;
    }
    
    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item)) as T;
    }
    
    if (obj instanceof Object) {
      const clonedObj = {} as T;
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
    
    return obj;
  }
}
