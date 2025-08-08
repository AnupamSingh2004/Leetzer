import { CodeInfo, SupportedLanguage } from '../types/index.js';
import { Helpers } from './helpers.js';

/**
 * Handles code extraction and parsing from LeetCode's editor
 */
export class CodeParser {
  private static readonly LANGUAGE_MAP: Record<string, SupportedLanguage> = {
    'javascript': 'javascript',
    'python': 'python',
    'python3': 'python',
    'cpp': 'cpp',
    'c++': 'cpp',
    'java': 'java',
    'csharp': 'csharp',
    'c#': 'csharp',
    'go': 'go',
    'golang': 'go',
    'rust': 'rust',
    'typescript': 'typescript',
    'ts': 'typescript'
  };

  private static readonly CODE_EDITOR_SELECTORS = [
    '.monaco-editor .view-lines',
    '.CodeMirror-code',
    'div[data-mode-id]',
    '.ace_content',
    '[role="textbox"][data-language]',
    '.cm-content'
  ];

  private static readonly LANGUAGE_SELECTORS = [
    '[data-mode-id]',
    '.ant-select-selection-item[title]',
    '.language-selector button',
    '[data-cy="lang-select"] button span',
    'button[id*="headlessui-listbox-button"] span'
  ];

  /**
   * Extracts code content from LeetCode's code editor
   */
  static extractCodeFromEditor(): string {
    try {
      // Try Monaco Editor first (most common)
      const monacoLines = document.querySelectorAll('.monaco-editor .view-line');
      if (monacoLines.length > 0) {
        return Array.from(monacoLines)
          .map(line => line.textContent || '')
          .join('\n')
          .trim();
      }

      // Try CodeMirror
      const codeMirrorLines = document.querySelectorAll('.CodeMirror-line');
      if (codeMirrorLines.length > 0) {
        return Array.from(codeMirrorLines)
          .map(line => line.textContent || '')
          .join('\n')
          .trim();
      }

      // Try newer CodeMirror 6
      const cm6Content = document.querySelector('.cm-content');
      if (cm6Content) {
        return cm6Content.textContent?.trim() || '';
      }

      // Try ACE Editor
      const aceLines = document.querySelectorAll('.ace_line');
      if (aceLines.length > 0) {
        return Array.from(aceLines)
          .map(line => line.textContent || '')
          .join('\n')
          .trim();
      }

      // Fallback: try to find any textarea or contenteditable
      const textareas = document.querySelectorAll('textarea');
      for (const textarea of Array.from(textareas)) {
        if (textarea.value && textarea.value.trim().length > 10) {
          return textarea.value.trim();
        }
      }

      const editables = document.querySelectorAll('[contenteditable="true"]');
      for (const editable of Array.from(editables)) {
        const content = editable.textContent?.trim();
        if (content && content.length > 10) {
          return content;
        }
      }

      return '';
    } catch (error) {
      console.error('Failed to extract code from editor:', error);
      return '';
    }
  }

  /**
   * Detects the programming language being used
   */
  static detectProgrammingLanguage(): SupportedLanguage {
    try {
      // Check data attributes
      for (const selector of this.LANGUAGE_SELECTORS) {
        const element = document.querySelector(selector);
        if (element) {
          const lang = element.getAttribute('data-mode-id') ||
                      element.getAttribute('title') ||
                      element.textContent?.trim().toLowerCase();
          
          if (lang && this.LANGUAGE_MAP[lang]) {
            return this.LANGUAGE_MAP[lang];
          }
        }
      }

      // Try to detect from URL
      const urlMatch = window.location.href.match(/lang=([^&]+)/);
      if (urlMatch && urlMatch[1]) {
        const urlLang = urlMatch[1].toLowerCase();
        if (this.LANGUAGE_MAP[urlLang]) {
          return this.LANGUAGE_MAP[urlLang];
        }
      }

      // Try to detect from code content
      const code = this.extractCodeFromEditor();
      if (code) {
        return this.detectLanguageFromCode(code);
      }

      return 'unknown';
    } catch (error) {
      console.error('Failed to detect programming language:', error);
      return 'unknown';
    }
  }

  /**
   * Attempts to detect language from code patterns
   */
  private static detectLanguageFromCode(code: string): SupportedLanguage {
    const patterns: Record<SupportedLanguage, RegExp[]> = {
      python: [
        /def\s+\w+\s*\(/,
        /import\s+\w+/,
        /from\s+\w+\s+import/,
        /if\s+__name__\s*==\s*['"']__main__['"']:/,
        /^\s*#.*$/m
      ],
      javascript: [
        /function\s+\w+\s*\(/,
        /const\s+\w+\s*=/,
        /let\s+\w+\s*=/,
        /var\s+\w+\s*=/,
        /=>\s*{/,
        /console\.log\(/
      ],
      typescript: [
        /:\s*(string|number|boolean|any)\s*[=;]/,
        /interface\s+\w+/,
        /type\s+\w+\s*=/,
        /function\s+\w+\s*\([^)]*:\s*\w+/
      ],
      java: [
        /public\s+class\s+\w+/,
        /public\s+static\s+void\s+main/,
        /System\.out\.print/,
        /import\s+java\./,
        /private\s+\w+\s+\w+\s*;/
      ],
      cpp: [
        /#include\s*<\w+>/,
        /std::/,
        /cout\s*<</, 
        /cin\s*>>/,
        /int\s+main\s*\(/,
        /using\s+namespace\s+std/
      ],
      csharp: [
        /using\s+System/,
        /public\s+class\s+\w+/,
        /Console\.Write/,
        /static\s+void\s+Main/,
        /string\[\]\s+args/
      ],
      go: [
        /package\s+main/,
        /import\s+\(/,
        /func\s+main\s*\(/,
        /fmt\.Print/,
        /var\s+\w+\s+\w+/
      ],
      rust: [
        /fn\s+main\s*\(/,
        /let\s+mut\s+\w+/,
        /println!\s*\(/,
        /use\s+std::/,
        /impl\s+\w+/
      ],
      unknown: []
    };

    let bestMatch: SupportedLanguage = 'unknown';
    let maxScore = 0;

    for (const [lang, regexes] of Object.entries(patterns)) {
      if (lang === 'unknown') continue;
      
      let score = 0;
      for (const regex of regexes) {
        if (regex.test(code)) {
          score++;
        }
      }
      
      if (score > maxScore) {
        maxScore = score;
        bestMatch = lang as SupportedLanguage;
      }
    }

    return bestMatch;
  }

  /**
   * Parses code structure and extracts metadata
   */
  static parseCodeStructure(code: string, language: SupportedLanguage): CodeInfo {
    const lines = code.split('\n');
    const lineCount = lines.length;
    
    // Basic syntax error detection
    const hasErrors = this.detectBasicSyntaxErrors(code, language);

    return {
      content: code,
      language,
      lineCount,
      hasErrors
    };
  }

  /**
   * Performs basic syntax error detection
   */
  private static detectBasicSyntaxErrors(code: string, language: SupportedLanguage): boolean {
    try {
      switch (language) {
        case 'javascript':
        case 'typescript':
          return this.detectJavaScriptErrors(code);
        case 'python':
          return this.detectPythonErrors(code);
        case 'java':
          return this.detectJavaErrors(code);
        case 'cpp':
          return this.detectCppErrors(code);
        default:
          return false;
      }
    } catch (error) {
      return true; // If we can't parse, assume there might be errors
    }
  }

  /**
   * Detects basic JavaScript/TypeScript syntax errors
   */
  private static detectJavaScriptErrors(code: string): boolean {
    // Check for unmatched brackets
    const brackets = { '(': 0, '[': 0, '{': 0 };
    const closingBrackets: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
    
    for (const char of code) {
      if (char in brackets) {
        brackets[char as keyof typeof brackets]++;
      } else if (char in closingBrackets) {
        const opening = closingBrackets[char];
        brackets[opening as keyof typeof brackets]--;
        if (brackets[opening as keyof typeof brackets] < 0) {
          return true; // Unmatched closing bracket
        }
      }
    }
    
    // Check if any brackets are unmatched
    return Object.values(brackets).some(count => count !== 0);
  }

  /**
   * Detects basic Python syntax errors
   */
  private static detectPythonErrors(code: string): boolean {
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      
      // Check for colons after control structures
      if (/^(if|elif|else|for|while|def|class|try|except|finally|with)\b/.test(line)) {
        if (!line.endsWith(':') && !line.includes('#')) {
          return true;
        }
      }
      
      // Check indentation consistency (basic check)
      if (line && !line.startsWith('#')) {
        const currentLine = lines[i];
        if (currentLine) {
          const indentationMatch = currentLine.match(/^\s*/);
          const indentation = indentationMatch ? indentationMatch[0].length : 0;
          if (indentation % 4 !== 0 && indentation % 2 !== 0) {
            // Inconsistent indentation
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Detects basic Java syntax errors
   */
  private static detectJavaErrors(code: string): boolean {
    // Check for basic Java syntax patterns
    if (!/class\s+\w+/.test(code)) {
      return true; // No class definition
    }
    
    // Check for unmatched brackets (same as JavaScript)
    return this.detectJavaScriptErrors(code);
  }

  /**
   * Detects basic C++ syntax errors
   */
  private static detectCppErrors(code: string): boolean {
    // Check for includes
    if (code.includes('cout') && !/#include\s*<iostream>/.test(code)) {
      return true;
    }
    
    // Check for unmatched brackets
    return this.detectJavaScriptErrors(code);
  }

  /**
   * Monitors code changes in the editor
   */
  static observeCodeChanges(callback: (code: string, language: SupportedLanguage) => void): MutationObserver {
    const debouncedCallback = Helpers.debounce((code: string, language: SupportedLanguage) => {
      if (code.trim().length > 0) {
        callback(code, language);
      }
    }, 1000);

    const observer = new MutationObserver(() => {
      const code = this.extractCodeFromEditor();
      const language = this.detectProgrammingLanguage();
      debouncedCallback(code, language);
    });

    // Observe changes in potential code editor containers
    for (const selector of this.CODE_EDITOR_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) {
        observer.observe(element, {
          childList: true,
          subtree: true,
          characterData: true
        });
        break; // Only observe the first found editor
      }
    }

    return observer;
  }

  /**
   * Gets the current code and metadata
   */
  static getCurrentCodeInfo(): CodeInfo | null {
    const code = this.extractCodeFromEditor();
    if (!code.trim()) {
      return null;
    }

    const language = this.detectProgrammingLanguage();
    return this.parseCodeStructure(code, language);
  }
}
