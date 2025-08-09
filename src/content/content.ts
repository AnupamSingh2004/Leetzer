/// <reference types="../types/chrome"/>

import { 
  DropdownState, 
  ProblemInfo, 
  CodeInfo, 
  AnalysisResult, 
  SolutionResult, 
  ComplexityAnalysis, 
  OptimizationSuggestion,
  ExtensionSettings,
  CodeChangeEvent
} from '../types/index.js';
import { Helpers } from '../utils/helpers.js';
import { CodeParser } from '../utils/codeParser.js';
import { GeminiClient } from '../utils/geminiClient.js';

/**
 * Content script for LeetCode pages - handles UI injection and code analysis
 */
class LeetCodeAnalyzer {
  private dropdown: HTMLElement | null = null;
  private isInjected: boolean = false;
  private codeObserver: MutationObserver | null = null;
  private currentState: DropdownState = {
    isVisible: false,
    activeTab: 'analyze',
    isLoading: false
  };
  private apiKey: string | null = null;
  private settings: ExtensionSettings | null = null;

  constructor() {
    this.init();
  }

  /**
   * Initializes the content script
   */
  private async init(): Promise<void> {
    try {
      // Wait for page to load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setupAnalyzer());
      } else {
        await this.setupAnalyzer();
      }
    } catch (error) {
      console.error('Failed to initialize LeetCode Analyzer:', error);
    }
  }

  /**
   * Sets up the analyzer on the page
   */
  private async setupAnalyzer(): Promise<void> {
    try {
      // Check if we're on a problem page
      if (!this.isLeetCodeProblemPage()) {
        return;
      }

      // Load settings and API key
      await this.loadSettings();
      await this.loadApiKey();

      // Wait for the code editor to be available
      await this.waitForCodeEditor();

      // Inject the UI
      await this.injectUI();

      // Setup code monitoring
      this.setupCodeMonitoring();

      // Show setup reminder if no API key
      if (!this.apiKey) {
        this.showApiSetupReminder();
      }

    } catch (error) {
      console.error('Failed to setup analyzer:', error);
    }
  }

  /**
   * Checks if we're on a LeetCode problem page
   */
  private isLeetCodeProblemPage(): boolean {
    return window.location.href.includes('leetcode.com/problems/') &&
           !window.location.href.includes('/solution');
  }

  /**
   * Loads settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response.success) {
        this.settings = response.data;
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Loads API key from storage
   */
  private async loadApiKey(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
      if (response.success) {
        this.apiKey = response.data;
      }
    } catch (error) {
      console.error('Failed to load API key:', error);
    }
  }

  /**
   * Waits for the code editor to be available
   */
  private async waitForCodeEditor(): Promise<void> {
    try {
      await Helpers.waitForElement('.monaco-editor, .CodeMirror, .ace_editor', 10000);
    } catch (error) {
      console.warn('Code editor not found, continuing anyway');
    }
  }

  /**
   * Injects the analyzer UI into the page
   */
  private async injectUI(): Promise<void> {
    if (this.isInjected) return;

    try {
      // Create and inject the dropdown
      this.dropdown = this.createDropdown();
      this.positionDropdown();
      document.body.appendChild(this.dropdown);

      // Mark as injected
      this.isInjected = true;

      // Apply theme
      this.applyTheme();

    } catch (error) {
      console.error('Failed to inject UI:', error);
    }
  }

  /**
   * Creates the main dropdown element
   */
  private createDropdown(): HTMLElement {
    const dropdown = document.createElement('div');
    dropdown.id = 'leetcode-analyzer-dropdown';
    dropdown.className = 'leetcode-analyzer-dropdown';
    
    dropdown.innerHTML = `
      <div class="lca-header">
        <div class="lca-title">
          <span class="lca-icon">🧠</span>
          <span>LeetCode Code Analyzer</span>
        </div>
        <div class="lca-status">
          <span class="lca-api-status ${this.apiKey ? 'connected' : 'disconnected'}">
            ${this.apiKey ? '✅ Connected' : '❌ No API Key'}
          </span>
          <button class="lca-settings-btn" title="Settings">⚙️</button>
          <button class="lca-close-btn" title="Close">✕</button>
        </div>
      </div>
      
      <div class="lca-problem-info">
        <div class="lca-problem-title">Loading problem...</div>
        <div class="lca-problem-difficulty">Unknown</div>
      </div>
      
      <div class="lca-tabs">
        <button class="lca-tab active" data-tab="analyze">🔍 Analyze</button>
        <button class="lca-tab" data-tab="solution">💡 Solution</button>
        <button class="lca-tab" data-tab="complexity">⏱️ Complexity</button>
        <button class="lca-tab" data-tab="optimize">🚀 Optimize</button>
      </div>
      
      <div class="lca-content">
        <div class="lca-tab-content active" data-content="analyze">
          <button class="lca-action-btn lca-analyze-btn">
            <span class="lca-btn-text">Analyze Code</span>
            <span class="lca-btn-loader" style="display: none;">${Helpers.createLoadingSpinner().outerHTML}</span>
          </button>
          <div class="lca-results" id="lca-analyze-results"></div>
        </div>
        
        <div class="lca-tab-content" data-content="solution">
          <button class="lca-action-btn lca-solution-btn">
            <span class="lca-btn-text">Generate Solution</span>
            <span class="lca-btn-loader" style="display: none;">${Helpers.createLoadingSpinner().outerHTML}</span>
          </button>
          <div class="lca-results" id="lca-solution-results"></div>
        </div>
        
        <div class="lca-tab-content" data-content="complexity">
          <button class="lca-action-btn lca-complexity-btn">
            <span class="lca-btn-text">Analyze Complexity</span>
            <span class="lca-btn-loader" style="display: none;">${Helpers.createLoadingSpinner().outerHTML}</span>
          </button>
          <div class="lca-results" id="lca-complexity-results"></div>
        </div>
        
        <div class="lca-tab-content" data-content="optimize">
          <button class="lca-action-btn lca-optimize-btn">
            <span class="lca-btn-text">Optimize Code</span>
            <span class="lca-btn-loader" style="display: none;">${Helpers.createLoadingSpinner().outerHTML}</span>
          </button>
          <div class="lca-results" id="lca-optimize-results"></div>
        </div>
      </div>
    `;

    // Add event listeners
    this.setupDropdownEvents(dropdown);

    return dropdown;
  }

  /**
   * Sets up event listeners for the dropdown
   */
  private setupDropdownEvents(dropdown: HTMLElement): void {
    // Tab switching
    const tabs = dropdown.querySelectorAll('.lca-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.getAttribute('data-tab') as DropdownState['activeTab'];
        this.switchTab(tabName);
      });
    });

    // Action buttons
    dropdown.querySelector('.lca-analyze-btn')?.addEventListener('click', () => this.handleAnalyze());
    dropdown.querySelector('.lca-solution-btn')?.addEventListener('click', () => this.handleGenerateSolution());
    dropdown.querySelector('.lca-complexity-btn')?.addEventListener('click', () => this.handleAnalyzeComplexity());
    dropdown.querySelector('.lca-optimize-btn')?.addEventListener('click', () => this.handleOptimize());

    // Control buttons
    dropdown.querySelector('.lca-settings-btn')?.addEventListener('click', () => this.showSettings());
    dropdown.querySelector('.lca-close-btn')?.addEventListener('click', () => this.toggleDropdown());
  }

  /**
   * Positions the dropdown on the page
   */
  private positionDropdown(): void {
    if (!this.dropdown) return;

    // Try to position near the code editor
    const codeEditor = document.querySelector('.monaco-editor, .CodeMirror, .ace_editor');
    
    if (codeEditor) {
      const rect = codeEditor.getBoundingClientRect();
      this.dropdown.style.position = 'fixed';
      this.dropdown.style.top = `${rect.top + 10}px`;
      this.dropdown.style.right = '20px';
      this.dropdown.style.zIndex = '10000';
    } else {
      // Fallback positioning
      this.dropdown.style.position = 'fixed';
      this.dropdown.style.top = '20px';
      this.dropdown.style.right = '20px';
      this.dropdown.style.zIndex = '10000';
    }
  }

  /**
   * Applies theme styling
   */
  private applyTheme(): void {
    if (!this.dropdown) return;

    const theme = this.settings?.theme === 'auto' ? Helpers.detectTheme() : this.settings?.theme || 'light';
    this.dropdown.setAttribute('data-theme', theme);
  }

  /**
   * Sets up code monitoring
   */
  private setupCodeMonitoring(): void {
    if (this.settings?.autoAnalyze) {
      this.codeObserver = CodeParser.observeCodeChanges(
        Helpers.debounce((code: string, language) => {
          this.handleCodeChange({ content: code, language, timestamp: Date.now() });
        }, this.settings.analysisDelay || 2000)
      );
    }
  }

  /**
   * Handles code changes
   */
  private async handleCodeChange(event: CodeChangeEvent): Promise<void> {
    // Update problem info display
    this.updateProblemInfo();
  }

  /**
   * Updates the problem information display
   */
  private updateProblemInfo(): void {
    if (!this.dropdown) return;

    const problemInfo = Helpers.extractProblemInfo();
    
    const titleElement = this.dropdown.querySelector('.lca-problem-title');
    const difficultyElement = this.dropdown.querySelector('.lca-problem-difficulty');

    if (titleElement) {
      titleElement.textContent = problemInfo.title;
    }

    if (difficultyElement) {
      difficultyElement.textContent = problemInfo.difficulty;
      difficultyElement.className = `lca-problem-difficulty lca-difficulty-${problemInfo.difficulty.toLowerCase()}`;
    }
  }

  /**
   * Switches between tabs
   */
  private switchTab(tabName: DropdownState['activeTab']): void {
    if (!this.dropdown) return;

    this.currentState.activeTab = tabName;

    // Update tab buttons
    const tabs = this.dropdown.querySelectorAll('.lca-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
    });

    // Update tab content
    const contents = this.dropdown.querySelectorAll('.lca-tab-content');
    contents.forEach(content => {
      content.classList.toggle('active', content.getAttribute('data-content') === tabName);
    });
  }

  /**
   * Toggles dropdown visibility
   */
  private toggleDropdown(): void {
    if (!this.dropdown) return;

    this.currentState.isVisible = !this.currentState.isVisible;
    this.dropdown.style.display = this.currentState.isVisible ? 'block' : 'none';
  }

  /**
   * Shows API setup reminder
   */
  private showApiSetupReminder(): void {
    const notification = Helpers.showNotification(
      'Please set up your Gemini API key to use the analyzer features.',
      'warning',
      5000
    );
  }

  /**
   * Shows settings dialog
   */
  private showSettings(): void {
    // For now, just open the setup page
    chrome.runtime.sendMessage({ type: 'OPEN_SETUP' });
  }

  /**
   * Handles code analysis
   */
  private async handleAnalyze(): Promise<void> {
    if (!this.apiKey) {
      Helpers.showNotification('Please set up your API key first', 'error');
      return;
    }

    const codeInfo = CodeParser.getCurrentCodeInfo();
    if (!codeInfo) {
      Helpers.showNotification('No code found to analyze', 'warning');
      return;
    }

    const problemInfo = Helpers.extractProblemInfo();

    try {
      this.setLoading('analyze', true);
      
      const result = await GeminiClient.analyzeCode(this.apiKey, codeInfo, problemInfo);
      this.currentState.lastAnalysis = result;
      this.displayAnalysisResults(result);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      Helpers.showNotification(errorMessage, 'error');
      this.displayError('analyze', errorMessage);
    } finally {
      this.setLoading('analyze', false);
    }
  }

  /**
   * Handles solution generation
   */
  private async handleGenerateSolution(): Promise<void> {
    if (!this.apiKey) {
      Helpers.showNotification('Please set up your API key first', 'error');
      return;
    }

    const language = CodeParser.detectProgrammingLanguage();
    const problemInfo = Helpers.extractProblemInfo();

    try {
      this.setLoading('solution', true);
      
      const result = await GeminiClient.generateSolution(this.apiKey, problemInfo, language);
      this.currentState.lastSolution = result;
      this.displaySolutionResults(result);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Solution generation failed';
      Helpers.showNotification(errorMessage, 'error');
      this.displayError('solution', errorMessage);
    } finally {
      this.setLoading('solution', false);
    }
  }

  /**
   * Handles complexity analysis
   */
  private async handleAnalyzeComplexity(): Promise<void> {
    if (!this.apiKey) {
      Helpers.showNotification('Please set up your API key first', 'error');
      return;
    }

    const codeInfo = CodeParser.getCurrentCodeInfo();
    if (!codeInfo) {
      Helpers.showNotification('No code found to analyze', 'warning');
      return;
    }

    const problemInfo = Helpers.extractProblemInfo();

    try {
      this.setLoading('complexity', true);
      
      const result = await GeminiClient.analyzeComplexity(this.apiKey, codeInfo, problemInfo);
      this.currentState.lastComplexity = result;
      this.displayComplexityResults(result);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Complexity analysis failed';
      Helpers.showNotification(errorMessage, 'error');
      this.displayError('complexity', errorMessage);
    } finally {
      this.setLoading('complexity', false);
    }
  }

  /**
   * Handles code optimization
   */
  private async handleOptimize(): Promise<void> {
    if (!this.apiKey) {
      Helpers.showNotification('Please set up your API key first', 'error');
      return;
    }

    const codeInfo = CodeParser.getCurrentCodeInfo();
    if (!codeInfo) {
      Helpers.showNotification('No code found to optimize', 'warning');
      return;
    }

    const problemInfo = Helpers.extractProblemInfo();

    try {
      this.setLoading('optimize', true);
      
      const result = await GeminiClient.optimizeCode(this.apiKey, codeInfo, problemInfo);
      this.currentState.lastOptimization = result;
      this.displayOptimizationResults(result);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Optimization failed';
      Helpers.showNotification(errorMessage, 'error');
      this.displayError('optimize', errorMessage);
    } finally {
      this.setLoading('optimize', false);
    }
  }

  /**
   * Sets loading state for a specific tab
   */
  private setLoading(tab: DropdownState['activeTab'], isLoading: boolean): void {
    if (!this.dropdown) return;

    const button = this.dropdown.querySelector(`.lca-${tab}-btn`);
    if (button) {
      const text = button.querySelector('.lca-btn-text') as HTMLElement;
      const loader = button.querySelector('.lca-btn-loader') as HTMLElement;
      
      if (text && loader) {
        text.style.display = isLoading ? 'none' : 'inline';
        loader.style.display = isLoading ? 'inline' : 'none';
      }
      
      (button as HTMLButtonElement).disabled = isLoading;
    }
  }

  /**
   * Displays analysis results
   */
  private displayAnalysisResults(result: AnalysisResult): void {
    const container = this.dropdown?.querySelector('#lca-analyze-results');
    if (!container) return;

    let html = '<div class="lca-analysis-results">';
    
    // Errors
    if (result.errors.length > 0) {
      html += '<div class="lca-section"><h4>Errors Found:</h4>';
      result.errors.forEach(error => {
        html += `
          <div class="lca-error lca-severity-${error.severity}">
            <div class="lca-error-header">
              <span class="lca-error-type">${error.type}</span>
              <span class="lca-error-severity">${error.severity}</span>
            </div>
            <div class="lca-error-message">${Helpers.escapeHtml(error.message)}</div>
            ${error.suggestion ? `<div class="lca-error-suggestion">${Helpers.escapeHtml(error.suggestion)}</div>` : ''}
          </div>
        `;
      });
      html += '</div>';
    }

    // Warnings
    if (result.warnings.length > 0) {
      html += '<div class="lca-section"><h4>Warnings:</h4>';
      result.warnings.forEach(warning => {
        html += `
          <div class="lca-warning">
            <div class="lca-warning-message">${Helpers.escapeHtml(warning.message)}</div>
            ${warning.suggestion ? `<div class="lca-warning-suggestion">${Helpers.escapeHtml(warning.suggestion)}</div>` : ''}
          </div>
        `;
      });
      html += '</div>';
    }

    // Suggestions
    if (result.suggestions.length > 0) {
      html += '<div class="lca-section"><h4>Suggestions:</h4><ul>';
      result.suggestions.forEach(suggestion => {
        html += `<li>${Helpers.escapeHtml(suggestion)}</li>`;
      });
      html += '</ul></div>';
    }

    if (result.errors.length === 0 && result.warnings.length === 0) {
      html += '<div class="lca-success">✅ No issues found! Your code looks good.</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * Displays solution results
   */
  private displaySolutionResults(result: SolutionResult): void {
    const container = this.dropdown?.querySelector('#lca-solution-results');
    if (!container) return;

    const html = `
      <div class="lca-solution-results">
        <div class="lca-solution-header">
          <span class="lca-solution-approach">${Helpers.escapeHtml(result.approach)}</span>
          <button class="lca-copy-btn" onclick="copyCode()">📋 Copy</button>
        </div>
        <div class="lca-complexity-info">
          <span>Time: ${result.timeComplexity}</span>
          <span>Space: ${result.spaceComplexity}</span>
        </div>
        <pre class="lca-code-block"><code>${Helpers.escapeHtml(result.code)}</code></pre>
      </div>
    `;

    container.innerHTML = html;

    // Add copy functionality
    (window as any).copyCode = () => {
      Helpers.copyToClipboard(result.code);
    };
  }

  /**
   * Displays complexity results
   */
  private displayComplexityResults(result: ComplexityAnalysis): void {
    const container = this.dropdown?.querySelector('#lca-complexity-results');
    if (!container) return;

    const html = `
      <div class="lca-complexity-results">
        <div class="lca-complexity-grid">
          <div class="lca-complexity-item">
            <label>Best Case:</label>
            <span>${result.timeComplexity.best}</span>
          </div>
          <div class="lca-complexity-item">
            <label>Average Case:</label>
            <span>${result.timeComplexity.average}</span>
          </div>
          <div class="lca-complexity-item">
            <label>Worst Case:</label>
            <span>${result.timeComplexity.worst}</span>
          </div>
          <div class="lca-complexity-item">
            <label>Space:</label>
            <span>${result.spaceComplexity}</span>
          </div>
        </div>
        <div class="lca-explanation">
          <h4>Explanation:</h4>
          <p>${Helpers.escapeHtml(result.explanation)}</p>
        </div>
        ${result.comparisonWithOptimal ? `
          <div class="lca-comparison">
            <h4>Comparison with Optimal:</h4>
            <p>${Helpers.escapeHtml(result.comparisonWithOptimal)}</p>
          </div>
        ` : ''}
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Displays optimization results
   */
  private displayOptimizationResults(suggestions: OptimizationSuggestion[]): void {
    const container = this.dropdown?.querySelector('#lca-optimize-results');
    if (!container) return;

    if (suggestions.length === 0) {
      container.innerHTML = '<div class="lca-success">✅ Your code is already well optimized!</div>';
      return;
    }

    let html = '<div class="lca-optimization-results">';
    
    suggestions.forEach((suggestion, index) => {
      html += `
        <div class="lca-optimization-item lca-impact-${suggestion.impact}">
          <div class="lca-optimization-header">
            <span class="lca-optimization-type">${suggestion.type}</span>
            <span class="lca-optimization-impact">${suggestion.impact} impact</span>
          </div>
          <div class="lca-optimization-description">
            ${Helpers.escapeHtml(suggestion.description)}
          </div>
          ${suggestion.before && suggestion.after ? `
            <div class="lca-code-comparison">
              <div class="lca-before">
                <h5>Before:</h5>
                <pre><code>${Helpers.escapeHtml(suggestion.before)}</code></pre>
              </div>
              <div class="lca-after">
                <h5>After:</h5>
                <pre><code>${Helpers.escapeHtml(suggestion.after)}</code></pre>
              </div>
            </div>
          ` : ''}
          ${suggestion.complexityImprovement ? `
            <div class="lca-complexity-improvement">
              <strong>Improvement:</strong> ${Helpers.escapeHtml(suggestion.complexityImprovement)}
            </div>
          ` : ''}
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * Displays error message
   */
  private displayError(tab: DropdownState['activeTab'], error: string): void {
    const container = this.dropdown?.querySelector(`#lca-${tab}-results`);
    if (!container) return;

    container.innerHTML = `
      <div class="lca-error-display">
        <div class="lca-error-icon">❌</div>
        <div class="lca-error-text">${Helpers.escapeHtml(error)}</div>
        <button class="lca-retry-btn" onclick="window.location.reload()">Retry</button>
      </div>
    `;
  }
}

// Initialize the analyzer when the content script loads
const analyzer = new LeetCodeAnalyzer();

// Add message listener for popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.type === 'PING') {
    sendResponse({ loaded: true });
    return true;
  }
  
  if (message.type === 'TRIGGER_ANALYSIS') {
    console.log('Triggering analysis from popup...');
    
    // Trigger the analyze action
    if (message.action === 'analyze') {
      // Find the analyze button and click it programmatically
      const analyzeBtn = document.querySelector('.lca-tab-btn[data-tab="analyze"]') as HTMLElement;
      if (analyzeBtn) {
        analyzeBtn.click();
        setTimeout(() => {
          const analyzeActionBtn = document.querySelector('.lca-action-btn[data-action="analyze"]') as HTMLElement;
          if (analyzeActionBtn) {
            analyzeActionBtn.click();
            sendResponse({ success: true, message: 'Analysis triggered' });
          } else {
            sendResponse({ success: false, message: 'Analyze button not found' });
          }
        }, 100);
      } else {
        sendResponse({ success: false, message: 'Analyzer UI not loaded' });
      }
    } else if (message.action === 'complexity') {
      // Find the complexity button and click it
      const complexityBtn = document.querySelector('.lca-tab-btn[data-tab="complexity"]') as HTMLElement;
      if (complexityBtn) {
        complexityBtn.click();
        setTimeout(() => {
          const complexityActionBtn = document.querySelector('.lca-action-btn[data-action="analyze-complexity"]') as HTMLElement;
          if (complexityActionBtn) {
            complexityActionBtn.click();
            sendResponse({ success: true, message: 'Complexity analysis triggered' });
          } else {
            sendResponse({ success: false, message: 'Complexity button not found' });
          }
        }, 100);
      } else {
        sendResponse({ success: false, message: 'Analyzer UI not loaded' });
      }
    }
    
    return true; // Keep the message channel open for async response
  }
  
  return false;
});
