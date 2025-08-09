// Environment bindings for Cloudflare Workers

// Extend Hono context to include our custom variables
declare module 'hono' {
  interface ContextVariableMap {
    handlers: any;
  }
}
export interface Env {
  // Secrets - AI Provider (choose one)
  OPENAI_API_KEY?: string;
  ARK_API_KEY?: string;
  MASTER_KEY_SEED: string;
  JWT_SECRET: string;

  // Environment variables
  ENVIRONMENT: string;
  API_VERSION: string;
  RATE_LIMIT_PER_MINUTE: string;
  REQUEST_TIMEOUT_SECONDS: string;
  SIGNATURE_VALIDITY_MINUTES: string;

  // OpenAI Configuration
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;

  // ARK Configuration (alternative to OpenAI)
  ARK_MODEL?: string;
  ARK_BASE_URL?: string;
  
  // KV Namespaces
  CACHE: KVNamespace;
  RATE_LIMIT: KVNamespace;
}

// API Request/Response types
export interface DeviceRegistrationRequest {
  device_id: string;
  device_info: {
    model: string;
    os_version: string;
    app_version: string;
    platform: 'ios' | 'android';
  };
}

export interface DeviceRegistrationResponse {
  success: boolean;
  data: {
    key_seed: string;
    expires_at: string;
    device_token: string;
  };
  error?: string;
}

export interface ExpenseParseRequest {
  text: string;
  context?: {
    location?: string;
    timestamp?: string;
    image_metadata?: {
      width?: number;
      height?: number;
      format?: string;
    };
    timezone_offset?: number;
  };
}

export interface ExpenseParseResponse {
  success: boolean;
  data?: {
    amount: string;
    currency: string;
    merchant?: string;
    payment_method?: string;
    payment_card?: string;
    location?: string;
    timestamp?: string;
    confidence: number;
    extensions?: {
      category?: string;
      tags?: string[];
      description?: string;
    };
  };
  error?: string;
}

// Security types
export interface RequestHeaders {
  'x-device-id': string;
  'x-timestamp': string;
  'x-signature': string;
  'x-device-token'?: string;
}

export interface DeviceInfo {
  device_id: string;
  key_seed: string;
  registered_at: string;
  last_seen: string;
  request_count: number;
  device_info: {
    model: string;
    os_version: string;
    app_version: string;
    platform: string;
  };
}

// OpenAI API types
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: {
    type: 'json_object';
  };
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Error types
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends APIError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string) {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends APIError {
  constructor(message: string) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}
