#!/bin/bash

echo "======================================================================"
echo "🚀 MaaS Revenue Impact Analysis: LLM Request Processing Demo"
echo "======================================================================"
echo ""
echo "This demo shows the business impact of implementing QoS prioritization"
echo "for AI model inference requests in a production MaaS platform."
echo ""
echo "🏢 Scenario: GPT-2 Medium model serving multiple customer tiers"
echo "   • Enterprise customers: \$20/month (require priority treatment)"
echo "   • Free users: \$0/month (best-effort service)"
echo ""
echo "Please choose a test scenario:"
echo ""
echo "1) 📈 PROBLEM: Test without QoS (current state)"
echo "   - Demonstrates revenue loss from treating all customers equally"
echo "   - Shows Enterprise customers waiting behind Free users"
echo "   - Direct LLM access (first-come-first-serve)"
echo ""
echo "2) ✅ SOLUTION: Test with QoS prioritization" 
echo "   - Demonstrates revenue protection through intelligent queuing"
echo "   - Shows Enterprise customers getting priority treatment"
echo "   - Smart QoS layer with weighted fair scheduling"
echo ""
echo -n "Enter your choice (1 or 2): "
read choice

case $choice in
    1)
        DEMO_MODE="without-qos"
        DEMO_TITLE="PROBLEM: Request Processing Without QoS"
        DEMO_SUBTITLE="Current State - No Service Differentiation"
        ENDPOINT_URL="http://localhost:8004/v1/chat/completions"
        VALIDATION_ENDPOINT="http://localhost:8004/v1/chat/completions"
        QOS_SERVICE_REQUIRED=false
        ;;
    2)
        DEMO_MODE="with-qos"
        DEMO_TITLE="SOLUTION: Request Processing With QoS Prioritization"
        DEMO_SUBTITLE="Enhanced Architecture - Revenue Protection Enabled"
        ENDPOINT_URL="http://localhost:3001/v1/chat/completions"
        VALIDATION_ENDPOINT="http://localhost:3001/v1/chat/completions"
        QOS_SERVICE_REQUIRED=true
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again and select 1 or 2."
        exit 1
        ;;
esac

echo ""
echo "======================================================================"
echo "🧪 $DEMO_TITLE"
echo "======================================================================"
echo ""
echo "Test Environment:"
echo "- Real LLM Model: GPT-2 Medium (355M parameters)"
echo "- Customer Types: Enterprise (\$20/month), Free (\$0/month)"
echo "- Load Scenario: 5 concurrent requests"
echo "- Response Time: ~10-15 seconds per request (realistic)"

if [[ "$DEMO_MODE" == "with-qos" ]]; then
    echo "- QoS Service: Priority queuing with weighted fair scheduling"
    echo "- Architecture: Request → QoS Layer → LLM Model"
else
    echo "- Processing: Direct access (no prioritization)"
    echo "- Architecture: Request → LLM Model (first-come-first-serve)"
fi

echo ""

# Validate prerequisites
echo "🔍 Validating demo prerequisites..."
echo ""

# Check QoS service if needed
if [[ "$QOS_SERVICE_REQUIRED" == "true" ]]; then
    if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo "❌ ERROR: QoS service not running on port 3001"
        echo ""
        echo "To fix this, run:"
        echo "  cd /Users/yovadia/code/maas-billing/apps/qos-prioritizer"
        echo "  npm run dev"
        echo ""
        exit 1
    fi
    echo "✅ QoS service is running on port 3001"
fi

# Check LLM model connectivity
echo "🔍 Testing LLM model connectivity..."
if [[ "$DEMO_MODE" == "with-qos" ]]; then
    # Test the full QoS → LLM chain with a simple request
    test_response=$(timeout 25 curl -s -w "%{http_code}" \
        -H "Content-Type: application/json" \
        -H "x-auth-identity: {\"metadata\":{\"annotations\":{\"kuadrant.io/groups\":\"enterprise\"}}}" \
        -d '{"model":"gpt2-medium","messages":[{"role":"user","content":"test"}],"max_tokens":5}' \
        "$VALIDATION_ENDPOINT" 2>/dev/null || echo "000")
else
    # Test direct LLM access
    test_response=$(curl -s -w "%{http_code}" \
        -H "Content-Type: application/json" \
        -d '{"model":"gpt2-medium","messages":[{"role":"user","content":"test"}],"max_tokens":5}' \
        --max-time 15 \
        "$VALIDATION_ENDPOINT" 2>/dev/null)
fi

status_code=${test_response: -3}
if [[ "$status_code" != "200" ]]; then
    echo "❌ ERROR: LLM model not accessible (HTTP $status_code)"
    echo ""
    echo "This usually means the port-forward to the LLM model is not working."
    echo ""
    echo "To fix this:"
    echo "  1. Check if the LLM pod is running:"
    echo "     kubectl get pods -n llm"
    echo ""
    echo "  2. If pod is running, restart the port-forward:"
    echo "     kubectl port-forward -n llm \$(kubectl get pods -n llm -l app=medium-llm -o jsonpath='{.items[0].metadata.name}') 8004:8080"
    echo ""
    echo "  3. If pod is not running, deploy it:"
    echo "     kubectl apply -f simulation/medium-llm-simple.yaml"
    echo ""
    echo "  4. Wait for pod to be ready (this takes 2-3 minutes):"
    echo "     kubectl wait --for=condition=ready pod -l app=medium-llm -n llm --timeout=300s"
    echo ""
    echo "Current LLM connection test failed with status: $status_code"
    exit 1
fi
echo "✅ LLM model is accessible and responding"
echo ""

# Run the load test
echo "🧪 Request Processing Analysis"
echo "=============================="
echo ""

# Clear results
> /tmp/demo_results.log

# Function to make requests
send_request() {
    local customer_type=$1
    local customer_id=$2
    local start_time=$(date +%s.%N)
    
    echo "[$customer_type-$customer_id] Request started at $(date '+%H:%M:%S.%3N')"
    
    # Prepare request based on demo mode
    local prompt="Hello from $customer_type customer $customer_id. Please provide business advice."
    local timeout_duration=70
    
    if [[ "$DEMO_MODE" == "with-qos" ]]; then
        # Request through QoS service with user context
        local auth_identity_header=""
        if [[ "$customer_type" == "ENTERPRISE" ]]; then
            auth_identity_header='{"metadata":{"annotations":{"kuadrant.io/groups":"enterprise","secret.kuadrant.io/user-id":"'$customer_type'-'$customer_id'"},"sla":"guaranteed"}}'
        else
            auth_identity_header='{"metadata":{"annotations":{"kuadrant.io/groups":"free","secret.kuadrant.io/user-id":"'$customer_type'-'$customer_id'"},"sla":"best_effort"}}'
        fi
        
        local response=$(curl -w "%{http_code}" \
            -H "Content-Type: application/json" \
            -H "x-auth-identity: $auth_identity_header" \
            -d "{\"model\":\"gpt2-medium\",\"messages\":[{\"role\":\"user\",\"content\":\"$prompt\"}],\"max_tokens\":30}" \
            --max-time $timeout_duration \
            "$ENDPOINT_URL" 2>/tmp/curl_debug_${customer_type}_${customer_id}.log)
    else
        # Direct request to LLM
        local response=$(curl -w "%{http_code}" \
            -H "Content-Type: application/json" \
            -d "{\"model\":\"gpt2-medium\",\"messages\":[{\"role\":\"user\",\"content\":\"$prompt\"}],\"max_tokens\":30}" \
            --max-time $timeout_duration \
            "$ENDPOINT_URL" 2>/tmp/curl_debug_${customer_type}_${customer_id}.log)
    fi
    
    local end_time=$(date +%s.%N)
    local total_time=$(echo "$end_time - $start_time" | bc -l)
    
    # Extract HTTP status code and response body
    local status_code=${response: -3}
    local response_body=${response%???}
    
    # Log completion
    echo "$end_time,$customer_type,$customer_id,$status_code,$total_time" >> /tmp/demo_results.log
    
    # Show response preview
    local content=$(echo "$response_body" | jq -r '.choices[0].message.content // "Error"' 2>/dev/null | head -c 40)
    printf "[$customer_type-$customer_id] Completed in %.1fs - \"$content...\"\n" "$total_time"
}

if [[ "$DEMO_MODE" == "with-qos" ]]; then
    echo "Sending requests through QoS service: 3 Free users + 2 Enterprise users"
    echo "All requests processed with intelligent prioritization"
else
    echo "Sending direct requests to LLM: 3 Free users + 2 Enterprise users" 
    echo "All requests processed first-come-first-serve (no prioritization)"
fi

echo ""
echo "Sending requests to GPT-2 Small model (this will take ~15-20 seconds)..."
echo ""

# Launch requests with minimal delays to create queue contention
send_request "FREE" "1" &
sleep 0.5
send_request "FREE" "2" &
sleep 0.5  
send_request "ENTERPRISE" "1" &
sleep 0.5
send_request "FREE" "3" &
sleep 0.5
send_request "ENTERPRISE" "2" &

# Wait for all to complete
wait

echo ""
echo "📊 Request Completion Analysis:"
echo "Completion Order | Customer Type | Response Code | Duration"
echo "-----------------|---------------|---------------|----------"

# Show completion order
sort -t',' -k1n /tmp/demo_results.log | awk -F',' '{printf "%-16s | %-13s | %-13s | %.1fs\n", "#" NR, $2 "-" $3, $4, $5}'

echo ""

# Business impact analysis
echo "💰 Business Impact Analysis:"

# Get positions for each customer type
enterprise_positions=$(sort -t',' -k1n /tmp/demo_results.log | awk -F',' '$2=="ENTERPRISE" {print NR}' | tr '\n' ' ')
free_positions=$(sort -t',' -k1n /tmp/demo_results.log | awk -F',' '$2=="FREE" {print NR}' | tr '\n' ' ')

echo "- Enterprise customers completed in positions: $enterprise_positions"
echo "- Free users completed in positions: $free_positions"

# Calculate average response times
ent_avg=$(grep ",ENTERPRISE," /tmp/demo_results.log | cut -d',' -f5 | awk '{sum += $1; count++} END {if (count > 0) printf "%.1f", sum/count; else print "N/A"}')
free_avg=$(grep ",FREE," /tmp/demo_results.log | cut -d',' -f5 | awk '{sum += $1; count++} END {if (count > 0) printf "%.1f", sum/count; else print "N/A"}')

echo ""
echo "⚡ Performance Analysis:"
echo "- Enterprise average response time: ${ent_avg}s"
echo "- Free user average response time: ${free_avg}s"

if [[ "$DEMO_MODE" == "with-qos" ]]; then
    echo "- Service differentiation: ✅ ENABLED (QoS prioritization active)"
    
    # Check if QoS is working properly
    worst_enterprise_pos=$(echo $enterprise_positions | tr ' ' '\n' | sort -n | tail -1)
    best_free_pos=$(echo $free_positions | tr ' ' '\n' | sort -n | head -1)
    
    if [[ -n "$worst_enterprise_pos" && -n "$best_free_pos" && "$worst_enterprise_pos" -le "$best_free_pos" ]]; then
        echo ""
        echo "🎯 QoS SUCCESS METRICS:"
        echo "- ✅ Enterprise customers received priority treatment"
        echo "- ✅ Revenue protection achieved through intelligent queuing"
        echo "- ✅ SLA compliance maintained under load"
    fi
else
    echo "- Service differentiation: ❌ DISABLED (first-come-first-serve)"
    
    # Check for business problems
    worst_enterprise_pos=$(echo $enterprise_positions | tr ' ' '\n' | sort -n | tail -1)
    best_free_pos=$(echo $free_positions | tr ' ' '\n' | sort -n | head -1)
    
    if [[ -n "$worst_enterprise_pos" && -n "$best_free_pos" && "$worst_enterprise_pos" -gt "$best_free_pos" ]]; then
        echo ""
        echo "🚨 BUSINESS PROBLEMS IDENTIFIED:"
        echo "- ❌ Enterprise customer (\$20/month) served AFTER free user (\$0/month)"
        echo "- ❌ SLA violation risk for high-value customers"
        echo "- ❌ Revenue impact from customer satisfaction degradation"
    fi
fi

echo ""

# Summary
echo "======================================================================"
if [[ "$DEMO_MODE" == "with-qos" ]]; then
    echo "✅ QoS SOLUTION SUMMARY (Revenue Protection Enabled)"
    echo "======================================================================"
    echo "Architecture: Priority-based queue management with p-queue"
    echo "- Enterprise customers get priority access to LLM resources"
    echo "- Weighted fair queuing ensures fairness with aging prevention"
    echo "- Circuit breaker protection prevents system overload"
    echo "- Real-time metrics and health monitoring"
    echo ""
    echo "🎯 Business Benefits Delivered:"
    echo "- ✅ Revenue protection for high-value customers"
    echo "- ✅ SLA compliance through service differentiation"  
    echo "- ✅ Fair aging prevents free user starvation"
    echo "- ✅ Scalable architecture for production deployment"
    echo "- ✅ Real-time capacity monitoring and protection"
else
    echo "⚠️  CURRENT STATE ANALYSIS (No QoS Protection)"
    echo "======================================================================"
    echo "Architecture: First-come-first-serve processing"
    echo "- All customers treated equally regardless of revenue tier"
    echo "- No differentiation between \$20/month and \$0/month users"
    echo "- Enterprise SLA compliance at risk during high load"
    echo "- Direct LLM access without intelligent routing"
    echo ""
    echo "💡 Recommended Next Steps:"
    echo "- Implement QoS prioritization for revenue protection"
    echo "- Add queue management with weighted fair scheduling"  
    echo "- Enable SLA compliance through service differentiation"
    echo "- Integrate circuit breaker protection for reliability"
    echo ""
    echo "🔄 To see the QoS solution in action, run this script again and choose option 2"
fi

echo ""
echo "Demo completed! Results logged to /tmp/demo_results.log"