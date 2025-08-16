#!/bin/bash

# FinPin API Secrets Setup Script
set -e

echo "🔐 Setting up FinPin API secrets..."

# Set environment (default to staging)
ENVIRONMENT=${1:-staging}
echo "🌍 Setting up secrets for environment: $ENVIRONMENT"

# Function to generate random base64 string
generate_secret() {
    openssl rand -base64 32
}

# Function to set secret
set_secret() {
    local secret_name=$1
    local secret_value=$2
    
    echo "Setting $secret_name..."
    echo "$secret_value" | wrangler secret put "$secret_name" --env "$ENVIRONMENT"
}

# AI Provider selection
echo ""
echo "Choose your AI provider:"
echo "1) OpenAI"
echo "2) ARK (ByteDance)"
echo "3) Other OpenAI-compatible API"
read -p "Enter your choice (1-3): " ai_choice

case $ai_choice in
    1)
        if [ -z "$OPENAI_API_KEY" ]; then
            echo "❌ OPENAI_API_KEY environment variable is required"
            echo "Please set it with: export OPENAI_API_KEY=your-openai-api-key-here"
            exit 1
        fi
        set_secret "OPENAI_API_KEY" "$OPENAI_API_KEY"
        ;;
    2)
        if [ -z "$ARK_API_KEY" ]; then
            echo "❌ ARK_API_KEY environment variable is required"
            echo "Please set it with: export ARK_API_KEY=your-ark-api-key-here"
            exit 1
        fi
        set_secret "ARK_API_KEY" "$ARK_API_KEY"
        ;;
    3)
        if [ -z "$OPENAI_API_KEY" ]; then
            echo "❌ OPENAI_API_KEY environment variable is required for custom provider"
            echo "Please set it with: export OPENAI_API_KEY=your-custom-api-key-here"
            exit 1
        fi
        set_secret "OPENAI_API_KEY" "$OPENAI_API_KEY"
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

# Generate and set master key seed
echo "🔑 Generating master key seed..."
MASTER_KEY_SEED=$(generate_secret)
set_secret "MASTER_KEY_SEED" "$MASTER_KEY_SEED"

# Generate and set JWT secret
echo "🔑 Generating JWT secret..."
JWT_SECRET=$(generate_secret)
set_secret "JWT_SECRET" "$JWT_SECRET"

echo "✅ All secrets have been configured successfully!"
echo ""
echo "📝 Secrets summary:"
case $ai_choice in
    1|3) echo "   - OPENAI_API_KEY: ✅ Set" ;;
    2) echo "   - ARK_API_KEY: ✅ Set" ;;
esac
echo "   - MASTER_KEY_SEED: ✅ Generated and set"
echo "   - JWT_SECRET: ✅ Generated and set"
echo ""
echo "🚀 You can now deploy your API with:"
echo "   ./scripts/deploy.sh $ENVIRONMENT"