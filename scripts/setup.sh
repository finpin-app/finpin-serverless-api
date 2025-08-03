#!/bin/bash

# FinPin Serverless API Setup Script
# This script helps you set up the FinPin Serverless API on Cloudflare Workers

set -e

echo "🚀 FinPin Serverless API Setup"
echo "================================"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI is not installed. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

echo "✅ Wrangler CLI found"

# Check if user is logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please log in to Cloudflare:"
    wrangler login
fi

echo "✅ Cloudflare authentication verified"

# Create KV namespaces
echo "📦 Creating KV namespaces..."

echo "Creating CACHE namespace..."
CACHE_ID=$(wrangler kv:namespace create "CACHE" --preview false | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
CACHE_PREVIEW_ID=$(wrangler kv:namespace create "CACHE" --preview | grep -o 'preview_id = "[^"]*"' | cut -d'"' -f2)

echo "Creating RATE_LIMIT namespace..."
RATE_LIMIT_ID=$(wrangler kv:namespace create "RATE_LIMIT" --preview false | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
RATE_LIMIT_PREVIEW_ID=$(wrangler kv:namespace create "RATE_LIMIT" --preview | grep -o 'preview_id = "[^"]*"' | cut -d'"' -f2)

echo "✅ KV namespaces created:"
echo "   CACHE: $CACHE_ID (preview: $CACHE_PREVIEW_ID)"
echo "   RATE_LIMIT: $RATE_LIMIT_ID (preview: $RATE_LIMIT_PREVIEW_ID)"

# Update wrangler.toml with KV namespace IDs
if [ -f "wrangler.toml" ]; then
    echo "📝 Updating wrangler.toml with KV namespace IDs..."
    
    # Create a backup
    cp wrangler.toml wrangler.toml.backup
    
    # Replace placeholder IDs
    sed -i.tmp "s/your-cache-kv-namespace-id/$CACHE_ID/g" wrangler.toml
    sed -i.tmp "s/your-cache-preview-id/$CACHE_PREVIEW_ID/g" wrangler.toml
    sed -i.tmp "s/your-rate-limit-kv-namespace-id/$RATE_LIMIT_ID/g" wrangler.toml
    sed -i.tmp "s/your-rate-limit-preview-id/$RATE_LIMIT_PREVIEW_ID/g" wrangler.toml
    
    # Clean up temporary files
    rm wrangler.toml.tmp
    
    echo "✅ wrangler.toml updated with KV namespace IDs"
else
    echo "⚠️  wrangler.toml not found. Please copy from wrangler.toml.example first."
fi

# Prompt for secrets
echo ""
echo "🔐 Setting up secrets..."
echo "You'll need to provide the following secrets:"

# AI Provider selection
echo ""
echo "Choose your AI provider:"
echo "1) OpenAI"
echo "2) ARK (ByteDance)"
echo "3) Other OpenAI-compatible API"
read -p "Enter your choice (1-3): " ai_choice

case $ai_choice in
    1)
        echo "Setting up OpenAI..."
        read -p "Enter your OpenAI API key: " -s openai_key
        echo ""
        wrangler secret put OPENAI_API_KEY <<< "$openai_key"
        echo "✅ OpenAI API key set"
        ;;
    2)
        echo "Setting up ARK API..."
        read -p "Enter your ARK API key: " -s ark_key
        echo ""
        wrangler secret put ARK_API_KEY <<< "$ark_key"
        echo "✅ ARK API key set"
        ;;
    3)
        echo "Setting up custom OpenAI-compatible API..."
        read -p "Enter your API key: " -s custom_key
        echo ""
        wrangler secret put OPENAI_API_KEY <<< "$custom_key"
        echo "✅ Custom API key set"
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

# Master key seed
echo ""
read -p "Enter a random master key seed (32+ characters): " -s master_seed
echo ""
wrangler secret put MASTER_KEY_SEED <<< "$master_seed"
echo "✅ Master key seed set"

# JWT secret
echo ""
read -p "Enter a random JWT secret (32+ characters): " -s jwt_secret
echo ""
wrangler secret put JWT_SECRET <<< "$jwt_secret"
echo "✅ JWT secret set"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Review and customize your wrangler.toml configuration"
echo "2. Test locally: npm run dev"
echo "3. Deploy: npm run deploy"
echo ""
echo "📖 For more information, see the README.md file"
