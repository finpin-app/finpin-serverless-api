import { Env, DeviceInfo, AuthenticationError, RateLimitError } from './types';

export class SecurityManager {
  constructor(private env: Env) {}

  /**
   * Generate a unique device ID based on device characteristics
   */
  async generateDeviceId(deviceInfo: any): Promise<string> {
    const data = JSON.stringify({
      model: deviceInfo.model,
      platform: deviceInfo.platform,
      timestamp: Date.now()
    });
    
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate encrypted key seed for device
   */
  async generateKeySeed(deviceId: string): Promise<string> {
    const masterSeed = this.env.MASTER_KEY_SEED;
    const timestamp = Date.now().toString();
    
    // Create device-specific seed
    const seedData = `${masterSeed}:${deviceId}:${timestamp}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(seedData);
    
    // Generate HMAC
    const keyBuffer = encoder.encode(masterSeed);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
    const signatureArray = Array.from(new Uint8Array(signature));
    return btoa(signatureArray.map(b => String.fromCharCode(b)).join(''));
  }

  /**
   * Verify request signature
   */
  async verifySignature(
    deviceId: string,
    timestamp: string,
    signature: string,
    requestBody: string
  ): Promise<boolean> {
    try {
      // Get device info from cache
      const deviceInfo = await this.getDeviceInfo(deviceId);
      if (!deviceInfo) {
        throw new AuthenticationError('Device not registered');
      }

      // Check timestamp validity
      const requestTime = parseInt(timestamp);
      const now = Date.now();
      const validityWindow = parseInt(this.env.SIGNATURE_VALIDITY_MINUTES) * 60 * 1000;
      
      if (Math.abs(now - requestTime) > validityWindow) {
        throw new AuthenticationError('Request timestamp expired');
      }

      // Generate expected signature
      const keySeed = deviceInfo.key_seed;
      const message = `${timestamp}${deviceId}${await this.hashString(requestBody)}`;
      const expectedSignature = await this.generateHMAC(keySeed, message);

      return signature === expectedSignature;
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Generate HMAC signature
   */
  private async generateHMAC(key: string, message: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyBuffer = encoder.encode(key);
    const messageBuffer = encoder.encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBuffer);
    const signatureArray = Array.from(new Uint8Array(signature));
    return btoa(signatureArray.map(b => String.fromCharCode(b)).join(''));
  }

  /**
   * Hash string using SHA-256
   */
  private async hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check rate limiting
   */
  async checkRateLimit(deviceId: string): Promise<void> {
    const key = `rate_limit:${deviceId}`;
    const now = Date.now();
    const windowStart = now - (60 * 1000); // 1 minute window
    
    // Get current request count
    const currentCount = await this.env.RATE_LIMIT.get(key);
    const requests = currentCount ? JSON.parse(currentCount) : [];
    
    // Filter requests within the time window
    const recentRequests = requests.filter((timestamp: number) => timestamp > windowStart);
    
    // Check if rate limit exceeded
    const maxRequests = parseInt(this.env.RATE_LIMIT_PER_MINUTE);
    if (recentRequests.length >= maxRequests) {
      throw new RateLimitError(`Rate limit exceeded: ${maxRequests} requests per minute`);
    }
    
    // Add current request
    recentRequests.push(now);
    
    // Store updated request history
    await this.env.RATE_LIMIT.put(key, JSON.stringify(recentRequests), {
      expirationTtl: 3600 // 1 hour TTL
    });
  }

  /**
   * Store device information
   */
  async storeDeviceInfo(deviceInfo: DeviceInfo): Promise<void> {
    const key = `device:${deviceInfo.device_id}`;
    await this.env.CACHE.put(key, JSON.stringify(deviceInfo), {
      expirationTtl: 86400 * 30 // 30 days TTL
    });
  }

  /**
   * Get device information
   */
  async getDeviceInfo(deviceId: string): Promise<DeviceInfo | null> {
    const key = `device:${deviceId}`;
    const data = await this.env.CACHE.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update device last seen timestamp
   */
  async updateDeviceLastSeen(deviceId: string): Promise<void> {
    const deviceInfo = await this.getDeviceInfo(deviceId);
    if (deviceInfo) {
      deviceInfo.last_seen = new Date().toISOString();
      deviceInfo.request_count += 1;
      await this.storeDeviceInfo(deviceInfo);
    }
  }

  /**
   * Generate device token for additional security
   */
  async generateDeviceToken(deviceId: string): Promise<string> {
    const payload = {
      device_id: deviceId,
      issued_at: Date.now(),
      expires_at: Date.now() + (86400 * 1000 * 30) // 30 days
    };
    
    const encoder = new TextEncoder();
    const payloadBuffer = encoder.encode(JSON.stringify(payload));
    const keyBuffer = encoder.encode(this.env.JWT_SECRET);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, payloadBuffer);
    const signatureArray = Array.from(new Uint8Array(signature));
    const signatureBase64 = btoa(signatureArray.map(b => String.fromCharCode(b)).join(''));
    
    return `${btoa(JSON.stringify(payload))}.${signatureBase64}`;
  }
}
