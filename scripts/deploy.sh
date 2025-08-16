#!/bin/bash

# FinPin API Deployment Script
set -e

echo "🚀 Starting FinPin API deployment..."

# Check if required tools are installed
command -v wrangler >/dev/null 2>&1 || { echo "❌ Wrangler CLI is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Type check
echo "🔍 Running type check..."
npm run type-check

# Set environment (default to staging)
ENVIRONMENT=${1:-staging}
echo "🌍 Deploying to environment: $ENVIRONMENT"

# Check if secrets are set
echo "🔐 Checking secrets..."
REQUIRED_SECRETS=("MASTER_KEY_SEED" "JWT_SECRET")

# Check for AI provider secrets
if wrangler secret list --env $ENVIRONMENT | grep -q "OPENAI_API_KEY"; then
    echo "✅ OpenAI API key found"
elif wrangler secret list --env $ENVIRONMENT | grep -q "ARK_API_KEY"; then
    echo "✅ ARK API key found"
else
    echo "❌ No AI provider API key found. Please set either:"
    echo "   wrangler secret put OPENAI_API_KEY --env $ENVIRONMENT"
    echo "   or"
    echo "   wrangler secret put ARK_API_KEY --env $ENVIRONMENT"
    exit 1
fi

for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! wrangler secret list --env $ENVIRONMENT | grep -q "$secret"; then
        echo "❌ Secret $secret is not set. Please run:"
        echo "   wrangler secret put $secret --env $ENVIRONMENT"
        exit 1
    fi
done

echo "✅ All required secrets are configured"

# Deploy to Cloudflare Workers
echo "🚀 Deploying to Cloudflare Workers..."
if [ "$ENVIRONMENT" = "production" ]; then
    wrangler deploy --env production
else
    wrangler deploy --env staging
fi

echo "✅ Deployment completed successfully!"
echo ""
echo "🔗 Your API is now available at:"
if [ "$ENVIRONMENT" = "production" ]; then
    echo "   https://finpin-api.your-domain.workers.dev"
else
    echo "   https://finpin-api-staging.your-domain.workers.dev"
fi
echo ""
echo "📚 Test your deployment:"
echo "   curl https://your-api-url/api/v1/health"
echo ""
echo "🎉 Happy coding!"