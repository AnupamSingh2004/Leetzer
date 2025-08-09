// Global type definitions for the LeetCode Code Analyzer extension

export interface ChromeMessage {
  type: string;
  action?: string;
  data?: any;
  problemInfo?: ProblemInfo;
  codeInfo?: CodeInfo;
}

export interface ChromeMessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ProblemInfo {
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Unknown';
  description: string;
  tags?: string[];
  constraints?: string;
}

export interface CodeInfo {
  content: string;
  language: SupportedLanguage;
  lineCount: number;
  hasErrors: boolean;
}

export type SupportedLanguage = 
  | 'javascript' 
  | 'python' 
  | 'cpp' 
  | 'java' 
  | 'csharp' 
  | 'go' 
  | 'rust'
  | 'typescript'
  | 'unknown';

export interface AnalysisResult {
  errors: ErrorAnalysis[];
  warnings: Warning[];
  suggestions: string[];
  confidence: number;
  summary?: string;
}

export interface ErrorAnalysis {
  type: 'syntax' | 'logic' | 'runtime' | 'performance' | 'edge-case';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
  code_snippet?: string;
}

export interface Warning {
  type: 'style' | 'performance' | 'best-practice';
  message: string;
  line?: number;
  suggestion?: string;
}

export interface SolutionResult {
  code: string;
  language: SupportedLanguage;
  approach: string;
  timeComplexity: string;
  spaceComplexity: string;
  explanation?: string;
  keyInsights?: string;
}

export interface ComplexityAnalysis {
  timeComplexity: {
    best: string;
    average: string;
    worst: string;
  };
  spaceComplexity: string;
  explanation: string;
  comparisonWithOptimal?: string;
  leetcodePerformance?: string;
  scalabilityAnalysis?: string;
}

export interface OptimizationSuggestion {
  type: 'algorithm' | 'data-structure' | 'implementation' | 'leetcode-pattern';
  description: string;
  impact: 'low' | 'medium' | 'high';
  before?: string;
  after?: string;
  complexityImprovement?: string;
  leetcodeContext?: string;
}

export interface GeminiRequest {
  prompt: string;
  context: {
    problemInfo: ProblemInfo;
    codeInfo: CodeInfo;
  };
  type: 'analyze' | 'solution' | 'complexity' | 'optimize' | 'error_detection';
}

export interface GeminiResponse {
  success: boolean;
  data?: any;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ApiKeyStatus {
  isValid: boolean;
  lastChecked: number;
  error?: string;
}

export interface ExtensionSettings {
  apiKey?: string;
  theme: 'light' | 'dark' | 'auto';
  autoAnalyze: boolean;
  showNotifications: boolean;
  analysisDelay: number;
}

export interface StorageData {
  apiKey?: string;
  settings: ExtensionSettings;
  apiKeyStatus?: ApiKeyStatus;
  lastProblemAnalyzed?: string;
}

// UI Component types
export interface DropdownState {
  isVisible: boolean;
  activeTab: 'analyze' | 'solution' | 'complexity' | 'optimize';
  isLoading: boolean;
  lastAnalysis?: AnalysisResult;
  lastSolution?: SolutionResult;
  lastComplexity?: ComplexityAnalysis;
  lastOptimization?: OptimizationSuggestion[];
}

export interface NotificationOptions {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

// Event types
export interface CodeChangeEvent {
  content: string;
  language: SupportedLanguage;
  timestamp: number;
}

export interface AnalysisRequestEvent {
  type: 'analyze' | 'solution' | 'complexity' | 'optimize';
  code: string;
  language: SupportedLanguage;
  problemInfo: ProblemInfo;
}

// Utility types
export type Debounced<T extends (...args: any[]) => any> = T & {
  cancel(): void;
  flush(): void;
};

export type Theme = 'light' | 'dark';

export type ElementSelector = string;

export type TimeoutId = ReturnType<typeof setTimeout>;

export type IntervalId = ReturnType<typeof setInterval>;

// API Response types
export interface GeminiApiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
  error?: {
    code: number;
    message: string;
  };
}

export interface RateLimitInfo {
  requestsPerMinute: number;
  currentRequests: number;
  resetTime: number;
}

// Content script injection types
export interface InjectedElements {
  dropdown?: HTMLElement;
  overlay?: HTMLElement;
  settingsButton?: HTMLElement;
}

export interface ElementObserver {
  observer: MutationObserver;
  target: Element;
  isActive: boolean;
}
