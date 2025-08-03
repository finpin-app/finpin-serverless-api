# FinPin Serverless API

An open-source serverless API for expense parsing and device management, designed to run on Cloudflare Workers. This API powers the FinPin expense tracking app and provides intelligent expense parsing using OpenAI-compatible APIs.

## Features

- 🚀 **Serverless**: Runs on Cloudflare Workers with global edge deployment
- 🔒 **Secure**: HMAC-based authentication with device registration
- 🤖 **AI-Powered**: Intelligent expense parsing using OpenAI or ARK API
- ⚡ **Fast**: Built with Hono framework for optimal performance
- 🌍 **Global**: Cloudflare's global network for low latency
- 📊 **Rate Limited**: Built-in rate limiting and caching
- 🔧 **Configurable**: Support for multiple AI providers

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account
- Wrangler CLI installed globally: `npm install -g wrangler`
- OpenAI API key or ARK API access

### 1. Clone and Setup

```bash
git clone https://github.com/finpin-app/finpin-serverless-api.git
cd finpin-serverless-api
npm install
```

### 2. Configure Environment

Copy the example configuration:

```bash
cp wrangler.toml.example wrangler.toml
cp .env.example .env
```

### 3. Set Environment Variables

Edit `wrangler.toml` and configure the following variables:

```toml
[vars]
ENVIRONMENT = "development"
API_VERSION = "v1"
RATE_LIMIT_PER_MINUTE = "10"
REQUEST_TIMEOUT_SECONDS = "30"
SIGNATURE_VALIDITY_MINUTES = "5"

# For OpenAI
OPENAI_MODEL = "gpt-3.5-turbo"
OPENAI_BASE_URL = "https://api.openai.com/v1"

# For ARK (ByteDance)
ARK_MODEL = "doubao-1-5-lite-32k-250115"
ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
```

### 4. Set Secrets

Set your API keys and secrets using Wrangler:

```bash
# For OpenAI
wrangler secret put OPENAI_API_KEY
# Enter your OpenAI API key when prompted

# For ARK API (alternative)
wrangler secret put ARK_API_KEY
# Enter your ARK API key when prompted

# Security secrets
wrangler secret put MASTER_KEY_SEED
# Enter a random string (32+ characters) for device key generation

wrangler secret put JWT_SECRET
# Enter a random string (32+ characters) for JWT signing
```

### 5. Create KV Namespaces

Create the required KV namespaces:

```bash
# Create KV namespaces
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "RATE_LIMIT"

# For preview (development)
wrangler kv:namespace create "CACHE" --preview
wrangler kv:namespace create "RATE_LIMIT" --preview
```

Update the KV namespace IDs in your `wrangler.toml` file with the returned IDs.

### 6. Deploy

```bash
# Development
npm run dev

# Production
npm run deploy
```

## Environment Variables

### Required Secrets (set via `wrangler secret put`)

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (if using OpenAI) | `sk-...` |
| `ARK_API_KEY` | ARK API key (if using ARK) | `your-ark-key` |
| `MASTER_KEY_SEED` | Random seed for device key generation | `your-random-32-char-string` |
| `JWT_SECRET` | Secret for JWT token signing | `your-jwt-secret-32-chars` |

### Configuration Variables (set in `wrangler.toml`)

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `ENVIRONMENT` | Deployment environment | `development` | `development`, `staging`, `production` |
| `API_VERSION` | API version | `v1` | Any string |
| `RATE_LIMIT_PER_MINUTE` | Requests per minute per device | `10` | Number as string |
| `REQUEST_TIMEOUT_SECONDS` | Request timeout | `30` | Number as string |
| `SIGNATURE_VALIDITY_MINUTES` | HMAC signature validity | `5` | Number as string |
| `OPENAI_MODEL` | OpenAI model to use | `gpt-3.5-turbo` | Any OpenAI model |
| `OPENAI_BASE_URL` | OpenAI API base URL | `https://api.openai.com/v1` | URL |
| `ARK_MODEL` | ARK model to use | `doubao-1-5-lite-32k-250115` | Any ARK model |
| `ARK_BASE_URL` | ARK API base URL | `https://ark.cn-beijing.volces.com/api/v3` | URL |

## API Endpoints

### Health Check
```
GET /api/v1/health
```

### Device Registration
```
POST /api/v1/device/register
Content-Type: application/json

{
  "device_id": "unique-device-id",
  "device_info": {
    "model": "iPhone 15 Pro",
    "os_version": "17.0",
    "app_version": "1.0.0",
    "platform": "ios"
  }
}
```

### Expense Parsing
```
POST /api/v1/parse/expense
Content-Type: application/json
x-device-id: your-device-id
x-timestamp: 1640995200
x-signature: hmac-sha256-signature
x-device-token: device-jwt-token

{
  "text": "Paid $12.50 at Starbucks with Visa card",
  "context": {
    "location": "New York, NY",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

## AI Provider Configuration

### Using OpenAI

Set these variables in `wrangler.toml`:
```toml
OPENAI_MODEL = "gpt-3.5-turbo"
OPENAI_BASE_URL = "https://api.openai.com/v1"
```

Set your API key:
```bash
wrangler secret put OPENAI_API_KEY
```

### Using ARK (ByteDance)

Set these variables in `wrangler.toml`:
```toml
ARK_MODEL = "doubao-1-5-lite-32k-250115"
ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
```

Set your API key:
```bash
wrangler secret put ARK_API_KEY
```

### Using Other OpenAI-Compatible APIs

You can use any OpenAI-compatible API by setting the appropriate base URL:

```toml
OPENAI_BASE_URL = "https://your-api-provider.com/v1"
OPENAI_MODEL = "your-model-name"
```

## Development

### Local Development

```bash
npm run dev
```

This starts the Wrangler dev server with hot reload.

### Testing

```bash
npm test
```

### Type Checking

```bash
npm run type-check
```

## Security

This API implements several security measures:

- **HMAC Authentication**: All requests require HMAC-SHA256 signatures
- **Device Registration**: Devices must register before making API calls
- **Rate Limiting**: Configurable rate limits per device
- **Request Validation**: All inputs are validated using Zod schemas
- **Timestamp Validation**: Requests must include valid timestamps
- **JWT Tokens**: Device tokens for additional security

## Deployment

### Production Deployment

1. Update `wrangler.toml` with production settings
2. Set production secrets
3. Deploy:

```bash
npm run deploy
```

### Custom Domains

To use a custom domain, add to your `wrangler.toml`:

```toml
[env.production]
routes = [
  { pattern = "api.yourdomain.com/*", custom_domain = true }
]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📧 Email: contact@finpin.app
- 🐛 Issues: [GitHub Issues](https://github.com/finpin-app/finpin-serverless-api/issues)
- 📖 Documentation: [API Docs](https://docs.finpin.app)

## Related Projects

- [FinPin iOS App](https://github.com/finpin-app/finpin-ios) - The main FinPin iOS application
- [FinPin Website](https://finpin.app) - Official website and shortcuts
