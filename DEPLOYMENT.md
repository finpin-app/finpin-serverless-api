# Deployment Guide

This guide will help you deploy the FinPin Serverless API to Cloudflare Workers.

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Node.js 18+**: Download from [nodejs.org](https://nodejs.org)
3. **Wrangler CLI**: Install globally with `npm install -g wrangler`

## Quick Deployment

### 1. Clone and Setup

```bash
git clone https://github.com/finpin-app/finpin-serverless-api.git
cd finpin-serverless-api
npm install
```

### 2. Configure Environment

```bash
# Copy example configuration
cp wrangler.toml.example wrangler.toml
cp .env.example .env

# Edit wrangler.toml with your settings
# Edit .env with your API keys (for local development)
```

### 3. Automated Setup (Recommended)

```bash
npm run setup
```

This script will:
- Create required KV namespaces
- Update wrangler.toml with namespace IDs
- Prompt for and set all required secrets

### 4. Manual Setup (Alternative)

If you prefer manual setup:

#### Create KV Namespaces

```bash
# Create production namespaces
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "RATE_LIMIT"

# Create preview namespaces
wrangler kv:namespace create "CACHE" --preview
wrangler kv:namespace create "RATE_LIMIT" --preview
```

#### Set Secrets

```bash
# Choose your AI provider and set the appropriate key
wrangler secret put OPENAI_API_KEY    # For OpenAI
# OR
wrangler secret put ARK_API_KEY       # For ARK (ByteDance)

# Set security secrets
wrangler secret put MASTER_KEY_SEED   # Random string (32+ chars)
wrangler secret put JWT_SECRET        # Random string (32+ chars)
```

#### Update wrangler.toml

Replace the placeholder KV namespace IDs in `wrangler.toml` with the actual IDs from step 1.

### 5. Test Locally

```bash
npm run dev
```

Visit `http://localhost:8787` to test your API locally.

### 6. Deploy to Production

```bash
npm run deploy
```

## Environment Configuration

### AI Provider Options

#### OpenAI
```toml
[vars]
OPENAI_MODEL = "gpt-3.5-turbo"
OPENAI_BASE_URL = "https://api.openai.com/v1"
```

#### ARK (ByteDance)
```toml
[vars]
ARK_MODEL = "doubao-1-5-lite-32k-250115"
ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
```

#### Other OpenAI-Compatible APIs
```toml
[vars]
OPENAI_MODEL = "your-model-name"
OPENAI_BASE_URL = "https://your-provider.com/v1"
```

### Custom Domain (Optional)

To use a custom domain:

1. Add your domain to Cloudflare
2. Update `wrangler.toml`:

```toml
[env.production]
routes = [
  { pattern = "api.yourdomain.com/*", custom_domain = true }
]
```

3. Deploy: `npm run deploy`

## Verification

After deployment, test your API:

```bash
# Health check
curl https://your-worker.your-subdomain.workers.dev/api/v1/health

# Expected response:
{
  "success": true,
  "message": "API is healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "ai_provider": "openai" // or "ark"
}
```

## Troubleshooting

### Common Issues

1. **KV Namespace Errors**: Ensure KV namespace IDs in `wrangler.toml` match the created namespaces
2. **Authentication Errors**: Verify your API keys are set correctly with `wrangler secret list`
3. **CORS Issues**: Check that your client app's domain is properly configured
4. **Rate Limiting**: Adjust `RATE_LIMIT_PER_MINUTE` in `wrangler.toml` if needed

### Logs

View deployment logs:
```bash
wrangler tail
```

### Secrets Management

List current secrets:
```bash
wrangler secret list
```

Update a secret:
```bash
wrangler secret put SECRET_NAME
```

Delete a secret:
```bash
wrangler secret delete SECRET_NAME
```

## Production Considerations

1. **Rate Limiting**: Adjust based on your expected traffic
2. **Monitoring**: Set up Cloudflare Analytics and alerts
3. **Backup**: Regularly backup your KV data if needed
4. **Security**: Rotate secrets periodically
5. **Scaling**: Cloudflare Workers auto-scale, but monitor usage

## Support

- 📧 Email: contact@finpin.app
- 🐛 Issues: [GitHub Issues](https://github.com/finpin-app/finpin-serverless-api/issues)
- 📖 Documentation: [API Docs](https://docs.finpin.app)
