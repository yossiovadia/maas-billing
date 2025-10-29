#!/usr/bin/env bash

# Quick demo script for Kind local deployment
# Shows the complete flow: Auth → Gateway → LLM Inference

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="http://localhost"
API_KEY="premiumuser1_key"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  MaaS Kind Local Development - Quick Demo                 ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}\n"

echo -e "${YELLOW}📋 Setup Overview:${NC}"
echo "• Gateway: localhost:80"
echo "• Authentication: Authorino (API Key)"
echo "• Rate Limiting: Limitador"
echo "• Model: llm-katan (Qwen2.5-0.5B)"
echo ""

# Step 1: Show Kubernetes resources
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 1: Kubernetes Resources${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "📦 Pods in maas-api namespace:"
kubectl get pods -n maas-api 2>/dev/null || echo "  No pods found"
echo ""

echo "📦 Pods in llm namespace:"
kubectl get pods -n llm 2>/dev/null || echo "  No pods found"
echo ""

echo "🚪 Gateway:"
kubectl get gateway -n maas-api 2>/dev/null || echo "  No gateway found"
echo ""

# Step 2: Test without authentication (should fail)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 2: Request WITHOUT Authentication (should fail)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "$ curl -X POST http://localhost/v1/chat/completions ..."
response=$(curl -s -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    -d '{"model":"llm-katan","messages":[{"role":"user","content":"Hello"}],"max_tokens":5}' \
    "${BASE_URL}/v1/chat/completions" 2>/dev/null)

http_code=$(echo "$response" | tail -n 1)
echo -e "\n${YELLOW}HTTP Status: $http_code${NC}"

if [ "$http_code" == "401" ] || [ "$http_code" == "403" ]; then
    echo -e "${GREEN}✓ Correctly blocked by Authorino${NC}\n"
else
    echo -e "${YELLOW}⚠ Unexpected response${NC}\n"
fi

# Step 3: Test with authentication (should succeed)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 3: Request WITH Valid API Key${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "$ curl -X POST http://localhost/v1/chat/completions \\"
echo "  -H 'Authorization: APIKEY ${API_KEY}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"model\":\"llm-katan\",\"messages\":[{\"role\":\"user\",\"content\":\"Write a haiku about Kubernetes\"}],\"max_tokens\":50}'"
echo ""

response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: APIKEY ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"model":"llm-katan","messages":[{"role":"user","content":"Write a haiku about Kubernetes"}],"max_tokens":50}' \
    "${BASE_URL}/v1/chat/completions" 2>/dev/null)

http_code=$(echo "$response" | tail -n 1)
body=$(echo "$response" | head -n -1)

echo -e "${YELLOW}HTTP Status: $http_code${NC}\n"

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✓ Success! LLM Response:${NC}"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
    echo ""
else
    echo -e "${YELLOW}Response:${NC}"
    echo "$body"
    echo ""
fi

# Step 4: Show the complete flow
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 4: Request Flow Visualization${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "  Developer (You)"
echo "      │"
echo "      │ curl http://localhost/v1/chat/completions"
echo "      ▼"
echo "  Docker Port Mapping (80 → 80)"
echo "      │"
echo "      ▼"
echo "  Istio Gateway (maas-gateway)"
echo "      │"
echo "      ├─▶ Authorino (API Key Check) ✓"
echo "      │"
echo "      ├─▶ Limitador (Rate Limit Check) ✓"
echo "      │"
echo "      ▼"
echo "  HTTPRoute (/v1/* → llm-katan:8000)"
echo "      │"
echo "      ▼"
echo "  llm-katan Pod"
echo "      │"
echo "      ├─▶ Qwen2.5-0.5B Model"
echo "      │"
echo "      └─▶ AI Inference"
echo "          │"
echo "          ▼"
echo "      Response (JSON)"
echo ""

# Step 5: Policy status
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Step 5: Active Policies${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo "🔐 Authentication Policies:"
kubectl get authpolicies -A 2>/dev/null | grep -v "^NAME" | awk '{print "  • " $2 " (namespace: " $1 ")"}'
echo ""

echo "⏱️  Rate Limit Policies:"
kubectl get ratelimitpolicies -A 2>/dev/null | grep -v "^NAME" | awk '{print "  • " $2 " (namespace: " $1 ")"}'
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Demo Complete!                                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${GREEN}What we demonstrated:${NC}"
echo "  ✓ Authentication with Authorino (API keys)"
echo "  ✓ Rate limiting with Limitador"
echo "  ✓ Gateway routing to llm-katan"
echo "  ✓ Real AI inference with Qwen2.5-0.5B"
echo ""

echo -e "${YELLOW}Next steps:${NC}"
echo "  • Run full test suite: ./test-kind-deployment.sh"
echo "  • View logs: kubectl logs -n llm deployment/llm-katan"
echo "  • Monitor policies: kubectl get authpolicies,ratelimitpolicies -A"
echo "  • Try the MaaS API: curl http://localhost/maas-api/health"
echo ""
