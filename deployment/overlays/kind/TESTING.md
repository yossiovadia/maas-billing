# Testing Guide for Kind Local Development

This guide explains how to test the MaaS platform running on Kind.

## Test Scripts

### 1. Quick Demo (`demo-quick.sh`)

Visual demonstration of the complete request flow.

```bash
./deployment/overlays/kind/demo-quick.sh
```

**What it demonstrates:**
- Kubernetes resources status
- Request without authentication (fails with 401)
- Request with valid API key (succeeds with AI response)
- Complete request flow visualization
- Active policies (AuthPolicy, RateLimitPolicy)

**Output:** Colorized, step-by-step walkthrough with actual API responses.

### 2. Full Test Suite (`test-kind-deployment.sh`)

Comprehensive automated testing of all flows.

```bash
./deployment/overlays/kind/test-kind-deployment.sh
```

**Tests included:**

| # | Test Name | What it Checks |
|---|-----------|----------------|
| 1 | Kubernetes Resources | Pods, deployments, gateway status |
| 2 | Gateway Health | Gateway is responding |
| 3 | Gateway Routing | Multiple paths route correctly |
| 4 | Auth - No Key | Requests without API key are rejected (401) |
| 5 | Auth - Invalid Key | Invalid API keys are rejected (401/403) |
| 6 | Auth - Valid Key | Valid API keys are accepted |
| 7 | LLM Basic Inference | Chat completion works |
| 8 | LLM with Parameters | Temperature and other params work |
| 9 | Rate Limiting | Limitador enforces rate limits (429) |
| 10 | MaaS API Health | MaaS API service is accessible |

**Expected output:**
```
================================================
TEST SUMMARY
================================================
Total Tests: 10
Passed: 10
Failed: 0
================================================

🎉 All tests passed!
```

## Manual Testing

### Test 1: Basic LLM Inference

```bash
curl -X POST http://localhost/v1/chat/completions \
  -H 'Authorization: APIKEY premiumuser1_key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "llm-katan",
    "messages": [
      {"role": "user", "content": "Write a haiku about Kubernetes"}
    ],
    "max_tokens": 50
  }'
```

**Expected:** HTTP 200 with JSON response containing AI-generated haiku.

### Test 2: Authentication Failure

```bash
curl -X POST http://localhost/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "llm-katan",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 10
  }'
```

**Expected:** HTTP 401 Unauthorized (blocked by Authorino).

### Test 3: Invalid API Key

```bash
curl -X POST http://localhost/v1/chat/completions \
  -H 'Authorization: APIKEY invalid_key_12345' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "llm-katan",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 10
  }'
```

**Expected:** HTTP 401 or 403 (invalid key rejected).

### Test 4: Rate Limiting

Send 10 rapid requests with the free user key:

```bash
for i in {1..10}; do
  echo "Request $i:"
  curl -s -w "HTTP: %{http_code}\n" \
    -X POST http://localhost/v1/chat/completions \
    -H 'Authorization: APIKEY freeuser1_key' \
    -H 'Content-Type: application/json' \
    -d '{"model":"llm-katan","messages":[{"role":"user","content":"Hi"}],"max_tokens":5}'
  echo "---"
done
```

**Expected:** First few requests succeed (200), later requests get rate limited (429).

### Test 5: Different LLM Parameters

**With temperature:**
```bash
curl -X POST http://localhost/v1/chat/completions \
  -H 'Authorization: APIKEY premiumuser1_key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "llm-katan",
    "messages": [{"role": "user", "content": "Count to 5"}],
    "max_tokens": 30,
    "temperature": 0.1
  }'
```

**With top_p:**
```bash
curl -X POST http://localhost/v1/chat/completions \
  -H 'Authorization: APIKEY premiumuser1_key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "llm-katan",
    "messages": [{"role": "user", "content": "Say hi"}],
    "max_tokens": 20,
    "top_p": 0.9
  }'
```

### Test 6: Multi-turn Conversation

```bash
curl -X POST http://localhost/v1/chat/completions \
  -H 'Authorization: APIKEY premiumuser1_key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "llm-katan",
    "messages": [
      {"role": "user", "content": "What is 2+2?"},
      {"role": "assistant", "content": "2+2 equals 4."},
      {"role": "user", "content": "What about 3+3?"}
    ],
    "max_tokens": 30
  }'
```

## Testing Flows

### Flow 1: Complete Request Path

**What to test:** End-to-end request from localhost to AI response.

**Steps:**
1. Send request to `http://localhost/v1/chat/completions`
2. Verify Istio Gateway receives it
3. Verify Authorino validates API key
4. Verify Limitador checks rate limits
5. Verify llm-katan processes request
6. Verify AI response is returned

**How to test:**
```bash
# Run the quick demo
./deployment/overlays/kind/demo-quick.sh

# Or watch logs in real-time
kubectl logs -n llm deployment/llm-katan -f &
curl -X POST http://localhost/v1/chat/completions \
  -H 'Authorization: APIKEY premiumuser1_key' \
  -H 'Content-Type: application/json' \
  -d '{"model":"llm-katan","messages":[{"role":"user","content":"Hello"}],"max_tokens":10}'
```

### Flow 2: Policy Enforcement

**What to test:** Policies correctly block/allow traffic.

**Steps:**
1. Test without API key → Should be blocked
2. Test with invalid API key → Should be blocked
3. Test with valid API key → Should succeed
4. Test rapid requests → Should hit rate limit

**How to test:**
```bash
# Run test suite
./deployment/overlays/kind/test-kind-deployment.sh

# Check policy status
kubectl get authpolicies,ratelimitpolicies -A
```

### Flow 3: Gateway Routing

**What to test:** Multiple paths route to correct services.

**Steps:**
1. Request to `/v1/*` → Should route to llm-katan
2. Request to `/maas-api/*` → Should route to maas-api

**How to test:**
```bash
# Test LLM route
curl -I http://localhost/v1/models

# Test MaaS API route
curl -I http://localhost/maas-api/health

# Check routes
kubectl get httproutes -A
```

## Debugging Failed Tests

### Test fails: Gateway not responding

**Check:**
```bash
kubectl get pods -n istio-system
kubectl get gateway maas-gateway -n maas-api
docker ps | grep maas-local
```

**Fix:**
- Ensure Docker Desktop is running
- Check port 80 is not in use: `lsof -ti:80`
- Restart Kind cluster

### Test fails: Authentication not working

**Check:**
```bash
kubectl get pods -n kuadrant-system | grep authorino
kubectl logs -n kuadrant-system deployment/authorino
kubectl describe authpolicy gateway-auth-policy -n maas-api
```

**Fix:**
- Wait for Authorino to be ready: `kubectl wait --for=condition=available deployment/authorino -n kuadrant-system`
- Check AuthPolicy is applied correctly

### Test fails: LLM not responding

**Check:**
```bash
kubectl get pods -n llm
kubectl logs -n llm deployment/llm-katan
kubectl describe pod -n llm -l app=llm-katan
```

**Fix:**
- llm-katan may be downloading model (wait ~30 seconds)
- Check resources: Increase Docker Desktop memory to 8GB
- Check logs for errors

### Test fails: Rate limiting not working

**Check:**
```bash
kubectl get pods -n kuadrant-system | grep limitador
kubectl logs -n kuadrant-system deployment/limitador
kubectl get ratelimitpolicies -A
```

**Fix:**
- Ensure Limitador is running
- Check RateLimitPolicy configuration
- Rate limits may be set high - check policy definition

## Performance Testing

### Load Testing llm-katan

```bash
# Simple load test (requires 'ab' - Apache Bench)
ab -n 100 -c 10 -H "Authorization: APIKEY premiumuser1_key" \
   -p request.json -T application/json \
   http://localhost/v1/chat/completions

# request.json:
# {"model":"llm-katan","messages":[{"role":"user","content":"Hi"}],"max_tokens":5}
```

### Concurrent Requests

```bash
# Send 10 concurrent requests
for i in {1..10}; do
  (curl -s -w "Request $i: %{http_code}\n" \
    -X POST http://localhost/v1/chat/completions \
    -H 'Authorization: APIKEY premiumuser1_key' \
    -H 'Content-Type: application/json' \
    -d '{"model":"llm-katan","messages":[{"role":"user","content":"Test"}],"max_tokens":5}') &
done
wait
```

## Monitoring During Tests

### Watch pod status
```bash
watch kubectl get pods -A
```

### Watch logs
```bash
# Terminal 1: llm-katan
kubectl logs -n llm deployment/llm-katan -f

# Terminal 2: Gateway
kubectl logs -n istio-system deployment/istio-ingressgateway -f

# Terminal 3: Authorino
kubectl logs -n kuadrant-system deployment/authorino -f

# Terminal 4: Run tests
./deployment/overlays/kind/test-kind-deployment.sh
```

### Monitor resource usage
```bash
kubectl top pods -A
kubectl top nodes
```

## CI/CD Integration

To use these tests in CI/CD:

```bash
# In your CI pipeline
./deployment/scripts/kind/install-prerequisites.sh
./deployment/scripts/kind/setup-kind.sh
./deployment/overlays/kind/test-kind-deployment.sh

# Exit code 0 = all tests passed
# Exit code 1 = one or more tests failed
```

## Test Coverage

Current test coverage:

- ✅ Gateway connectivity
- ✅ Gateway routing
- ✅ Kubernetes resource health
- ✅ Authentication (Authorino)
- ✅ Rate limiting (Limitador)
- ✅ LLM inference (llm-katan)
- ✅ OpenAI API compatibility
- ✅ Error handling
- ⏳ MaaS API endpoints (partial)
- ⏳ Policy CRUD operations (not yet implemented)

## Next Steps

After successful testing:

1. **Explore the architecture**: Review `ARCHITECTURE.md` for detailed diagrams
2. **Modify policies**: Edit AuthPolicy or RateLimitPolicy and apply with `kubectl`
3. **Deploy your own model**: Use `test-models/llm-katan/` as a template
4. **Integrate with frontend**: Start the React frontend and connect to `http://localhost`
5. **Contribute**: Create a PR with improvements or new features
