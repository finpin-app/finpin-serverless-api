#!/bin/bash

# FinPin API Test Script
set -e

echo "🧪 Testing AI API connection..."

# Function to test OpenAI API
test_openai() {
    local api_key=$1
    local base_url=${2:-"https://api.openai.com/v1"}
    local model=${3:-"gpt-3.5-turbo"}
    
    echo "📡 Testing OpenAI API call..."
    
    curl -s "$base_url/chat/completions" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $api_key" \
      -d "{
        \"model\": \"$model\",
        \"messages\": [
          {\"role\": \"system\", \"content\": \"You are a professional financial transaction parser. Extract structured information from payment text and respond with valid JSON only.\"},
          {\"role\": \"user\", \"content\": \"Parse this payment text: Apple Pay payment \$25.00 at Starbucks Coffee. Return JSON format.\"}
        ],
        \"max_tokens\": 500,
        \"temperature\": 0.1
      }" | jq '.'
}

# Function to test ARK API
test_ark() {
    local api_key=$1
    local base_url=${2:-"https://ark.cn-beijing.volces.com/api/v3"}
    local model=${3:-"doubao-1-5-lite-32k-250115"}
    
    echo "📡 Testing ARK API call..."
    
    curl -s "$base_url/chat/completions" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $api_key" \
      -d "{
        \"model\": \"$model\",
        \"messages\": [
          {\"role\": \"system\", \"content\": \"You are a professional financial transaction parser. Extract structured information from payment text and respond with valid JSON only.\"},
          {\"role\": \"user\", \"content\": \"Parse this payment text: Apple Pay payment \$25.00 at Starbucks Coffee. Return JSON format.\"}
        ],
        \"max_tokens\": 500,
        \"temperature\": 0.1
      }" | jq '.'
}

# Check which API to test
if [ -n "$OPENAI_API_KEY" ]; then
    echo "🔍 Found OPENAI_API_KEY, testing OpenAI API..."
    test_openai "$OPENAI_API_KEY" "$OPENAI_BASE_URL" "$OPENAI_MODEL"
elif [ -n "$ARK_API_KEY" ]; then
    echo "🔍 Found ARK_API_KEY, testing ARK API..."
    test_ark "$ARK_API_KEY" "$ARK_BASE_URL" "$ARK_MODEL"
else
    echo "❌ No API key found. Please set one of:"
    echo "   export OPENAI_API_KEY=your-openai-api-key-here"
    echo "   export ARK_API_KEY=your-ark-api-key-here"
    exit 1
fi

echo ""
echo "✅ API test completed!"
echo ""
echo "💡 If the test was successful, you can now deploy your Cloudflare Workers:"
echo "   ./scripts/deploy.sh production"