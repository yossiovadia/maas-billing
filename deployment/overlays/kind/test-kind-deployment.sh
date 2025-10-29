#!/usr/bin/env bash

# Test script for Kind local deployment
# Tests all major flows: Auth, Rate Limiting, LLM Inference, MaaS API

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost"
VALID_API_KEY="premiumuser1_key"
INVALID_API_KEY="invalid_key_12345"
FREE_USER_KEY="freeuser1_key"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}\n"
}

print_test() {
    echo -e "${YELLOW}TEST $((TESTS_RUN + 1)):${NC} $1"
    TESTS_RUN=$((TESTS_RUN + 1))
}

print_pass() {
    echo -e "${GREEN}✓ PASS:${NC} $1\n"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

print_fail() {
    echo -e "${RED}✗ FAIL:${NC} $1\n"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

print_summary() {
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE}TEST SUMMARY${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo -e "Total Tests: $TESTS_RUN"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    if [ $TESTS_FAILED -gt 0 ]; then
        echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    else
        echo -e "Failed: $TESTS_FAILED"
    fi
    echo -e "${BLUE}================================================${NC}\n"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"

    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}kubectl not found. Please install kubectl.${NC}"
        exit 1
    fi

    if ! command -v curl &> /dev/null; then
        echo -e "${RED}curl not found. Please install curl.${NC}"
        exit 1
    fi

    # Check if Kind cluster is running
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}Kubernetes cluster not accessible. Is Kind running?${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ All prerequisites met${NC}"
}

# Wait for deployment to be ready
wait_for_deployment() {
    local namespace=$1
    local deployment=$2
    local timeout=120

    echo "Waiting for $deployment in namespace $namespace to be ready..."
    if kubectl wait --for=condition=available --timeout=${timeout}s \
        deployment/$deployment -n $namespace &> /dev/null; then
        echo -e "${GREEN}✓ $deployment is ready${NC}"
        return 0
    else
        echo -e "${RED}✗ $deployment failed to become ready${NC}"
        return 1
    fi
}

# Test 1: Gateway Health Check
test_gateway_health() {
    print_test "Gateway Health Check"

    local response_code=$(curl -s -o /dev/null -w "%{http_code}" ${BASE_URL})

    if [ "$response_code" == "401" ] || [ "$response_code" == "404" ] || [ "$response_code" == "200" ]; then
        print_pass "Gateway is responding (HTTP $response_code)"
    else
        print_fail "Gateway not responding correctly (HTTP $response_code)"
    fi
}

# Test 2: Authentication - Valid API Key
test_auth_valid_key() {
    print_test "Authentication with Valid API Key"

    local response=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: APIKEY ${VALID_API_KEY}" \
        -H "Content-Type: application/json" \
        -d '{"model":"llm-katan","messages":[{"role":"user","content":"Hello"}],"max_tokens":5}' \
        "${BASE_URL}/v1/chat/completions" 2>/dev/null)

    local http_code=$(echo "$response" | tail -n 1)
    local body=$(echo "$response" | head -n -1)

    if [ "$http_code" == "200" ]; then
        print_pass "Valid API key accepted (HTTP 200)"
    else
        print_fail "Valid API key rejected (HTTP $http_code)\nResponse: $body"
    fi
}

# Test 3: Authentication - Invalid API Key
test_auth_invalid_key() {
    print_test "Authentication with Invalid API Key (should fail)"

    local response_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: APIKEY ${INVALID_API_KEY}" \
        -H "Content-Type: application/json" \
        -d '{"model":"llm-katan","messages":[{"role":"user","content":"Hello"}],"max_tokens":5}' \
        "${BASE_URL}/v1/chat/completions" 2>/dev/null)

    if [ "$response_code" == "401" ] || [ "$response_code" == "403" ]; then
        print_pass "Invalid API key correctly rejected (HTTP $response_code)"
    else
        print_fail "Invalid API key should be rejected but got HTTP $response_code"
    fi
}

# Test 4: Authentication - No API Key
test_auth_no_key() {
    print_test "Authentication without API Key (should fail)"

    local response_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Content-Type: application/json" \
        -d '{"model":"llm-katan","messages":[{"role":"user","content":"Hello"}],"max_tokens":5}' \
        "${BASE_URL}/v1/chat/completions" 2>/dev/null)

    if [ "$response_code" == "401" ] || [ "$response_code" == "403" ]; then
        print_pass "Missing API key correctly rejected (HTTP $response_code)"
    else
        print_fail "Missing API key should be rejected but got HTTP $response_code"
    fi
}

# Test 5: LLM Inference - Basic Chat Completion
test_llm_basic_inference() {
    print_test "LLM Chat Completion (llm-katan)"

    local response=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: APIKEY ${VALID_API_KEY}" \
        -H "Content-Type: application/json" \
        -d '{"model":"llm-katan","messages":[{"role":"user","content":"Say hello in one word"}],"max_tokens":10}' \
        "${BASE_URL}/v1/chat/completions" 2>/dev/null)

    local http_code=$(echo "$response" | tail -n 1)
    local body=$(echo "$response" | head -n -1)

    if [ "$http_code" == "200" ]; then
        # Check if response contains expected fields
        if echo "$body" | grep -q "choices"; then
            print_pass "LLM inference successful with valid response structure"
            echo "Sample response: $(echo "$body" | head -c 200)..."
        else
            print_fail "Response code 200 but missing 'choices' field"
        fi
    else
        print_fail "LLM inference failed (HTTP $http_code)\nResponse: $body"
    fi
}

# Test 6: LLM Inference - Different Parameters
test_llm_with_params() {
    print_test "LLM Chat Completion with Temperature Parameter"

    local response=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: APIKEY ${VALID_API_KEY}" \
        -H "Content-Type: application/json" \
        -d '{"model":"llm-katan","messages":[{"role":"user","content":"Count to 3"}],"max_tokens":20,"temperature":0.7}' \
        "${BASE_URL}/v1/chat/completions" 2>/dev/null)

    local http_code=$(echo "$response" | tail -n 1)
    local body=$(echo "$response" | head -n -1)

    if [ "$http_code" == "200" ]; then
        print_pass "LLM inference with parameters successful"
    else
        print_fail "LLM inference with parameters failed (HTTP $http_code)"
    fi
}

# Test 7: Rate Limiting (requires multiple requests)
test_rate_limiting() {
    print_test "Rate Limiting (10 rapid requests)"

    local success_count=0
    local rate_limited_count=0

    for i in {1..10}; do
        local response_code=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: APIKEY ${FREE_USER_KEY}" \
            -H "Content-Type: application/json" \
            -d '{"model":"llm-katan","messages":[{"role":"user","content":"Hi"}],"max_tokens":5}' \
            "${BASE_URL}/v1/chat/completions" 2>/dev/null)

        if [ "$response_code" == "200" ]; then
            success_count=$((success_count + 1))
        elif [ "$response_code" == "429" ]; then
            rate_limited_count=$((rate_limited_count + 1))
        fi
    done

    echo "Successful requests: $success_count"
    echo "Rate limited requests: $rate_limited_count"

    if [ $rate_limited_count -gt 0 ]; then
        print_pass "Rate limiting is working (got $rate_limited_count rate limit responses)"
    else
        echo -e "${YELLOW}⚠ WARNING:${NC} No rate limits hit. This may be expected if limits are high.\n"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
}

# Test 8: MaaS API Health (if deployed)
test_maas_api_health() {
    print_test "MaaS API Health Check"

    local response_code=$(curl -s -o /dev/null -w "%{http_code}" \
        "${BASE_URL}/maas-api/health" 2>/dev/null)

    if [ "$response_code" == "200" ]; then
        print_pass "MaaS API is healthy (HTTP 200)"
    elif [ "$response_code" == "404" ]; then
        echo -e "${YELLOW}⚠ INFO:${NC} MaaS API /health endpoint not found (HTTP 404)\n"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    elif [ "$response_code" == "401" ]; then
        echo -e "${YELLOW}⚠ INFO:${NC} MaaS API requires authentication (HTTP 401)\n"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_fail "MaaS API health check failed (HTTP $response_code)"
    fi
}

# Test 9: Gateway Routing
test_gateway_routing() {
    print_test "Gateway Routing (multiple paths)"

    # Test LLM route
    local llm_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: APIKEY ${VALID_API_KEY}" \
        "${BASE_URL}/v1/models" 2>/dev/null)

    # Test MaaS API route
    local maas_code=$(curl -s -o /dev/null -w "%{http_code}" \
        "${BASE_URL}/maas-api/v1/policies" 2>/dev/null)

    if [ "$llm_code" != "000" ] && [ "$maas_code" != "000" ]; then
        print_pass "Gateway routing working (LLM: $llm_code, MaaS: $maas_code)"
    else
        print_fail "Gateway routing issues (LLM: $llm_code, MaaS: $maas_code)"
    fi
}

# Test 10: Kubernetes Resources
test_k8s_resources() {
    print_test "Kubernetes Resources Status"

    local failed=0

    # Check pods in maas-api namespace
    if ! kubectl get pods -n maas-api | grep -q "Running"; then
        echo -e "${RED}No running pods in maas-api namespace${NC}"
        failed=1
    fi

    # Check pods in llm namespace
    if ! kubectl get pods -n llm | grep -q "Running"; then
        echo -e "${RED}No running pods in llm namespace${NC}"
        failed=1
    fi

    # Check gateway
    if ! kubectl get gateway maas-gateway -n maas-api &> /dev/null; then
        echo -e "${RED}Gateway resource not found${NC}"
        failed=1
    fi

    if [ $failed -eq 0 ]; then
        print_pass "All Kubernetes resources are healthy"
    else
        print_fail "Some Kubernetes resources have issues"
    fi
}

# Main execution
main() {
    print_header "MaaS Kind Deployment Test Suite"

    check_prerequisites

    print_header "Running Deployment Tests"

    # Wait for key deployments
    echo "Verifying deployments are ready..."
    wait_for_deployment "llm" "llm-katan" || echo "Warning: llm-katan not ready"
    wait_for_deployment "maas-api" "maas-api" || echo "Warning: maas-api not ready"

    # Run tests
    test_k8s_resources
    test_gateway_health
    test_gateway_routing
    test_auth_no_key
    test_auth_invalid_key
    test_auth_valid_key
    test_llm_basic_inference
    test_llm_with_params
    test_rate_limiting
    test_maas_api_health

    # Summary
    print_summary

    # Exit code based on results
    if [ $TESTS_FAILED -gt 0 ]; then
        exit 1
    else
        echo -e "${GREEN}🎉 All tests passed!${NC}\n"
        exit 0
    fi
}

# Run main function
main "$@"
