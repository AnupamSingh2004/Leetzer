import { CodeInfo, SupportedLanguage, ProblemInfo } from '../types/index.js';
import { Helpers } from './helpers.js';

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

  static extractCodeFromEditor(): string {
    try {
      console.log('Starting code extraction...');

      const monacoEditor = document.querySelector('.monaco-editor');
      if (monacoEditor) {
        console.log('Found Monaco editor');
        
        const monacoSelectors = [
          '.view-lines .view-line',
          '.monaco-editor .view-lines .view-line',
          '.view-line span',
          '.monaco-editor .view-line'
        ];
        
        for (const selector of monacoSelectors) {
          const lines = document.querySelectorAll(selector);
          if (lines.length > 0) {
            const code = Array.from(lines)
              .map(line => line.textContent || '')
              .join('\n')
              .trim();
            if (code && code.length > 10) {
              console.log(`Code extracted from Monaco (${selector}):`, code.substring(0, 100) + '...');
              return code;
            }
          }
        }
      }

      const codeEditors = [
        '.CodeMirror-code .CodeMirror-line',
        '.cm-content .cm-line', 
        '.cm-editor .cm-line',
        'div[data-track-load="code_editor"] .monaco-editor .view-line',
        'div[class*="monaco"] .view-line',
        '.monaco-mouse-cursor-text .view-line',
        // Additional fallbacks
        '.ace_content .ace_line',
        'textarea[data-schemapath]',
        '[data-mode-id] .view-line'
      ];

      for (const selector of codeEditors) {
        console.log(`Trying selector: ${selector}`);
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          let code = '';
          
          if (selector.includes('CodeMirror-line')) {
            code = Array.from(elements).map(line => line.textContent || '').join('\n');
          } else if (selector.includes('cm-line')) {
            code = Array.from(elements).map(line => line.textContent || '').join('\n');
          } else if (selector.includes('view-line')) {
            code = Array.from(elements).map(line => line.textContent || '').join('\n');
          } else {
            const container = elements[0];
            code = container?.textContent || '';
          }
          
          if (code && code.trim().length > 10) {
            console.log(`Code extracted from ${selector}:`, code.substring(0, 100) + '...');
            return code.trim();
          }
        }
      }

      // Method 3: Look for textarea with code
      const textareas = document.querySelectorAll('textarea');
      for (const textarea of Array.from(textareas)) {
        if (textarea.value && textarea.value.trim().length > 10) {
          console.log('Code extracted from textarea:', textarea.value.substring(0, 100) + '...');
          return textarea.value.trim();
        }
      }

      // Method 4: Try to find any pre/code elements with substantial content
      const codeBlocks = document.querySelectorAll('pre, code');
      for (const block of Array.from(codeBlocks)) {
        const content = block.textContent || '';
        if (content.trim().length > 50 && 
            (content.includes('class') || content.includes('function') || content.includes('def') || content.includes('#include'))) {
          console.log('Code extracted from code block:', content.substring(0, 100) + '...');
          return content.trim();
        }
      }

      console.warn('Could not extract code from editor - no suitable elements found');
      
      // Debug: Log available elements
      console.log('Available Monaco editors:', document.querySelectorAll('.monaco-editor').length);
      console.log('Available view-lines:', document.querySelectorAll('.view-line').length);
      console.log('Available textareas:', document.querySelectorAll('textarea').length);
      
      return '';
    } catch (error) {
      console.error('Error extracting code from editor:', error);
      return '';
    }
  }  static detectProgrammingLanguage(): SupportedLanguage {
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

  private static detectJavaErrors(code: string): boolean {
    // Check for basic Java syntax patterns
    if (!/class\s+\w+/.test(code)) {
      return true; // No class definition
    }
    
    // Check for unmatched brackets (same as JavaScript)
    return this.detectJavaScriptErrors(code);
  }

  private static detectCppErrors(code: string): boolean {
    // Check for includes
    if (code.includes('cout') && !/#include\s*<iostream>/.test(code)) {
      return true;
    }
    
    // Check for unmatched brackets
    return this.detectJavaScriptErrors(code);
  }

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

  static extractProblemInfo(): ProblemInfo {
    try {
      // Extract problem title
      const title = this.extractProblemTitle();
      
      // Extract difficulty
      const difficulty = this.extractProblemDifficulty();
      
      // Extract description
      const description = this.extractProblemDescription();
      
      // Extract tags
      const tags = this.extractProblemTags();
      
      // Extract constraints
      const constraints = this.extractProblemConstraints();
      
      return {
        title,
        difficulty,
        description,
        tags,
        constraints
      };
    } catch (error) {
      console.error('Failed to extract problem info:', error);
      return {
        title: 'Unknown Problem',
        difficulty: 'Unknown',
        description: 'Could not extract problem description from the page.'
      };
    }
  }

  private static extractProblemTitle(): string {
    const titleSelectors = [
      // Modern LeetCode selectors (2024/2025)
      'h1[data-cy="question-title"]',
      'div[data-track-load="description_content"] h1',
      'div[data-track-load="description_content"] h1 a',
      '.text-title-large',
      '.text-lg.font-medium',
      '.mr-2.text-lg.font-medium.text-label-1',
      '.question-title h1',
      '.question-content h1',
      'div.question-title',
      '[data-cy="question-title"]',
      'h1.text-title-large',
      // Fallback selectors
      'h1',
      '.css-v3d350',
      '.question-title'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        let title = element.textContent.trim();
        // Remove problem numbers if present (e.g., "1. Two Sum" -> "Two Sum")
        title = title.replace(/^\d+\.\s*/, '');
        if (title.length > 3 && !title.toLowerCase().includes('leetcode')) {
          console.log(`Found title using selector "${selector}": ${title}`);
          return title;
        }
      }
    }

    // Fallback: try to extract from page title or URL
    const pageTitle = document.title;
    if (pageTitle && !pageTitle.toLowerCase().includes('leetcode')) {
      const cleanTitle = pageTitle.replace(/\s*-\s*LeetCode.*$/i, '').replace(/^\d+\.\s*/, '').trim();
      if (cleanTitle.length > 3) {
        console.log(`Found title from page title: ${cleanTitle}`);
        return cleanTitle;
      }
    }

    // Last resort: extract from URL
    const urlPath = window.location.pathname;
    const urlMatch = urlPath.match(/\/problems\/([^\/]+)/);
    if (urlMatch && urlMatch[1]) {
      const urlTitle = urlMatch[1]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      if (urlTitle.length > 3) {
        console.log(`Found title from URL: ${urlTitle}`);
        return urlTitle;
      }
    }

    console.warn('Could not extract problem title');
    return 'Unknown Problem';
  }

  private static extractProblemDifficulty(): 'Easy' | 'Medium' | 'Hard' | 'Unknown' {
    const difficultySelectors = [
      // Modern LeetCode selectors
      'div[diff]',
      '[data-degree]',
      '.text-difficulty-easy',
      '.text-difficulty-medium', 
      '.text-difficulty-hard',
      '.text-olive', // Easy
      '.text-yellow', // Medium  
      '.text-pink', // Hard
      'span[class*="text-green"]', // Easy
      'span[class*="text-yellow"]', // Medium
      'span[class*="text-red"]', // Hard
      'span[class*="difficulty"]',
      '.question-info .difficulty',
      // Generic selectors
      'span:has-text("Easy")',
      'span:has-text("Medium")',
      'span:has-text("Hard")'
    ];

    for (const selector of difficultySelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.toLowerCase().trim();
        if (text?.includes('easy')) {
          console.log(`Found difficulty "Easy" using selector: ${selector}`);
          return 'Easy';
        }
        if (text?.includes('medium')) {
          console.log(`Found difficulty "Medium" using selector: ${selector}`);
          return 'Medium';
        }
        if (text?.includes('hard')) {
          console.log(`Found difficulty "Hard" using selector: ${selector}`);
          return 'Hard';
        }
        
        // Check for data attributes
        const diffAttr = element.getAttribute('diff') || element.getAttribute('data-degree');
        if (diffAttr) {
          const diffValue = diffAttr.toLowerCase();
          if (diffValue.includes('easy')) return 'Easy';
          if (diffValue.includes('medium')) return 'Medium';
          if (diffValue.includes('hard')) return 'Hard';
        }
      }
    }

    // Try to find difficulty by searching all text content
    const allSpans = document.querySelectorAll('span, div');
    for (const element of Array.from(allSpans)) {
      const text = element.textContent?.toLowerCase().trim();
      if (text === 'easy') {
        console.log('Found difficulty "Easy" by text search');
        return 'Easy';
      }
      if (text === 'medium') {
        console.log('Found difficulty "Medium" by text search');
        return 'Medium';
      }
      if (text === 'hard') {
        console.log('Found difficulty "Hard" by text search');
        return 'Hard';
      }
    }

    // Try to find difficulty by color classes (LeetCode uses specific colors)
    const colorElements = document.querySelectorAll('[class*="text-"], [class*="difficulty-"], [class*="color-"]');
    for (const element of Array.from(colorElements)) {
      const className = element.className.toLowerCase();
      if (className.includes('green') || className.includes('olive')) {
        console.log('Found difficulty "Easy" by color class');
        return 'Easy';
      }
      if (className.includes('yellow') || className.includes('orange')) {
        console.log('Found difficulty "Medium" by color class');
        return 'Medium';
      }
      if (className.includes('red') || className.includes('pink')) {
        console.log('Found difficulty "Hard" by color class');
        return 'Hard';
      }
    }

    console.warn('Could not extract problem difficulty');
    return 'Unknown';
  }

  private static extractProblemDescription(): string {
    const descriptionSelectors = [
      // Modern LeetCode selectors
      'div[data-track-load="description_content"]',
      'div[data-track-load="description_content"] > div',
      'div[data-track-load="description_content"] p',
      '.xFUwe', // Common LeetCode description class
      '.elfjS', // Another description class
      '.content__u3I1 .question-content',
      '.question-description',
      '.content .question-content',
      '[data-cy="question-detail-main-tabs"] div[role="tabpanel"]',
      '.description__24sA',
      '.question-detail-main-tabs div',
      // Generic fallbacks
      '.question-content',
      '.description'
    ];

    for (const selector of descriptionSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Get text content but preserve some structure
        let description = element.textContent?.trim();
        if (description && description.length > 50) {
          // Clean up common artifacts
          description = description
            .replace(/\s+/g, ' ')
            .replace(/Example \d+:/g, '\n\nExample:')
            .replace(/Input:/g, '\nInput:')
            .replace(/Output:/g, '\nOutput:')
            .replace(/Explanation:/g, '\nExplanation:')
            .replace(/Constraints?:/g, '\n\nConstraints:')
            .replace(/Follow up:/g, '\n\nFollow up:')
            .trim();
          
          // Limit length to avoid too much content
          if (description.length > 1500) {
            description = description.substring(0, 1500) + '...';
          }
          
          console.log(`Found description using selector "${selector}": ${description.substring(0, 100)}...`);
          return description;
        }
      }
    }

    // Try to find the first substantial paragraph
    const paragraphs = document.querySelectorAll('p');
    for (const p of Array.from(paragraphs)) {
      const text = p.textContent?.trim();
      if (text && text.length > 100 && !text.includes('LeetCode') && !text.includes('Example')) {
        console.log('Found description from paragraph');
        return text.length > 1000 ? text.substring(0, 1000) + '...' : text;
      }
    }

    console.warn('Could not extract problem description');
    return 'Problem description not available on this page.';
  }

  private static extractProblemTags(): string[] {
    const tagSelectors = [
      '.topic-tag',
      '[data-cy="topic-tags"] a',
      '.tag',
      '.question-detail-main-tabs .tag',
      '.topic-tags a'
    ];

    const tags: string[] = [];
    
    for (const selector of tagSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of Array.from(elements)) {
        const tagText = element.textContent?.trim();
        if (tagText && tagText.length > 1 && !tags.includes(tagText)) {
          tags.push(tagText);
        }
      }
    }

    return tags.slice(0, 10); // Limit to first 10 tags
  }

  private static extractProblemConstraints(): string {
    // Look for constraints section in the description
    const descriptionElement = document.querySelector('div[data-track-load="description_content"]') || 
                             document.querySelector('.question-content');
    
    if (descriptionElement) {
      const text = descriptionElement.textContent || '';
      
      // Find constraints section
      const constraintsMatch = text.match(/Constraints?:\s*([^]*?)(?:Follow up|Example|Note|$)/i);
      if (constraintsMatch && constraintsMatch[1]) {
        return constraintsMatch[1].trim()
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n/g, '\n')
          .substring(0, 500); // Limit length
      }
    }

    return 'No constraints information available.';
  }

  static getCurrentCodeInfo(): CodeInfo | null {
    const code = this.extractCodeFromEditor();
    if (!code.trim()) {
      return null;
    }

    const language = this.detectProgrammingLanguage();
    return this.parseCodeStructure(code, language);
  }
}
