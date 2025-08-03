import { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  Env,
  DeviceRegistrationRequest,
  DeviceRegistrationResponse,
  ExpenseParseRequest,
  ExpenseParseResponse,
  DeviceInfo,
  ValidationError,
  AuthenticationError
} from './types';
import { SecurityManager } from './security';
import { OpenAIService } from './openai';

// Validation schemas
const deviceRegistrationSchema = z.object({
  device_id: z.string().min(1).max(100),
  device_info: z.object({
    model: z.string().min(1).max(50),
    os_version: z.string().min(1).max(20),
    app_version: z.string().min(1).max(20),
    platform: z.enum(['ios', 'android'])
  })
});

const expenseParseSchema = z.object({
  text: z.string().min(1).max(5000),
  context: z.object({
    location: z.string().optional(),
    timestamp: z.string().optional(),
    image_metadata: z.object({
      width: z.number().optional(),
      height: z.number().optional(),
      format: z.string().optional()
    }).optional()
  }).optional()
});

export class APIHandlers {
  private security: SecurityManager;
  private openai: OpenAIService;

  constructor(private env: Env) {
    this.security = new SecurityManager(env);
    this.openai = new OpenAIService(env);
  }

  /**
   * Health check endpoint
   */
  async healthCheck(c: Context): Promise<Response> {
    const arkHealthy = await this.openai.healthCheck();

    return c.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: this.env.API_VERSION,
        environment: this.env.ENVIRONMENT,
        services: {
          ark_api: arkHealthy ? 'healthy' : 'unhealthy'
        }
      }
    });
  }

  /**
   * Device registration endpoint
   */
  async registerDevice(c: Context): Promise<Response> {
    try {
      const body = await c.req.json();
      const validatedData = deviceRegistrationSchema.parse(body);
      
      // Generate device-specific key seed
      const keySeed = await this.security.generateKeySeed(validatedData.device_id);
      const deviceToken = await this.security.generateDeviceToken(validatedData.device_id);
      
      // Store device information
      const deviceInfo: DeviceInfo = {
        device_id: validatedData.device_id,
        key_seed: keySeed,
        registered_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        request_count: 0,
        device_info: validatedData.device_info
      };
      
      await this.security.storeDeviceInfo(deviceInfo);
      
      const response: DeviceRegistrationResponse = {
        success: true,
        data: {
          key_seed: keySeed,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          device_token: deviceToken
        }
      };
      
      return c.json(response);
    } catch (error) {
      console.error('Device registration error:', error);
      
      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        }, 400);
      }
      
      return c.json({
        success: false,
        error: 'Registration failed'
      }, 500);
    }
  }

  /**
   * Expense parsing endpoint
   */
  async parseExpense(c: Context): Promise<Response> {
    try {
      // Extract and validate headers
      const deviceId = c.req.header('x-device-id');
      const timestamp = c.req.header('x-timestamp');
      const signature = c.req.header('x-signature');
      
      if (!deviceId || !timestamp || !signature) {
        throw new AuthenticationError('Missing required headers');
      }

      // Get raw request body text first (before parsing)
      const rawRequestBody = await c.req.text();

      // Parse the JSON for validation
      let body;
      try {
        body = JSON.parse(rawRequestBody);
      } catch (error) {
        throw new ValidationError('Invalid JSON in request body');
      }

      const validatedData = expenseParseSchema.parse(body);

      // Check rate limiting
      await this.security.checkRateLimit(deviceId);

      // Verify request signature using the raw request body
      const isValidSignature = await this.security.verifySignature(
        deviceId,
        timestamp,
        signature,
        rawRequestBody
      );
      
      if (!isValidSignature) {
        throw new AuthenticationError('Invalid request signature');
      }
      
      // Update device last seen
      await this.security.updateDeviceLastSeen(deviceId);
      
      // Parse expense using ARK API
      const parseResult = await this.openai.parseExpenseText(validatedData);
      
      const response: ExpenseParseResponse = {
        success: true,
        data: parseResult
      };
      
      return c.json(response);
    } catch (error) {
      console.error('Expense parsing error:', error);
      
      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        }, 400);
      }
      
      if (error instanceof AuthenticationError) {
        return c.json({
          success: false,
          error: error.message
        }, error.statusCode as any);
      }
      
      return c.json({
        success: false,
        error: 'Parsing failed'
      }, 500);
    }
  }

  /**
   * Get device information (for debugging)
   */
  async getDeviceInfo(c: Context): Promise<Response> {
    try {
      const deviceId = c.req.param('deviceId');
      
      if (!deviceId) {
        throw new ValidationError('Device ID is required');
      }
      
      const deviceInfo = await this.security.getDeviceInfo(deviceId);
      
      if (!deviceInfo) {
        return c.json({
          success: false,
          error: 'Device not found'
        }, 404);
      }
      
      // Remove sensitive information
      const safeDeviceInfo = {
        device_id: deviceInfo.device_id,
        registered_at: deviceInfo.registered_at,
        last_seen: deviceInfo.last_seen,
        request_count: deviceInfo.request_count,
        device_info: deviceInfo.device_info
      };
      
      return c.json({
        success: true,
        data: safeDeviceInfo
      });
    } catch (error) {
      console.error('Get device info error:', error);
      
      return c.json({
        success: false,
        error: 'Failed to get device information'
      }, 500);
    }
  }

  /**
   * API usage statistics
   */
  async getStats(c: Context): Promise<Response> {
    try {
      // This is a simple implementation - in production you might want more sophisticated analytics
      return c.json({
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          environment: this.env.ENVIRONMENT,
          version: this.env.API_VERSION,
          uptime: 'N/A', // Cloudflare Workers don't have traditional uptime
          message: 'Statistics endpoint - implement detailed analytics as needed'
        }
      });
    } catch (error) {
      console.error('Stats error:', error);
      
      return c.json({
        success: false,
        error: 'Failed to get statistics'
      }, 500);
    }
  }

  /**
   * CORS preflight handler
   */
  async handleCORS(c: Context): Promise<Response> {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-device-id, x-timestamp, x-signature, x-device-token',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
}
