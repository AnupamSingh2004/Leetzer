/* Helper utility functions */
class Helpers {
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  static showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `leetcode-analyzer-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 300px;
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

  static detectTheme() {
    const isDark = document.documentElement.classList.contains('dark') ||
                   document.body.classList.contains('dark') ||
                   getComputedStyle(document.body).backgroundColor === 'rgb(17, 17, 17)' ||
                   getComputedStyle(document.body).backgroundColor === 'rgb(26, 26, 26)';
    return isDark ? 'dark' : 'light';
  }

  static formatComplexity(complexity) {
    if (!complexity) return 'N/A';
    return complexity.replace(/O\(([^)]+)\)/, 'O($1)');
  }

  static copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      this.showNotification('Code copied to clipboard!', 'success');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showNotification('Code copied to clipboard!', 'success');
    });
  }

  static extractProblemInfo() {
    const title = document.querySelector('[data-cy="question-title"]')?.textContent?.trim() ||
                  document.querySelector('h1')?.textContent?.trim() ||
                  'Unknown Problem';
    
    const difficulty = document.querySelector('[diff]')?.getAttribute('diff') ||
                      document.querySelector('.text-difficulty-easy, .text-difficulty-medium, .text-difficulty-hard')?.textContent?.trim() ||
                      'Unknown';
    
    const description = document.querySelector('[data-track-load="description_content"]')?.textContent?.trim() ||
                       document.querySelector('.content__u3I1')?.textContent?.trim() ||
                       '';

    return { title, difficulty, description };
  }

  static waitForElement(selector, timeout = 5000) {
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

  static generateUniqueId() {
    return 'lca_' + Math.random().toString(36).substr(2, 9);
  }

  static escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
