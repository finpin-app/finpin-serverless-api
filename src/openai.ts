import { Env, OpenAIRequest, OpenAIResponse, ExpenseParseRequest, APIError } from './types';

export class OpenAIService {
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private env: Env) {
    // Support both OpenAI and ARK APIs
    if (env.ARK_API_KEY && env.ARK_BASE_URL) {
      this.baseURL = env.ARK_BASE_URL;
      this.apiKey = env.ARK_API_KEY;
      this.model = env.ARK_MODEL || 'doubao-1-5-lite-32k-250115';
    } else if (env.OPENAI_API_KEY && env.OPENAI_BASE_URL) {
      this.baseURL = env.OPENAI_BASE_URL;
      this.apiKey = env.OPENAI_API_KEY;
      this.model = env.OPENAI_MODEL || 'gpt-3.5-turbo';
    } else {
      throw new Error('No valid AI provider configuration found. Please set either OpenAI or ARK credentials.');
    }
  }

  /**
   * Parse expense text using OpenAI GPT
   */
  async parseExpenseText(request: ExpenseParseRequest): Promise<any> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(request);

    const openaiRequest: OpenAIRequest = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    };

    try {
      const response = await this.callOpenAI(openaiRequest);
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new APIError('Empty response from AI API', 500, 'AI_API_ERROR');
      }
      const result = JSON.parse(content);

      // Validate and normalize the response
      return this.normalizeResponse(result, request);
    } catch (error) {
      console.error('AI API error:', error);
      throw new APIError('Failed to parse expense text', 500, 'AI_API_ERROR');
    }
  }

  /**
   * Build system prompt for expense parsing
   */
  private buildSystemPrompt(): string {
    return `You are an expert financial transaction parser specializing in mobile payment receipts and bank transaction records. Extract structured information from payment text in any language with high accuracy.

CRITICAL: Respond with valid JSON only. No explanations, comments, or additional text.

EXTRACTION TARGETS:
- amount: Numerical value only (string, remove currency symbols, commas, spaces)
- currency: ISO 4217 code (USD, GBP, EUR, CNY, JPY, ISK, etc.)
- merchant: Primary business/merchant name (clean, without extra info)
- payment_method: Payment method (Apple Pay, Google Pay, Alipay, WeChat Pay, Credit Card, Debit Card, etc.)
- payment_card: Specific card/bank (Monzo, HSBC, Starling, Chase, Visa, Mastercard, etc.)
- location: Geographic location (city, country, or address)
- timestamp: ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ) or null
- confidence: Accuracy score (0.0-1.0)
- extensions: Additional metadata

PARSING RULES:
1. AMOUNT: Look for numerical values with currency symbols (£, $, ¥, €, kr, ISK, etc.)
   - Remove all non-numeric characters except decimal points
   - Handle formats: "£9.65", "ISK 2,799", "¥25.00", "$12.50"

2. CURRENCY: Map symbols and codes to ISO standards
   - £ → GBP, $ → USD, ¥ → CNY/JPY, € → EUR, kr/ISK → ISK
   - Look for explicit codes: USD, GBP, EUR, CNY, JPY, ISK

3. MERCHANT: Extract primary business name
   - Prioritize recognizable brand names: "Costa Coffee", "Starbucks", "McDonald's"
   - Clean up: "Costa Coffee，英格兰 Hounslow" → "Costa Coffee"
   - Ignore: transaction IDs, addresses, extra descriptors

4. PAYMENT_METHOD: Identify payment method
   - Mobile: Apple Pay, Google Pay, Samsung Pay
   - Chinese: Alipay, WeChat Pay, 支付宝, 微信支付
   - Cards: Credit Card, Debit Card, Visa, Mastercard
   - If card type mentioned: "Visa Debit Card" → "Debit Card"

5. PAYMENT_CARD: Identify bank/card provider
   - Banks: Monzo, HSBC, Chase, Starling, Revolut, etc.
   - Card types: Visa, Mastercard, American Express
   - Format: "HSBC UK Visa Debit Card" → "HSBC"

6. LOCATION: Extract geographic information
   - Cities: "Hounslow", "凱夫拉維克", "Beijing"
   - Countries: "英格兰" → "England", "Iceland"
   - Airports: "机场" indicates airport location

7. TIMESTAMP: Parse date/time information
   - Formats: "2023-09-20 01:47", "2022/12/16 14:09", "09:41"
   - Convert to ISO 8601 or null if incomplete

8. EXTENSIONS: Add contextual information
   - category: Food & Beverage, Transportation, Shopping, Accommodation, etc.
   - tags: Relevant keywords ["coffee", "airport", "hotel", "restaurant"]
   - description: Brief summary of the transaction

9. CONFIDENCE: Base on information clarity
   - 0.9-1.0: All key fields clearly identified
   - 0.7-0.9: Most fields identified, some ambiguity
   - 0.5-0.7: Basic info only, significant ambiguity
   - <0.5: Very unclear or incomplete

LANGUAGE HANDLING:
- English: Standard processing
- Chinese: Handle mixed Chinese/English text
- Other languages: Extract recognizable elements

EXAMPLE RESPONSES:

Costa Coffee Transaction:
{
  "amount": "9.65",
  "currency": "GBP",
  "merchant": "Costa Coffee",
  "payment_method": "Debit Card",
  "payment_card": "HSBC",
  "location": "Hounslow, England",
  "timestamp": "2023-09-20T01:47:00Z",
  "confidence": 0.92,
  "extensions": {
    "category": "Food & Beverage",
    "tags": ["coffee", "food", "airport"],
    "description": "Costa Coffee purchase at Hounslow"
  }
}

Hotel Transaction:
{
  "amount": "2799",
  "currency": "ISK",
  "merchant": "Aurora Star Airport Hotel",
  "payment_method": "Credit Card",
  "payment_card": "Monzo",
  "location": "Keflavik, Iceland",
  "timestamp": "2022-12-16T14:09:00Z",
  "confidence": 0.88,
  "extensions": {
    "category": "Accommodation",
    "tags": ["hotel", "airport", "travel"],
    "description": "Airport hotel payment in Iceland"
  }
}`;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(request: ExpenseParseRequest): string {
    let prompt = `TRANSACTION TEXT TO PARSE:\n\n"${request.text}"\n\n`;

    // Add context information if available
    if (request.context) {
      prompt += `ADDITIONAL CONTEXT:\n`;
      if (request.context.location) {
        prompt += `- User Location: ${request.context.location}\n`;
      }
      if (request.context.timestamp) {
        prompt += `- Transaction Time: ${request.context.timestamp}\n`;
      }
      if (request.context.image_metadata) {
        prompt += `- Source: Image/Screenshot (${request.context.image_metadata.format})\n`;
      }
      prompt += `\n`;
    }

    prompt += `PARSING INSTRUCTIONS:
1. Carefully analyze the text for financial transaction information
2. Extract all identifiable elements according to the system rules
3. Pay special attention to currency symbols and amount formatting
4. Identify merchant names even if mixed with location/address info
5. Handle multi-language text (English, Chinese, etc.)
6. Return only the JSON response, no other text

PARSE NOW:`;

    return prompt;
  }

  /**
   * Call OpenAI-compatible API (OpenAI, ARK, or other providers)
   */
  private async callOpenAI(request: OpenAIRequest): Promise<OpenAIResponse> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('ARK API error:', response.status, error);
      throw new APIError(`ARK API error: ${response.status}`, response.status);
    }

    return await response.json();
  }

  /**
   * Normalize and validate OpenAI response
   */
  private normalizeResponse(result: any, originalRequest: ExpenseParseRequest): any {
    // Validate required fields
    if (!result.amount || !result.currency) {
      throw new APIError('Invalid response: missing amount or currency');
    }

    // Normalize currency code
    result.currency = this.normalizeCurrency(result.currency);

    // Ensure confidence is within valid range
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      result.confidence = 0.5;
    }

    // Ensure extensions object exists
    if (!result.extensions) {
      result.extensions = {};
    }

    // Add parsing metadata
    result.extensions.parsed_at = new Date().toISOString();
    result.extensions.source = 'openai_gpt';
    result.extensions.original_text = originalRequest.text;

    return result;
  }

  /**
   * Normalize currency codes
   */
  private normalizeCurrency(currency: string): string {
    const currencyMap: { [key: string]: string } = {
      '¥': 'CNY',
      '￥': 'CNY',
      '元': 'CNY',
      '$': 'USD',
      '美元': 'USD',
      '€': 'EUR',
      '欧元': 'EUR',
      '£': 'GBP',
      '英镑': 'GBP',
      '港币': 'HKD',
      '港元': 'HKD',
      '台币': 'TWD',
      '新台币': 'TWD',
      '日元': 'JPY',
      '韩元': 'KRW',
    };

    // Direct mapping
    if (currencyMap[currency]) {
      return currencyMap[currency];
    }

    // Already ISO code
    if (/^[A-Z]{3}$/.test(currency)) {
      return currency;
    }

    // Default fallback
    return 'USD';
  }

  /**
   * Health check for ARK service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testRequest: OpenAIRequest = {
        model: this.env.ARK_MODEL || 'doubao-1-5-lite-32k-250115',
        messages: [
          { role: 'user', content: 'Respond with "OK" if you can process this request.' }
        ],
        max_tokens: 10
      };

      const response = await this.callOpenAI(testRequest);
      return response.choices?.[0]?.message?.content?.includes('OK') || false;
    } catch (error) {
      console.error('AI API health check failed:', error);
      return false;
    }
  }
}
