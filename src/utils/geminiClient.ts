import { 
  GeminiRequest, 
  GeminiResponse, 
  GeminiApiResponse, 
  AnalysisResult, 
  SolutionResult, 
  ComplexityAnalysis, 
  OptimizationSuggestion,
  ProblemInfo,
  CodeInfo,
  RateLimitInfo
} from '../types/index.js';

/**
 * Handles communication with Google Gemini API
 */
export class GeminiClient {
  private static readonly API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second
  private static readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  
  private static rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 0,
    currentRequests: 0,
    resetTime: Date.now() + 60000
  };

  /**
   * Validates if the API key is properly formatted
   */
  static isValidApiKeyFormat(apiKey: string): boolean {
    // Gemini API keys typically start with 'AIza' and are 39 characters long
    return typeof apiKey === 'string' && 
           apiKey.startsWith('AIza') && 
           apiKey.length === 39;
  }

  /**
   * Tests API key validity by making a simple request
   */
  static async testApiKey(apiKey: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      if (!this.isValidApiKeyFormat(apiKey)) {
        return { isValid: false, error: 'Invalid API key format' };
      }

      const response = await this.makeRequest(apiKey, {
        prompt: 'Test connection. Reply with "OK".',
        context: {
          problemInfo: { title: 'Test', difficulty: 'Easy', description: 'Test' },
          codeInfo: { content: 'test', language: 'javascript', lineCount: 1, hasErrors: false }
        },
        type: 'analyze'
      });

      return { 
        isValid: response.success, 
        ...(response.error && { error: response.error })
      };
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Analyzes code for errors and issues
   */
  static async analyzeCode(
    apiKey: string, 
    codeInfo: CodeInfo, 
    problemInfo: ProblemInfo
  ): Promise<AnalysisResult> {
    const prompt = this.buildAnalysisPrompt(codeInfo, problemInfo);
    
    const response = await this.makeRequest(apiKey, {
      prompt,
      context: { problemInfo, codeInfo },
      type: 'analyze'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to analyze code');
    }

    return this.parseAnalysisResponse(response.data);
  }

  /**
   * Generates solution for the problem
   */
  static async generateSolution(
    apiKey: string, 
    problemInfo: ProblemInfo, 
    language: CodeInfo['language']
  ): Promise<SolutionResult> {
    const prompt = this.buildSolutionPrompt(problemInfo, language);
    
    const response = await this.makeRequest(apiKey, {
      prompt,
      context: { 
        problemInfo, 
        codeInfo: { content: '', language, lineCount: 0, hasErrors: false } 
      },
      type: 'solution'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to generate solution');
    }

    return this.parseSolutionResponse(response.data, language);
  }

  /**
   * Analyzes time and space complexity
   */
  static async analyzeComplexity(
    apiKey: string, 
    codeInfo: CodeInfo, 
    problemInfo: ProblemInfo
  ): Promise<ComplexityAnalysis> {
    const prompt = this.buildComplexityPrompt(codeInfo, problemInfo);
    
    const response = await this.makeRequest(apiKey, {
      prompt,
      context: { problemInfo, codeInfo },
      type: 'complexity'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to analyze complexity');
    }

    return this.parseComplexityResponse(response.data);
  }

  /**
   * Provides optimization suggestions
   */
  static async optimizeCode(
    apiKey: string, 
    codeInfo: CodeInfo, 
    problemInfo: ProblemInfo
  ): Promise<OptimizationSuggestion[]> {
    const prompt = this.buildOptimizationPrompt(codeInfo, problemInfo);
    
    const response = await this.makeRequest(apiKey, {
      prompt,
      context: { problemInfo, codeInfo },
      type: 'optimize'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to optimize code');
    }

    return this.parseOptimizationResponse(response.data);
  }

  /**
   * Makes HTTP request to Gemini API with retry logic
   */
  private static async makeRequest(apiKey: string, request: GeminiRequest): Promise<GeminiResponse> {
    // Check rate limiting
    if (!this.checkRateLimit()) {
      return {
        success: false,
        error: 'Rate limit exceeded. Please wait before making another request.'
      };
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

        const response = await fetch(`${this.API_BASE_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: request.prompt
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096,
              topP: 1,
              topK: 32
            },
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              }
            ]
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
        }

        const data: GeminiApiResponse = await response.json();
        
        if (data.error) {
          throw new Error(`API error: ${data.error.message}`);
        }

        if (!data.candidates || data.candidates.length === 0) {
          throw new Error('No response generated');
        }

        const text = data.candidates[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error('Empty response from API');
        }

        this.updateRateLimit();

        return {
          success: true,
          data: text
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAY * attempt);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Request failed after retries'
    };
  }

  /**
   * Builds prompt for code analysis
   */
  private static buildAnalysisPrompt(codeInfo: CodeInfo, problemInfo: ProblemInfo): string {
    return `
You are an expert code reviewer. Analyze the following ${codeInfo.language} code for a LeetCode problem and provide a detailed analysis.

Problem: ${problemInfo.title}
Difficulty: ${problemInfo.difficulty}
Description: ${problemInfo.description}

Code to analyze:
\`\`\`${codeInfo.language}
${codeInfo.content}
\`\`\`

Please provide your analysis in the following JSON format:
{
  "errors": [
    {
      "type": "syntax|logic|runtime|performance",
      "severity": "low|medium|high|critical",
      "message": "Description of the error",
      "line": line_number_if_applicable,
      "suggestion": "How to fix this error"
    }
  ],
  "warnings": [
    {
      "type": "style|performance|best-practice",
      "message": "Description of the warning",
      "line": line_number_if_applicable,
      "suggestion": "Recommendation"
    }
  ],
  "suggestions": [
    "General improvement suggestions"
  ],
  "confidence": confidence_score_0_to_1
}

Focus on:
1. Syntax errors and potential runtime errors
2. Logic errors that might cause wrong results
3. Edge cases that aren't handled
4. Performance issues
5. Code style and best practices

Respond only with valid JSON.`;
  }

  /**
   * Builds prompt for solution generation
   */
  private static buildSolutionPrompt(problemInfo: ProblemInfo, language: CodeInfo['language']): string {
    return `
Generate a clean, optimal solution for this LeetCode problem in ${language}.

Problem: ${problemInfo.title}
Difficulty: ${problemInfo.difficulty}
Description: ${problemInfo.description}

Requirements:
1. Provide working, executable code
2. Use optimal time and space complexity
3. Handle edge cases
4. Follow language best practices
5. NO comments or explanations in the code
6. Return only the main solution function/method

Please provide your response in the following JSON format:
{
  "code": "clean_code_without_comments",
  "approach": "brief_description_of_algorithm",
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)"
}

Respond only with valid JSON.`;
  }

  /**
   * Builds prompt for complexity analysis
   */
  private static buildComplexityPrompt(codeInfo: CodeInfo, problemInfo: ProblemInfo): string {
    return `
Analyze the time and space complexity of this ${codeInfo.language} code for the LeetCode problem.

Problem: ${problemInfo.title}
Code:
\`\`\`${codeInfo.language}
${codeInfo.content}
\`\`\`

Please provide detailed complexity analysis in the following JSON format:
{
  "timeComplexity": {
    "best": "O(...)",
    "average": "O(...)",
    "worst": "O(...)"
  },
  "spaceComplexity": "O(...)",
  "explanation": "Detailed explanation of how you arrived at these complexities",
  "comparisonWithOptimal": "How this compares to the optimal solution"
}

Respond only with valid JSON.`;
  }

  /**
   * Builds prompt for optimization suggestions
   */
  private static buildOptimizationPrompt(codeInfo: CodeInfo, problemInfo: ProblemInfo): string {
    return `
Analyze this ${codeInfo.language} code and suggest optimizations for the LeetCode problem.

Problem: ${problemInfo.title}
Current Code:
\`\`\`${codeInfo.language}
${codeInfo.content}
\`\`\`

Please provide optimization suggestions in the following JSON format:
{
  "suggestions": [
    {
      "type": "algorithm|data-structure|implementation",
      "description": "What to optimize and why",
      "impact": "low|medium|high",
      "before": "current_problematic_code_snippet",
      "after": "optimized_code_snippet",
      "complexityImprovement": "improvement_description"
    }
  ]
}

Focus on:
1. Algorithm improvements
2. Better data structure choices
3. Code efficiency improvements
4. Memory usage optimizations

Respond only with valid JSON.`;
  }

  /**
   * Parses analysis response from Gemini
   */
  private static parseAnalysisResponse(responseText: string): AnalysisResult {
    try {
      const parsed = JSON.parse(responseText);
      return {
        errors: parsed.errors || [],
        warnings: parsed.warnings || [],
        suggestions: parsed.suggestions || [],
        confidence: parsed.confidence || 0.5
      };
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        errors: [],
        warnings: [],
        suggestions: ['Failed to parse analysis response'],
        confidence: 0
      };
    }
  }

  /**
   * Parses solution response from Gemini
   */
  private static parseSolutionResponse(responseText: string, language: CodeInfo['language']): SolutionResult {
    try {
      const parsed = JSON.parse(responseText);
      return {
        code: parsed.code || '',
        language,
        approach: parsed.approach || 'Unknown approach',
        timeComplexity: parsed.timeComplexity || 'O(?)',
        spaceComplexity: parsed.spaceComplexity || 'O(?)'
      };
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        code: responseText, // Use raw response as code
        language,
        approach: 'Generated solution',
        timeComplexity: 'O(?)',
        spaceComplexity: 'O(?)'
      };
    }
  }

  /**
   * Parses complexity response from Gemini
   */
  private static parseComplexityResponse(responseText: string): ComplexityAnalysis {
    try {
      const parsed = JSON.parse(responseText);
      return {
        timeComplexity: parsed.timeComplexity || {
          best: 'O(?)',
          average: 'O(?)',
          worst: 'O(?)'
        },
        spaceComplexity: parsed.spaceComplexity || 'O(?)',
        explanation: parsed.explanation || 'No explanation provided',
        comparisonWithOptimal: parsed.comparisonWithOptimal
      };
    } catch (error) {
      return {
        timeComplexity: {
          best: 'O(?)',
          average: 'O(?)',
          worst: 'O(?)'
        },
        spaceComplexity: 'O(?)',
        explanation: 'Failed to parse complexity analysis'
      };
    }
  }

  /**
   * Parses optimization response from Gemini
   */
  private static parseOptimizationResponse(responseText: string): OptimizationSuggestion[] {
    try {
      const parsed = JSON.parse(responseText);
      return parsed.suggestions || [];
    } catch (error) {
      return [{
        type: 'implementation',
        description: 'Failed to parse optimization suggestions',
        impact: 'low'
      }];
    }
  }

  /**
   * Checks if we're within rate limits
   */
  private static checkRateLimit(): boolean {
    const now = Date.now();
    
    if (now > this.rateLimitInfo.resetTime) {
      // Reset the counter
      this.rateLimitInfo.currentRequests = 0;
      this.rateLimitInfo.resetTime = now + 60000; // Next minute
    }
    
    return this.rateLimitInfo.currentRequests < this.rateLimitInfo.requestsPerMinute;
  }

  /**
   * Updates rate limit counter
   */
  private static updateRateLimit(): void {
    this.rateLimitInfo.currentRequests++;
  }

  /**
   * Utility function to delay execution
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
