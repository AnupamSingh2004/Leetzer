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
  private static readonly API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second
  private static readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  
  private static rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 100, // Rate limit for Gemini Flash (free tier)
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
You are an expert LeetCode problem solver and competitive programming mentor. Analyze the following ${codeInfo.language} code for the LeetCode problem "${problemInfo.title}" and provide a detailed LeetCode-specific analysis.

Problem: ${problemInfo.title}
Difficulty: ${problemInfo.difficulty}
Description: ${problemInfo.description}

Code to analyze:
\`\`\`${codeInfo.language}
${codeInfo.content}
\`\`\`

Please provide your analysis in the following JSON format, focusing specifically on LeetCode and DSA aspects:
{
  "errors": [
    {
      "type": "syntax|logic|runtime|performance|edge-case",
      "severity": "low|medium|high|critical",
      "message": "LeetCode-specific error description",
      "line": line_number_if_applicable,
      "suggestion": "How to fix this for LeetCode constraints"
    }
  ],
  "warnings": [
    {
      "type": "performance|edge-case|leetcode-specific|algorithm",
      "message": "LeetCode/DSA specific warning",
      "line": line_number_if_applicable,
      "suggestion": "Recommendation for LeetCode problems"
    }
  ],
  "suggestions": [
    "LeetCode-specific improvement suggestions focusing on algorithms, data structures, and competitive programming best practices"
  ],
  "confidence": confidence_score_0_to_1
}

Focus specifically on:
1. **Algorithm correctness** for this LeetCode problem
2. **Edge cases** common in competitive programming (empty arrays, single elements, duplicates, negative numbers, etc.)
3. **Time/Space complexity** issues that would cause TLE or MLE on LeetCode
4. **LeetCode-specific constraints** and requirements
5. **Data structure optimization** opportunities
6. **Competitive programming patterns** and techniques

Respond only with valid JSON.`;
  }

  /**
   * Builds prompt for solution generation
   */
  private static buildSolutionPrompt(problemInfo: ProblemInfo, language: CodeInfo['language']): string {
    return `
You are an expert LeetCode problem solver. Generate a complete, optimal solution for this LeetCode problem in ${language}.

Problem: ${problemInfo.title}
Difficulty: ${problemInfo.difficulty}
Description: ${problemInfo.description}

Requirements:
1. **IMPORTANT**: Provide the COMPLETE LeetCode solution with proper class structure and function signature
2. Include the standard LeetCode template (class Solution with public method)
3. Use optimal time and space complexity for LeetCode constraints
4. Handle all edge cases common in competitive programming
5. Follow LeetCode's exact expected format for submissions
6. **DO NOT** include comments or explanations in the code

Please provide your response in the following JSON format:
{
  "code": "complete_leetcode_solution_with_class_and_function_signature",
  "approach": "brief_description_of_algorithm_and_data_structures_used",
  "timeComplexity": "O(...)",
  "spaceComplexity": "O(...)",
  "keyInsights": "LeetCode-specific insights and competitive programming techniques used"
}

Example format for ${language}:
${this.getLanguageTemplate(language)}

Provide a complete, ready-to-submit LeetCode solution.

Respond only with valid JSON.`;
  }

  /**
   * Gets the standard LeetCode template for a language
   */
  private static getLanguageTemplate(language: CodeInfo['language']): string {
    switch (language) {
      case 'cpp':
        return `class Solution {
public:
    // Your method here
};`;
      case 'java':
        return `class Solution {
    public // your method here
}`;
      case 'python':
        return `class Solution:
    def methodName(self, params):
        # your code here`;
      case 'javascript':
      case 'typescript':
        return `var methodName = function(params) {
    // your code here
};`;
      default:
        return 'Provide complete function/class structure as expected by LeetCode';
    }
  }

  /**
   * Builds prompt for complexity analysis
   */
  private static buildComplexityPrompt(codeInfo: CodeInfo, problemInfo: ProblemInfo): string {
    return `
Analyze the time and space complexity of this ${codeInfo.language} code for the LeetCode problem "${problemInfo.title}". Focus on competitive programming and LeetCode-specific analysis.

Problem: ${problemInfo.title}
Difficulty: ${problemInfo.difficulty}
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
  "explanation": "Detailed explanation focusing on LeetCode constraints and competitive programming analysis",
  "leetcodePerformance": "How this performs on LeetCode (will it pass all test cases, cause TLE, etc.)",
  "comparisonWithOptimal": "How this compares to the optimal solution for this specific LeetCode problem",
  "scalabilityAnalysis": "How the solution scales with LeetCode's typical input constraints"
}

Focus on:
1. **LeetCode-specific performance** (will it pass within time limits?)
2. **Competitive programming complexity analysis**
3. **Input constraint analysis** (how it performs with LeetCode's typical ranges)
4. **Algorithm efficiency** for this specific problem type
5. **Memory usage** in the context of LeetCode's memory limits

Respond only with valid JSON.`;
  }

  /**
   * Builds prompt for optimization suggestions
   */
  private static buildOptimizationPrompt(codeInfo: CodeInfo, problemInfo: ProblemInfo): string {
    return `
Analyze this ${codeInfo.language} code for the LeetCode problem "${problemInfo.title}" and suggest LeetCode/DSA-specific optimizations.

Problem: ${problemInfo.title}
Difficulty: ${problemInfo.difficulty}
Current Code:
\`\`\`${codeInfo.language}
${codeInfo.content}
\`\`\`

Please provide optimization suggestions in the following JSON format, focusing on competitive programming and LeetCode-specific improvements:
{
  "suggestions": [
    {
      "type": "algorithm|data-structure|implementation|leetcode-pattern",
      "description": "LeetCode/DSA-specific optimization with competitive programming context",
      "impact": "low|medium|high",
      "before": "current_problematic_code_snippet",
      "after": "optimized_code_snippet_for_competitive_programming",
      "complexityImprovement": "specific_complexity_improvement",
      "leetcodeContext": "why_this_matters_for_leetcode_and_interviews"
    }
  ],
  "overallOptimizationStrategy": "high-level strategy for optimizing this LeetCode solution",
  "competitiveProgrammingInsights": "insights specific to competitive programming and algorithm optimization"
}

Focus specifically on:
1. **Algorithm optimization** (better algorithms, dynamic programming patterns, greedy approaches)
2. **Data structure improvements** (using more efficient data structures for LeetCode constraints)
3. **LeetCode patterns** (sliding window, two pointers, divide and conquer, etc.)
4. **Competitive programming techniques** (bit manipulation, mathematical optimizations)
5. **Time complexity improvements** (reducing from O(n²) to O(n log n), etc.)
6. **Space complexity optimizations** (in-place algorithms, constant space solutions)
7. **Edge case handling** improvements for LeetCode test cases

Provide practical, actionable suggestions that will help pass LeetCode test cases faster and more efficiently.

Respond only with valid JSON.`;
  }

  /**
   * Parses analysis response from Gemini
   */
  private static parseAnalysisResponse(responseText: string): AnalysisResult {
    try {
      // Try to extract JSON from response if it's wrapped in markdown or extra text
      let jsonStr = responseText.trim();
      
      // Look for JSON block in markdown
      const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonStr = jsonMatch[1];
      } else {
        // Look for standalone JSON object
        const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objectMatch && objectMatch[0]) {
          jsonStr = objectMatch[0];
        }
      }
      
      const parsed = JSON.parse(jsonStr);
      return {
        errors: parsed.errors || [],
        warnings: parsed.warnings || [],
        suggestions: parsed.suggestions || [],
        confidence: parsed.confidence || 0.5
      };
    } catch (error) {
      // Try to extract useful information from plain text
      const text = responseText.toLowerCase();
      const suggestions: string[] = [];
      
      // Look for common analysis patterns
      if (text.includes('error') || text.includes('issue')) {
        suggestions.push('Code may have errors that need attention');
      }
      if (text.includes('optimize') || text.includes('improve')) {
        suggestions.push('Code could be optimized for better performance');
      }
      if (text.includes('complexity')) {
        suggestions.push('Consider the time and space complexity of your solution');
      }
      
      // If no specific patterns found, add the raw response as a suggestion
      if (suggestions.length === 0) {
        suggestions.push(`Analysis: ${responseText.substring(0, 200)}...`);
      }
      
      return {
        errors: [],
        warnings: [],
        suggestions,
        confidence: 0.3
      };
    }
  }

  /**
   * Parses solution response from Gemini
   */
  private static parseSolutionResponse(responseText: string, language: CodeInfo['language']): SolutionResult {
    try {
      // Try to extract JSON from response if it's wrapped in markdown or extra text
      let jsonStr = responseText.trim();
      
      // Look for JSON block in markdown
      const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonStr = jsonMatch[1];
      } else {
        // Look for standalone JSON object
        const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objectMatch && objectMatch[0]) {
          jsonStr = objectMatch[0];
        }
      }
      
      const parsed = JSON.parse(jsonStr);
      return {
        code: parsed.code || '',
        language,
        approach: parsed.approach || 'Unknown approach',
        timeComplexity: parsed.timeComplexity || 'O(?)',
        spaceComplexity: parsed.spaceComplexity || 'O(?)',
        keyInsights: parsed.keyInsights
      };
    } catch (error) {
      // Try to extract code from markdown code blocks
      let code = responseText;
      
      // Look for code blocks with language specification
      const codeBlockMatch = responseText.match(new RegExp(`\`\`\`${language}\\s*([\\s\\S]*?)\`\`\``, 'i')) ||
                            responseText.match(/```\w*\s*([\s\S]*?)```/) ||
                            responseText.match(/`([^`]+)`/);
      
      if (codeBlockMatch && codeBlockMatch[1]) {
        code = codeBlockMatch[1].trim();
      }
      
      return {
        code: code.trim(),
        language,
        approach: 'Generated LeetCode solution (parsed from text)',
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
      // Try to extract JSON from response if it's wrapped in markdown or extra text
      let jsonStr = responseText.trim();
      
      // Look for JSON block in markdown
      const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonStr = jsonMatch[1];
      } else {
        // Look for standalone JSON object
        const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objectMatch && objectMatch[0]) {
          jsonStr = objectMatch[0];
        }
      }
      
      const parsed = JSON.parse(jsonStr);
      return {
        timeComplexity: parsed.timeComplexity || {
          best: 'O(?)',
          average: 'O(?)',
          worst: 'O(?)'
        },
        spaceComplexity: parsed.spaceComplexity || 'O(?)',
        explanation: parsed.explanation || 'No explanation provided',
        comparisonWithOptimal: parsed.comparisonWithOptimal,
        leetcodePerformance: parsed.leetcodePerformance,
        scalabilityAnalysis: parsed.scalabilityAnalysis
      };
    } catch (error) {
      // Try to extract complexity information from plain text
      const text = responseText.toLowerCase();
      let timeComplexity = 'O(?)';
      let spaceComplexity = 'O(?)';
      
      // Look for common complexity patterns
      const timeMatch = text.match(/time.*?complexity.*?o\([^)]+\)/i) || 
                       text.match(/o\([^)]+\).*?time/i) ||
                       text.match(/o\([^)]+\)/i);
      if (timeMatch) {
        timeComplexity = timeMatch[0].match(/o\([^)]+\)/i)?.[0] || 'O(?)';
      }
      
      const spaceMatch = text.match(/space.*?complexity.*?o\([^)]+\)/i) || 
                        text.match(/o\([^)]+\).*?space/i);
      if (spaceMatch) {
        spaceComplexity = spaceMatch[0].match(/o\([^)]+\)/i)?.[0] || 'O(?)';
      }
      
      return {
        timeComplexity: {
          best: timeComplexity,
          average: timeComplexity,
          worst: timeComplexity
        },
        spaceComplexity: spaceComplexity,
        explanation: `Extracted from response: ${responseText.substring(0, 200)}...`
      };
    }
  }

  /**
   * Parses optimization response from Gemini
   */
  private static parseOptimizationResponse(responseText: string): OptimizationSuggestion[] {
    try {
      // Try to extract JSON from response if it's wrapped in markdown or extra text
      let jsonStr = responseText.trim();
      
      // Look for JSON block in markdown
      const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonStr = jsonMatch[1];
      } else {
        // Look for standalone JSON object
        const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objectMatch && objectMatch[0]) {
          jsonStr = objectMatch[0];
        }
      }
      
      const parsed = JSON.parse(jsonStr);
      return parsed.suggestions || [];
    } catch (error) {
      // Try to extract optimization suggestions from plain text
      const text = responseText.toLowerCase();
      const suggestions: OptimizationSuggestion[] = [];
      
      // Look for common optimization patterns
      if (text.includes('algorithm') && text.includes('improve')) {
        suggestions.push({
          type: 'algorithm',
          description: 'Consider algorithm optimization based on the response',
          impact: 'medium',
          leetcodeContext: 'Algorithm improvements for competitive programming'
        });
      }
      
      if (text.includes('data structure') || text.includes('hash') || text.includes('tree')) {
        suggestions.push({
          type: 'data-structure',
          description: 'Consider using more efficient data structures',
          impact: 'high',
          leetcodeContext: 'Data structure optimization for LeetCode problems'
        });
      }
      
      if (text.includes('time complexity') || text.includes('o(n') || text.includes('optimize')) {
        suggestions.push({
          type: 'implementation',
          description: 'Time complexity can be improved',
          impact: 'high',
          leetcodeContext: 'Performance optimization for LeetCode constraints'
        });
      }
      
      // If no specific patterns found, provide general feedback
      if (suggestions.length === 0) {
        suggestions.push({
          type: 'implementation',
          description: `Optimization insight: ${responseText.substring(0, 150)}...`,
          impact: 'low',
          leetcodeContext: 'General optimization feedback'
        });
      }
      
      return suggestions;
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
