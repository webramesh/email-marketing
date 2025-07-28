/**
 * AI Integration Service
 * Provides AI-powered features for content generation and optimization
 */

import OpenAI from 'openai';

export interface AIProvider {
  name: string;
  apiKey: string;
  baseURL?: string;
  model: string;
}

export interface ContentGenerationRequest {
  type: 'subject_line' | 'email_content' | 'preheader' | 'campaign_name' | 'product_description';
  context: {
    audience?: string;
    tone?: 'professional' | 'casual' | 'friendly' | 'urgent' | 'promotional';
    industry?: string;
    productName?: string;
    campaignGoal?: string;
    keywords?: string[];
    existingContent?: string;
    brandVoice?: string;
  };
  options?: {
    variations?: number;
    maxLength?: number;
    includeEmojis?: boolean;
    language?: string;
  };
}

export interface ContentGenerationResponse {
  success: boolean;
  content: string[];
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
    processingTime: number;
  };
  error?: string;
}

export interface ContentOptimizationRequest {
  content: string;
  type: 'subject_line' | 'email_content' | 'preheader';
  goals: ('engagement' | 'deliverability' | 'conversion' | 'readability')[];
  context?: {
    audience?: string;
    industry?: string;
    previousPerformance?: {
      openRate?: number;
      clickRate?: number;
      conversionRate?: number;
    };
  };
}

export interface ContentOptimizationResponse {
  success: boolean;
  optimizedContent: string;
  suggestions: Array<{
    type: 'improvement' | 'warning' | 'tip';
    message: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  scores: {
    engagement: number;
    deliverability: number;
    readability: number;
  };
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
    processingTime: number;
  };
  error?: string;
}

export interface SubjectLineAnalysis {
  score: number;
  length: number;
  wordCount: number;
  characterCount: number;
  hasEmojis: boolean;
  hasNumbers: boolean;
  hasSpecialChars: boolean;
  spamScore: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  suggestions: string[];
  predictions: {
    openRate: number;
    deliverabilityScore: number;
  };
}

export class AIIntegrationService {
  private providers: Map<string, OpenAI> = new Map();

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize AI providers
   */
  private initializeProviders(): void {
    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.providers.set(
        'openai',
        new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        })
      );
    }

    // DeepSeek
    if (process.env.DEEPSEEK_API_KEY) {
      this.providers.set(
        'deepseek',
        new OpenAI({
          apiKey: process.env.DEEPSEEK_API_KEY,
          baseURL: 'https://api.deepseek.com/v1',
        })
      );
    }

    // OpenRouter
    if (process.env.OPENROUTER_API_KEY) {
      this.providers.set(
        'openrouter',
        new OpenAI({
          apiKey: process.env.OPENROUTER_API_KEY,
          baseURL: 'https://openrouter.ai/api/v1',
        })
      );
    }
  }

  /**
   * Generate content using AI
   */
  async generateContent(
    request: ContentGenerationRequest,
    provider: string = 'openai'
  ): Promise<ContentGenerationResponse> {
    const startTime = Date.now();

    try {
      const client = this.providers.get(provider);
      if (!client) {
        throw new Error(`AI provider '${provider}' not configured`);
      }

      const prompt = this.buildPrompt(request);
      const model = this.getModelForProvider(provider);

      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(request.type),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: request.options?.maxLength || 1000,
        temperature: 0.7,
        n: request.options?.variations || 1,
      });

      const content = response.choices
        .map(choice => choice.message?.content?.trim() || '')
        .filter(Boolean);

      return {
        success: true,
        content,
        metadata: {
          provider,
          model,
          tokensUsed: response.usage?.total_tokens || 0,
          processingTime: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      console.error('AI content generation error:', error);
      return {
        success: false,
        content: [],
        metadata: {
          provider,
          model: this.getModelForProvider(provider),
          tokensUsed: 0,
          processingTime: Date.now() - startTime,
        },
        error: error.message,
      };
    }
  }

  /**
   * Optimize existing content
   */
  async optimizeContent(
    request: ContentOptimizationRequest,
    provider: string = 'openai'
  ): Promise<ContentOptimizationResponse> {
    const startTime = Date.now();

    try {
      const client = this.providers.get(provider);
      if (!client) {
        throw new Error(`AI provider '${provider}' not configured`);
      }

      const prompt = this.buildOptimizationPrompt(request);
      const model = this.getModelForProvider(provider);

      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert email marketing copywriter and optimization specialist. Analyze and improve the given content based on the specified goals.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 1500,
        temperature: 0.5,
      });

      const result = this.parseOptimizationResponse(response.choices[0]?.message?.content || '');

      return {
        success: true,
        optimizedContent: result.optimizedContent,
        suggestions: result.suggestions,
        scores: result.scores,
        metadata: {
          provider,
          model,
          tokensUsed: response.usage?.total_tokens || 0,
          processingTime: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      console.error('AI content optimization error:', error);
      return {
        success: false,
        optimizedContent: request.content,
        suggestions: [],
        scores: { engagement: 0, deliverability: 0, readability: 0 },
        metadata: {
          provider,
          model: this.getModelForProvider(provider),
          tokensUsed: 0,
          processingTime: Date.now() - startTime,
        },
        error: error.message,
      };
    }
  }

  /**
   * Analyze subject line
   */
  async analyzeSubjectLine(subjectLine: string): Promise<SubjectLineAnalysis> {
    const analysis: SubjectLineAnalysis = {
      score: 0,
      length: subjectLine.length,
      wordCount: subjectLine.split(/\s+/).length,
      characterCount: subjectLine.length,
      hasEmojis:
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(
          subjectLine
        ),
      hasNumbers: /\d/.test(subjectLine),
      hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(subjectLine),
      spamScore: 0,
      sentiment: 'neutral',
      suggestions: [],
      predictions: {
        openRate: 0,
        deliverabilityScore: 0,
      },
    };

    // Calculate basic scores
    analysis.score = this.calculateSubjectLineScore(analysis);
    analysis.spamScore = this.calculateSpamScore(subjectLine);
    analysis.sentiment = this.analyzeSentiment(subjectLine);
    analysis.suggestions = this.generateSubjectLineSuggestions(analysis, subjectLine);
    analysis.predictions = this.predictPerformance(analysis);

    return analysis;
  }

  /**
   * Get available AI providers
   */
  getAvailableProviders(): Array<{ name: string; models: string[] }> {
    const providers = [];

    if (this.providers.has('openai')) {
      providers.push({
        name: 'openai',
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      });
    }

    if (this.providers.has('deepseek')) {
      providers.push({
        name: 'deepseek',
        models: ['deepseek-chat', 'deepseek-coder'],
      });
    }

    if (this.providers.has('openrouter')) {
      providers.push({
        name: 'openrouter',
        models: ['anthropic/claude-3-opus', 'meta-llama/llama-2-70b-chat'],
      });
    }

    return providers;
  }

  /**
   * Build prompt for content generation
   */
  private buildPrompt(request: ContentGenerationRequest): string {
    const { type, context, options } = request;

    let prompt = `Generate ${request.options?.variations || 1} ${type.replace(
      '_',
      ' '
    )} variation(s) for an email marketing campaign.\n\n`;

    if (context.audience) prompt += `Target Audience: ${context.audience}\n`;
    if (context.tone) prompt += `Tone: ${context.tone}\n`;
    if (context.industry) prompt += `Industry: ${context.industry}\n`;
    if (context.productName) prompt += `Product/Service: ${context.productName}\n`;
    if (context.campaignGoal) prompt += `Campaign Goal: ${context.campaignGoal}\n`;
    if (context.keywords?.length) prompt += `Keywords to include: ${context.keywords.join(', ')}\n`;
    if (context.brandVoice) prompt += `Brand Voice: ${context.brandVoice}\n`;
    if (context.existingContent)
      prompt += `Existing Content for Reference: ${context.existingContent}\n`;

    prompt += '\nRequirements:\n';
    if (options?.maxLength) prompt += `- Maximum length: ${options.maxLength} characters\n`;
    if (options?.includeEmojis) prompt += `- Include relevant emojis\n`;
    if (options?.language && options.language !== 'en')
      prompt += `- Write in ${options.language}\n`;

    switch (type) {
      case 'subject_line':
        prompt += '- Create compelling subject lines that encourage opens\n';
        prompt += '- Avoid spam trigger words\n';
        prompt += '- Keep under 50 characters for mobile optimization\n';
        break;
      case 'email_content':
        prompt += '- Create engaging email content with clear call-to-action\n';
        prompt += '- Use proper email formatting\n';
        prompt += '- Include personalization opportunities\n';
        break;
      case 'preheader':
        prompt += '- Create preheader text that complements the subject line\n';
        prompt += '- Keep under 90 characters\n';
        prompt += '- Provide additional context or urgency\n';
        break;
    }

    return prompt;
  }

  /**
   * Build optimization prompt
   */
  private buildOptimizationPrompt(request: ContentOptimizationRequest): string {
    let prompt = `Analyze and optimize the following ${request.type.replace('_', ' ')}:\n\n`;
    prompt += `"${request.content}"\n\n`;
    prompt += `Optimization goals: ${request.goals.join(', ')}\n\n`;

    if (request.context?.audience) prompt += `Target audience: ${request.context.audience}\n`;
    if (request.context?.industry) prompt += `Industry: ${request.context.industry}\n`;

    if (request.context?.previousPerformance) {
      prompt += 'Previous performance data:\n';
      const perf = request.context.previousPerformance;
      if (perf.openRate) prompt += `- Open rate: ${perf.openRate}%\n`;
      if (perf.clickRate) prompt += `- Click rate: ${perf.clickRate}%\n`;
      if (perf.conversionRate) prompt += `- Conversion rate: ${perf.conversionRate}%\n`;
    }

    prompt += '\nPlease provide:\n';
    prompt += '1. Optimized version of the content\n';
    prompt += '2. Specific suggestions for improvement\n';
    prompt += '3. Scores for engagement, deliverability, and readability (0-100)\n';
    prompt += '\nFormat your response as JSON with the following structure:\n';
    prompt += '{\n';
    prompt += '  "optimizedContent": "...",\n';
    prompt +=
      '  "suggestions": [{"type": "improvement|warning|tip", "message": "...", "impact": "high|medium|low"}],\n';
    prompt += '  "scores": {"engagement": 0-100, "deliverability": 0-100, "readability": 0-100}\n';
    prompt += '}';

    return prompt;
  }

  /**
   * Get system prompt for content type
   */
  private getSystemPrompt(type: string): string {
    const prompts = {
      subject_line:
        'You are an expert email marketing specialist focused on creating high-converting subject lines. You understand deliverability, spam filters, and what drives email opens.',
      email_content:
        'You are a professional email copywriter who creates engaging, conversion-focused email content. You understand email best practices, personalization, and effective CTAs.',
      preheader:
        'You are an email marketing expert specializing in preheader text optimization. You know how to create compelling preview text that works with subject lines.',
      campaign_name:
        'You are a creative marketing professional who creates memorable and descriptive campaign names for internal organization and tracking.',
      product_description:
        'You are a skilled product copywriter who creates compelling descriptions that highlight benefits and drive conversions.',
    };

    return (
      prompts[type as keyof typeof prompts] ||
      'You are a helpful AI assistant specialized in email marketing content creation.'
    );
  }

  /**
   * Get model for provider
   */
  private getModelForProvider(provider: string): string {
    const models = {
      openai: 'gpt-4-turbo',
      deepseek: 'deepseek-chat',
      openrouter: 'anthropic/claude-3-opus',
    };

    return models[provider as keyof typeof models] || 'gpt-3.5-turbo';
  }

  /**
   * Parse optimization response
   */
  private parseOptimizationResponse(response: string): {
    optimizedContent: string;
    suggestions: Array<{
      type: 'improvement' | 'warning' | 'tip';
      message: string;
      impact: 'high' | 'medium' | 'low';
    }>;
    scores: { engagement: number; deliverability: number; readability: number };
  } {
    try {
      const parsed = JSON.parse(response);
      return {
        optimizedContent: parsed.optimizedContent || '',
        suggestions: (parsed.suggestions || []).map((suggestion: any) => ({
          type: suggestion.type as 'improvement' | 'warning' | 'tip',
          message: suggestion.message || '',
          impact: suggestion.impact as 'high' | 'medium' | 'low',
        })),
        scores: parsed.scores || { engagement: 0, deliverability: 0, readability: 0 },
      };
    } catch (error) {
      // Fallback parsing if JSON is malformed
      return {
        optimizedContent: response,
        suggestions: [],
        scores: { engagement: 50, deliverability: 50, readability: 50 },
      };
    }
  }

  /**
   * Calculate subject line score
   */
  private calculateSubjectLineScore(analysis: SubjectLineAnalysis): number {
    let score = 50; // Base score

    // Length optimization (30-50 characters is ideal)
    if (analysis.length >= 30 && analysis.length <= 50) {
      score += 20;
    } else if (analysis.length < 30) {
      score -= 10;
    } else if (analysis.length > 60) {
      score -= 15;
    }

    // Word count (4-7 words is ideal)
    if (analysis.wordCount >= 4 && analysis.wordCount <= 7) {
      score += 15;
    }

    // Emojis can help but shouldn't be overused
    if (analysis.hasEmojis) {
      score += 5;
    }

    // Numbers can increase engagement
    if (analysis.hasNumbers) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate spam score
   */
  private calculateSpamScore(text: string): number {
    const spamWords = [
      'free',
      'urgent',
      'act now',
      'limited time',
      'click here',
      'buy now',
      'order now',
      'subscribe',
      'unsubscribe',
      'remove',
      'money',
      'cash',
      'prize',
      'winner',
      'congratulations',
    ];

    let score = 0;
    const lowerText = text.toLowerCase();

    spamWords.forEach(word => {
      if (lowerText.includes(word)) {
        score += 10;
      }
    });

    // All caps penalty
    if (text === text.toUpperCase() && text.length > 5) {
      score += 20;
    }

    // Excessive punctuation
    const punctuationCount = (text.match(/[!?]{2,}/g) || []).length;
    score += punctuationCount * 5;

    return Math.min(100, score);
  }

  /**
   * Analyze sentiment
   */
  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = [
      'great',
      'amazing',
      'excellent',
      'fantastic',
      'wonderful',
      'best',
      'love',
      'perfect',
    ];
    const negativeWords = [
      'bad',
      'terrible',
      'awful',
      'hate',
      'worst',
      'horrible',
      'disappointing',
    ];

    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Generate subject line suggestions
   */
  private generateSubjectLineSuggestions(
    analysis: SubjectLineAnalysis,
    subjectLine: string
  ): string[] {
    const suggestions: string[] = [];

    if (analysis.length > 50) {
      suggestions.push('Consider shortening the subject line for better mobile display');
    }

    if (analysis.length < 20) {
      suggestions.push('Subject line might be too short - consider adding more context');
    }

    if (analysis.spamScore > 30) {
      suggestions.push('High spam score detected - avoid promotional language');
    }

    if (!analysis.hasNumbers && !analysis.hasEmojis) {
      suggestions.push('Consider adding numbers or emojis to increase engagement');
    }

    if (analysis.wordCount > 8) {
      suggestions.push('Too many words - aim for 4-7 words for optimal performance');
    }

    return suggestions;
  }

  /**
   * Predict performance
   */
  private predictPerformance(analysis: SubjectLineAnalysis): {
    openRate: number;
    deliverabilityScore: number;
  } {
    // Simple prediction based on analysis factors
    let openRate = 20; // Base open rate
    let deliverabilityScore = 80; // Base deliverability

    // Adjust based on length
    if (analysis.length >= 30 && analysis.length <= 50) {
      openRate += 5;
    }

    // Adjust based on spam score
    deliverabilityScore -= analysis.spamScore * 0.5;

    // Adjust based on engagement factors
    if (analysis.hasNumbers) openRate += 3;
    if (analysis.hasEmojis) openRate += 2;
    if (analysis.sentiment === 'positive') openRate += 2;

    return {
      openRate: Math.max(5, Math.min(50, openRate)),
      deliverabilityScore: Math.max(20, Math.min(100, deliverabilityScore)),
    };
  }
}
