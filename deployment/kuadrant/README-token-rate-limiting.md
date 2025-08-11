# Models as a Service with Kuadrant

This repository demonstrates how to deploy a Models-as-a-Service platform using Kuadrant. Kuadrant provides cloud-native API gateway capabilities using Istio and the Gateway API.

## Architecture Overview

**Gateway:** API Gateway + Istio/Envoy with Kuadrant policies integrated
**Models:** KServe InferenceServices (Qwen, Simulator)
**Authentication:** API Keys (simple) or Keycloak (Red Hat SSO)
**Rate Limiting:** Kuadrant RateLimitPolicy
**Observability:** Prometheus + Kuadrant Scrapes (for Kuadrant chargeback WIP see [Question on mapping authorized_calls metrics to a user](https://github.com/Kuadrant/limitador/issues/434))

### Key Components

- **Istio Service Mesh**: Provides the data plane for traffic management
- **Kuadrant Operator**: Manages API policies and traffic control
- **Limitador**: Rate limiting service with Redis backend
- **Authorino**: Authentication and authorization service
- **Gateway API**: Standard Kubernetes API for ingress traffic
- **KServe**: Model serving platform that creates model pods

## How Model Pods Get Created

**The flow that creates actual running model pods:**

```bash
1. Apply an InferenceService YAML
   ↓
2. KServe Controller sees the InferenceService
   ↓
3. KServe creates a Deployment for your model
   ↓
4. Deployment creates Pod(s) with:
   - GPU allocation
   - Model download from HuggingFace
   - vLLM or other serving runtime
   ↓
5. Pod starts serving model on port 8080
   ↓
6. Kube Service exposes the pod
   ↓
7. HTTPRoute creates domain-based routing (e.g., qwen3.maas.local, simulator.maas.local)
   ↓
8. Kuadrant policies protect each domain route
```

## Prerequisites

- Kubernetes cluster with admin access
- kubectl configured
- For KIND clusters: `kind create cluster --name llm-maas`
- For minikube with GPU: `minikube start --driver docker --container-runtime docker --gpus all --memory no-limit --cpus no-limit`
- Kustomize

## 🚀 Quick Start (Automated Installer)

**For KIND clusters (no GPU):**

```bash
cd ~/rhmaas/models-aas/deployment/kuadrant
./install.sh --simulator
```

**For GPU clusters:**

```bash
cd ~/rhmaas/models-aas/deployment/kuadrant  
./install.sh --qwen3
```

**More Examples**

```bash
git clone https://github.com/redhat-et/models-aas.git
cd deployment/kuadrant
./install.sh --simulator            # For testing without GPU
./install.sh --qwen3                # For GPU clusters with real AI models
./install.sh --install-all-models   # For deploying both the qwen (on a GPU) and Sim
./install.sh --deploy-kind          # Deploy a Kind cluster with a model simulator
```

The installer will:
- ✅ Deploy Istio + Gateway API + KServe + Kuadrant
- ✅ Configure gateway-level authentication and rate limiting
- ✅ Deploy your chosen model (simulator or Qwen3-0.6B)
- ✅ Set up tiered API keys (Free/Premium/Enterprise)
- ✅ Show you the port-forward and test commands

**After installation, run the port-forward command shown to access your API!**

---

## Manual Deployment (Advanced)

Follow the manual deployment steps below for full understanding and control over your MaaS deployment.

## Manual Deployment Instructions

```shell
git clone https://github.com/redhat-et/maas-billing.git 
cd deployment/kuadrant
```

### 1. Install Istio and Gateway API

Install Istio and Gateway API CRDs using the provided script:

- Install Gateway API CRDs
- Install Istio base components and Istiod

```bash
chmod +x istio-install.sh
./istio-install.sh apply
```

This manifest will create the required namespaces (`llm` and `llm-observability`)

Create additional namespaces:

```bash
kubectl apply -f 00-namespaces.yaml
```

### 2. Install KServe (for Model Serving)

**Note:** KServe requires cert-manager for webhook certificates.

```bash
# Install cert-manager first
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.18.2/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=Available deployment/cert-manager -n cert-manager --timeout=300s
kubectl wait --for=condition=Available deployment/cert-manager-cainjector -n cert-manager --timeout=300s
kubectl wait --for=condition=Available deployment/cert-manager-webhook -n cert-manager --timeout=300s

# Install KServe CRDs and controller
kubectl apply --server-side -f https://github.com/kserve/kserve/releases/download/v0.15.2/kserve.yaml

# Wait for KServe controller to be ready
kubectl wait --for=condition=Available deployment/kserve-controller-manager -n kserve --timeout=300s

# Configure KServe for Gateway API integration
kubectl apply -f 01-kserve-config.yaml

# Restart KServe controller to pick up new configuration
kubectl rollout restart deployment/kserve-controller-manager -n kserve
kubectl wait --for=condition=Available deployment/kserve-controller-manager -n kserve --timeout=120s

# View inferenceervice configmap
kubectl get configmap inferenceservice-config -n kserve -o yaml

kubectl get configmap inferenceservice-config -n kserve \
  -o jsonpath='{.data.deploy}{"\n"}{.data.ingress}{"\n"}'
```

### 3. Configure Gateway and Routing

The configuration is pre-configured for domain-based routing. Deploy the Gateway and routing configuration:

```bash
kubectl apply -f 02-gateway-configuration.yaml
kubectl apply -f 03-model-routing-domains.yaml
```

**Note:** If you want to use a different domain, update the hostnames in the files before applying.

### 4. Install Kuadrant Operator

**Option 1: Using OLM with Latest Features (recommended)**

Install the latest Kuadrant operator with TokenRateLimitPolicy support using OLM nightly builds:

```bash
# Install OLM if not already present
curl -L https://github.com/operator-framework/operator-lifecycle-manager/releases/download/v0.32.0/install.sh -o /tmp/olm-install.sh
bash /tmp/olm-install.sh v0.32.0

# Verify OLM installation
kubectl get crd | egrep 'operators.coreos.com|packages.operators.coreos.com' | wc -l
kubectl -n olm get pods

# Install Kuadrant operator with nightly catalog (includes latest features)
kubectl apply -k ./olm/install

# Verify CatalogSource is ready (must be READY)
kubectl -n kuadrant-system get catalogsource kuadrant-operator-catalog -o jsonpath='{.status.connectionState.lastObservedState}{"\n"}'
kubectl -n kuadrant-system get pods -l olm.catalogSource=kuadrant-operator-catalog

# Check subscriptions and CSVs created by the install overlay
kubectl -n kuadrant-system get subscription
kubectl -n kuadrant-system get csv
kubectl -n gateway-system get subscription  
kubectl -n gateway-system get csv

# Configure Kuadrant instance
kubectl apply -k ./olm/configure

# Watch operator-managed deployments settle
kubectl -n kuadrant-system get deploy
kubectl -n gateway-system get deploy

# CRITICAL: Fix OLM/Istio conflicts for proper operation
# The OLM installation includes Sail operator which conflicts with manual Istio installation
# Remove conflicting components to prevent gateway pod crashes and webhook failures

# 1. Reinstall Istio to fix webhook certificate trust issues
./istio-install.sh uninstall
./istio-install.sh apply

# 2. Completely remove Sail operator to prevent conflicting istiod deployments
kubectl -n gateway-system delete subscription sailoperator --ignore-not-found
kubectl -n gateway-system delete csv sailoperator.v0.1.0 --ignore-not-found
kubectl -n gateway-system delete deployment sail-operator --ignore-not-found
kubectl -n gateway-system delete deployment istiod --ignore-not-found

# 3. Clean up stale certificate configmaps that prevent proper trust chain
kubectl -n llm delete configmap istio-ca-root-cert --ignore-not-found

# 4. Reapply gateway configuration (was removed during Istio uninstall)
kubectl apply -f 02-gateway-configuration.yaml
kubectl apply -f 03-model-routing-domains.yaml

# 5. Clean up any leftover replica sets to prevent pod spawning issues
kubectl -n llm delete replicaset -l gateway.networking.k8s.io/gateway-name=inference-gateway --ignore-not-found
kubectl -n llm rollout restart deployment/inference-gateway-istio

# Verify Kuadrant CR readiness
kubectl get kuadrant kuadrant -n kuadrant-system \
  -o jsonpath='{.status.conditions[?(@.type=="Ready")].message}{"\n"}'

# Verify gateway pods connect to correct istiod (should be istio-system, not gateway-system)
kubectl -n llm logs deployment/inference-gateway-istio | grep "connected to"
```

> **⚠️ OLM Installation Critical Fix**: The OLM installation creates conflicting Istio deployments via the Sail operator. This causes:
> 1. **Webhook certificate validation failures** preventing EnvoyFilter/WasmPlugin creation
> 2. **Gateway pod crashes** due to connecting to wrong istiod
> 
> **Solution**: Remove Sail operator conflicts and ensure gateways connect to `istiod.istio-system.svc` not `istiod.gateway-system.svc`.

**Option 2: Using Helm (stable release)**

```bash
helm repo add kuadrant https://kuadrant.io/helm-charts
helm repo update

helm install kuadrant-operator kuadrant/kuadrant-operator \
  --create-namespace \
  --namespace kuadrant-system

# Wait for the operator to be ready
kubectl wait --for=condition=Available deployment/kuadrant-operator-controller-manager -n kuadrant-system --timeout=300s

# Create Kuadrant instance
kubectl apply -f 04-kuadrant-operator.yaml

# If the status does not become ready try kicking the operator:
kubectl rollout restart deployment kuadrant-operator-controller-manager -n kuadrant-system
```

### 5. Deploy AI Models with KServe

> Option 1 Deploy models using KServe InferenceServices on a GPU accelerator:
> There is an added example of how to set the runtime with kserve via `vllm-latest-runtime.yaml`

```bash
# Deploy the latest vLLM ServingRuntime with Qwen3 support
kubectl apply -f ../model_serving/vllm-latest-runtime.yaml

# Deploy the Qwen3-0.6B model (recommended for testing)
kubectl apply -f ../model_serving/qwen3-0.6b-vllm-raw.yaml

# Monitor InferenceService deployment status
kubectl get inferenceservice -n llm

# Watch model deployment (takes 5-10 minutes for model download)
kubectl describe inferenceservice qwen3-0-6b-instruct -n llm

# Check if pods are running (may take 5-15 minutes for model downloads)
kubectl get pods -n llm -l serving.kserve.io/inferenceservice

# Follow logs to see model loading progress
kubectl logs -n llm -l serving.kserve.io/inferenceservice -c kserve-container -f

# Wait for model to be ready
kubectl wait --for=condition=Ready inferenceservice qwen3-0-6b-instruct -n llm --timeout=900s
```

> Option 2 - If in a KIND environment or non-GPU use:

```shell
kubectl apply -f ../model_serving/vllm-simulator-kserve.yaml
```

### 6. Configure Authentication and Rate Limiting

Deploy API key secrets, auth policies, and rate limiting:

```bash
# Create API key secrets
kubectl apply -f 05-api-key-secrets.yaml

# Apply API key-based auth policies
kubectl apply -f 06-auth-policies-apikey.yaml

# Apply rate limiting policies
kubectl apply -f 07-rate-limit-policies.yaml

# Kick the kuadrant controller if you dont see a limitador-limitador deployment or no rate-limiting
kubectl rollout restart deployment kuadrant-operator-controller-manager -n kuadrant-system
```

### 7. Start Port Forwarding for Local Access

If running on kind/minikube, you need port forwarding to access the models:

```bash
# Port-forward to Kuadrant gateway (REQUIRED for authentication)
kubectl port-forward -n llm svc/inference-gateway-istio 8000:80 &
```

### 8. Test the MaaS API

Test all user tiers and rate limits with the automated script:

```bash
# Test simulator model (default)
./scripts/test-request-limits.sh

# Test qwen3 model when ready
./scripts/test-request-limits.sh --host qwen3.maas.local --model qwen3-0-6b-instruct
```

Example output showing rate limiting in action:

```bash
Host    : simulator.maas.local
Model ID: simulator-model

=== Free User (5 requests per 2min) ===
Free req #1  -> 200
Free req #2  -> 200
Free req #3  -> 200
Free req #4  -> 200
Free req #5  -> 200
Free req #6  -> 429
Free req #7  -> 429

=== Premium User 1 (20 requests per 2min) ===
Premium1 req #1  -> 200
Premium1 req #2  -> 200
...
Premium1 req #20 -> 200
Premium1 req #21 -> 429
Premium1 req #22 -> 429

=== Premium User 2 (20 requests per 2min) ===
Premium2 req #1  -> 200
...
Premium2 req #20 -> 200
Premium2 req #21 -> 429
Premium2 req #22 -> 429

=== Second Free User (5 requests per 2min) ===
Free2 req #1  -> 200
...
Free2 req #5  -> 200
Free2 req #6  -> 429
Free2 req #7  -> 429
```

Test individual models with manual curl commands:

**Simulator Model:**

```bash
# Single request test
curl -s -H 'Authorization: APIKEY freeuser1_key' \
     -H 'Content-Type: application/json' \
     -d '{"model":"simulator-model","messages":[{"role":"user","content":"Hello!"}]}' \
     http://simulator.maas.local:8000/v1/chat/completions

# Test rate limiting (Free tier: 5 requests per 2min)
for i in {1..7}; do
  printf "Free tier request #%-2s -> " "$i"
  curl -s -o /dev/null -w "%{http_code}\n" \
       -X POST http://simulator.maas.local:8000/v1/chat/completions \
       -H 'Authorization: APIKEY freeuser1_key' \
       -H 'Content-Type: application/json' \
       -d '{"model":"simulator-model","messages":[{"role":"user","content":"Test request"}],"max_tokens":10}'
done
```

**Qwen3 Model:**

```bash
# Single request test
curl -s -H 'Authorization: APIKEY premiumuser1_key' \
     -H 'Content-Type: application/json' \
     -d '{"model":"qwen3-0-6b-instruct","messages":[{"role":"user","content":"Hello!"}]}' \
     http://qwen3.maas.local:8000/v1/chat/completions

# Test rate limiting (Premium tier: 20 requests per 2min)
for i in {1..22}; do
  printf "Premium tier request #%-2s -> " "$i"
  curl -s -o /dev/null -w "%{http_code}\n" \
       -X POST http://qwen3.maas.local:8000/v1/chat/completions \
       -H 'Authorization: APIKEY premiumuser1_key' \
       -H 'Content-Type: application/json' \
       -d '{"model":"qwen3-0-6b-instruct","messages":[{"role":"user","content":"Test request"}],"max_tokens":10}'
done
```

**Available API Keys and Rate Limits:**

| Tier | API Keys | Rate Limits (per 2min) |
|------|----------|------------------------|
| **Free** | `freeuser1_key`, `freeuser2_key` | 5 requests |
| **Premium** | `premiumuser1_key`, `premiumuser2_key` | 20 requests |

- Expected Responses

- ✅ **200**: Request successful
- ❌ **429**: Rate limit exceeded (too many requests)
- ❌ **401**: Invalid/missing API key

### 9. Deploy Observability

Deploy Prometheus and monitoring components:

```bash
# Install Prometheus Operator
kubectl apply --server-side --field-manager=quickstart-installer -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/master/bundle.yaml

# Wait for Prometheus Operator to be ready
kubectl wait --for=condition=Available deployment/prometheus-operator -n default --timeout=300s

# From models-aas/deployment/kuadrant Kuadrant prometheus observability
kubectl apply -k kustomize/prometheus/

# Wait for Prometheus to be ready
kubectl wait --for=condition=Running prometheus/models-aas-observability -n llm-observability --timeout=300s

# Port-forward to access Prometheus UI
kubectl port-forward -n llm-observability svc/models-aas-observability 9090:9090 &

# Forward Limitador admin metric scrape target
kubectl -n kuadrant-system port-forward svc/limitador-limitador 8080:8080

# Access Prometheus at http://localhost:9090
```

### Query the Limitador Scrape Endpoint

> 🚨 See this issue for status on getting per user scrape data for authorization and limits with Kudrant [Question on mapping authorized_calls metrics to a user](https://github.com/Kuadrant/limitador/issues/434)

For now, you can scrape namespace wide limits:

```shell
$ curl -s http://localhost:8080/metrics | grep calls
# HELP authorized_calls Authorized calls
# TYPE authorized_calls counter
authorized_calls{limitador_namespace="llm/simulator-domain-route"} 100
# HELP limited_calls Limited calls
# TYPE limited_calls counter
limited_calls{limitador_namespace="llm/simulator-domain-route"} 16
```

### Query Metrics via Prom API

```bash
# Get limited_calls via Prometheus
curl -sG --data-urlencode 'query=limited_calls'     http://localhost:9090/api/v1/query | jq '.data.result'
[
  {
    "metric": {
      "__name__": "limited_calls",
      "container": "limitador",
      "endpoint": "http",
      "instance": "10.244.0.19:8080",
      "job": "limitador-limitador",
      "limitador_namespace": "llm/simulator-domain-route",
      "namespace": "kuadrant-system",
      "pod": "limitador-limitador-84bdfb4747-n8h44",
      "service": "limitador-limitador"
    },
    "value": [
      1754366303.129,
      "16"
    ]
  }
]

curl -sG --data-urlencode 'query=authorized_calls'     http://localhost:9090/api/v1/query | jq '.data.result'
[
  {
    "metric": {
      "__name__": "authorized_calls",
      "container": "limitador",
      "endpoint": "http",
      "instance": "10.244.0.19:8080",
      "job": "limitador-limitador",
      "limitador_namespace": "llm/simulator-domain-route",
      "namespace": "kuadrant-system",
      "pod": "limitador-limitador-84bdfb4747-n8h44",
      "service": "limitador-limitador"
    },
    "value": [
      1754366383.534,
      "100"
    ]
  }
]
```

## Troubleshooting

### View Logs

```bash
# Kuadrant operator logs
kubectl logs -n kuadrant-system deployment/kuadrant-operator-controller-manager

# Istio gateway logs
kubectl logs -n istio-system deployment/istio-ingressgateway

# Limitador logs
kubectl logs -n kuadrant-system deployment/limitador

# Authorino logs
kubectl logs -n kuadrant-system deployment/authorino
```

### Common Issues

- **502 Bad Gateway**: Check if model services are running and healthy
- **No Rate Limiting or Auth**: Kick the kuadrant-operator-controller-manager

## Customization

### Adjusting Rate Limits

Edit the RateLimitPolicy resources in `06-rate-limit-policies.yaml`:

```yaml
limits:
  "requests-per-minute":
    rates:
      - limit: 150  # Increase from 100
        duration: 1m
        unit: request
```

## Performance Tuning

### Gateway Scaling

```bash
# Scale Istio gateway
kubectl scale deployment/istio-ingressgateway -n istio-system --replicas=3

# Scale Kuadrant components
kubectl scale deployment/limitador -n kuadrant-system --replicas=3
kubectl scale deployment/authorino -n kuadrant-system --replicas=2
```

---

## Keycloak OIDC Authentication (Alternative to API Keys)

For production deployments, you can use Keycloak with OIDC JWT tokens instead of static API keys for dev. This provides user management, token expiration, and group-based access control.

This allows for provisioning users into groups dynamically without reconfiguring the MaaS service deployments.

### Deploy Keycloak with OIDC Authentication

```bash
# Deploy Keycloak and configure OIDC authentication
kubectl apply -k keycloak/

# Wait for Keycloak to be ready
kubectl wait --for=condition=Available deployment/keycloak -n keycloak-system --timeout=300s

# Wait for realm import job to complete
kubectl wait --for=condition=Complete job/keycloak-realm-import -n keycloak-system --timeout=300s

# Port-forward Keycloak for token management
kubectl port-forward -n keycloak-system svc/keycloak 8080:8080 &
```

### User Accounts and Tiers

The Keycloak realm has a few pre-configured users across the three tiers/groups for demoing:

| Tier           | Users                          | Rate Limit   | Password      |
|----------------|--------------------------------|--------------|---------------|
| **Free**       | `freeuser1`, `freeuser2`       | 5 req/2min   | `password123` |
| **Premium**    | `premiumuser1`, `premiumuser2` | 20 req/2min  | `password123` |
| **Enterprise** | `enterpriseuser1`              | 100 req/2min | `password123` |

### Get JWT Tokens

Use the provided script to get JWT tokens for testing:

```bash
# Get token for a free user
cd keycloak/
./get-token.sh freeuser1

# Get token for a premium user  
./get-token.sh premiumuser1

# Get token for an enterprise user
./get-token.sh enterpriseuser1
```

### Test OIDC Authentication

```bash
# Run the rate-limiting tests with OIDC auth and rate limiting tests
cd keycloak/
./test-oidc-auth.sh
```

Example output:
```bash
  Testing OIDC Authentication and Rate Limiting
  API Host: simulator.maas.local:8000
  Keycloak: localhost:8080

=== Testing Free User: freeuser1 (5 requests per 2min) ===
✅ Token acquired for freeuser1
freeuser1 req #1 -> 200 ✅
freeuser1 req #2 -> 200 ✅
freeuser1 req #3 -> 200 ✅
freeuser1 req #4 -> 200 ✅
freeuser1 req #5 -> 200 ✅
freeuser1 req #6 -> 429 ⚠️ (rate limited)
freeuser1 req #7 -> 429 ⚠️ (rate limited)
```

### Manual API Testing with JWT

```bash
# Get a token
TOKEN=$(./get-token.sh freeuser1 | grep -A1 "Access Token:" | tail -1)

# Test API call with JWT
curl -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"model":"simulator-model","messages":[{"role":"user","content":"Infer call with OIDC Auth!"}]}' \
     http://simulator.maas.local:8000/v1/chat/completions
```

### Keycloak Admin Access

Access the Keycloak admin console for user management:

```bash
# Port-forward Keycloak (if not already done)
kubectl port-forward -n keycloak-system svc/keycloak 8080:8080

# Access admin console at http://localhost:8080
# Username: admin
# Password: admin123
# Realm: maas
```

### Architecture Changes with OIDC

When using OIDC authentication:

1. **AuthPolicy** validates JWT tokens from Keycloak
2. **User identification** based on JWT `sub` claim
3. **Rate limiting** per user ID (not API key)
4. **User attributes** extracted from JWT claims (tier, groups, email)

### Switch Between Authentication Methods in the Demo ENV

```bash
# Use API keys (default)
kubectl apply -f 06-auth-policies-apikey.yaml
kubectl apply -f 07-rate-limit-policies.yaml

# Switch to OIDC
kubectl apply -f keycloak/05-auth-policy-oidc.yaml  
kubectl apply -f keycloak/06-rate-limit-policy-oidc.yaml

# Remove the API key policies
kubectl delete -f 06-auth-policies-apikey.yaml
kubectl delete -f 07-rate-limit-policies.yaml
```

---

## Custom WASM-Shim Image Replacement for Enhanced Token Logging

When using TokenRateLimitPolicy with OLM-deployed Kuadrant, you may want to replace the default wasm-shim image with a custom version that provides enhanced logging for debugging token rate limiting behavior.

### Problem
The OLM-managed Kuadrant operator uses a specific wasm-shim image defined in its ClusterServiceVersion (CSV). Manual changes to WasmPlugin resources are automatically reverted by the operator's reconciliation process.

### Solution
To persistently use a custom wasm-shim image, you need to update the operator's environment variable at the CSV level, which OLM uses to generate WasmPlugin configurations.

### Step-by-Step Process

1. **Update the OLM ClusterServiceVersion to use custom image**:
   ```bash
   # Replace the default wasm-shim image in the CSV
   kubectl -n kuadrant-system patch csv kuadrant-operator.v0.0.0 --type='json' \
     -p='[{"op": "replace", "path": "/spec/install/spec/deployments/0/spec/template/spec/containers/0/env/1/value", "value": "oci://ghcr.io/nerdalert/wasm-shim:latest"}]'
   ```

2. **Restart the operator to pick up the new environment variable**:
   ```bash
   kubectl -n kuadrant-system rollout restart deployment/kuadrant-operator-controller-manager
   kubectl -n kuadrant-system wait --for=condition=Available deployment/kuadrant-operator-controller-manager --timeout=60s
   ```

3. **Verify the operator environment variable was updated**:
   ```bash
   kubectl -n kuadrant-system get deployment kuadrant-operator-controller-manager \
     -o jsonpath='{.spec.template.spec.containers[0].env[1]}' | jq
   ```
   Expected output:
   ```json
   {
     "name": "RELATED_IMAGE_WASMSHIM",
     "value": "oci://ghcr.io/nerdalert/wasm-shim:latest"
   }
   ```

4. **Force reconciliation of TokenRateLimitPolicy to regenerate WasmPlugin**:
   ```bash
   # Add annotation to trigger operator reconciliation
   kubectl -n llm patch tokenratelimitpolicy gateway-token-rate-limits --type='json' \
     -p='[{"op": "add", "path": "/metadata/annotations/force-reconcile", "value": "force-reconcile"}]'
   ```

5. **Verify WasmPlugin was updated with custom image**:
   ```bash
   kubectl -n llm get wasmplugin kuadrant-inference-gateway -o yaml | grep -A 3 -B 3 "url:"
   ```
   Expected output:
   ```yaml
   url: oci://ghcr.io/nerdalert/wasm-shim:latest
   ```

6. **Confirm gateway pods are fetching the custom image**:
   ```bash
   kubectl -n llm logs deployment/inference-gateway-istio --since=2m | grep "fetching image.*nerdalert"
   ```
   Expected output:
   ```
   info	wasm	fetching image nerdalert/wasm-shim from registry ghcr.io with tag latest
   ```

### Monitoring Custom WASM-Shim Logs

Once the custom wasm-shim is loaded, you can monitor its enhanced logging:

```bash
# Monitor all wasm-related logs from the gateway
kubectl -n llm logs deployment/inference-gateway-istio -f | grep wasm

# Monitor token rate limiting logs specifically
kubectl -n llm logs deployment/inference-gateway-istio -f | grep -E "(token|rate|limit)"

# Watch for enhanced logging from custom wasm-shim
kubectl -n llm logs deployment/inference-gateway-istio -f | grep -E "(nerdalert|custom|enhanced)"

# Monitor wasm plugin configuration and rule processing
kubectl -n llm logs deployment/inference-gateway-istio -f | grep -E "(plugin|config|rule)"

# Watch for rate limiting decisions and token consumption
kubectl -n llm logs deployment/inference-gateway-istio -f | grep -E "(OVER_LIMIT|allowed|denied|consumed)"
```

### Real-time Testing and Log Monitoring

To see the custom wasm-shim in action, run this in one terminal to monitor logs:

```bash
# Terminal 1: Monitor enhanced logs
kubectl -n llm logs deployment/inference-gateway-istio -f | grep -E "(wasm|token|rate|limit|nerdalert)"
```

Then in another terminal, generate test requests:

```bash
# Terminal 2: Generate test requests to trigger token rate limiting
for i in {1..10}; do
  echo "Request #$i:"
  curl -s -w "HTTP Status: %{http_code}\n" \
    -H 'Authorization: APIKEY freeuser1_key' \
    -H 'Content-Type: application/json' \
    -d '{"model":"simulator-model","messages":[{"role":"user","content":"Test request #'$i'"}],"max_tokens":5}' \
    http://simulator.maas.local:8000/v1/chat/completions
  echo "---"
  sleep 2
done
```

### ⚠️ Important Compatibility Note

**Custom wasm-shim images must support TokenRateLimitPolicy features**. If you encounter errors like:

```
wasm log: failed to parse plugin config: unknown variant `ratelimit-report`, expected one of `auth`, `ratelimit`, `ratelimit-check`
```

This indicates the custom image doesn't support token rate limiting. You must either:
- Use a newer version of the custom image that supports `ratelimit-report`
- Revert to the default image for token rate limiting functionality

### Restoring Default Image

If token rate limiting stops working with the custom image:

1. **Revert the CSV to use default image**:
   ```bash
   kubectl -n kuadrant-system patch csv kuadrant-operator.v0.0.0 --type='json' \
     -p='[{"op": "replace", "path": "/spec/install/spec/deployments/0/spec/template/spec/containers/0/env/1/value", "value": "oci://quay.io/kuadrant/wasm-shim:latest"}]'
   ```

2. **Restart operator and force reconciliation**:
   ```bash
   kubectl -n kuadrant-system rollout restart deployment/kuadrant-operator-controller-manager
   kubectl -n kuadrant-system wait --for=condition=Available deployment/kuadrant-operator-controller-manager --timeout=60s
   
   # Force WasmPlugin regeneration
   kubectl -n llm patch tokenratelimitpolicy gateway-token-rate-limits --type='json' \
     -p='[{"op": "replace", "path": "/metadata/annotations/force-reconcile", "value": "restore-default"}]'
   ```

3. **If WasmPlugin doesn't update, force deletion to regenerate**:
   ```bash
   kubectl -n llm delete wasmplugin kuadrant-inference-gateway
   # The operator will recreate it automatically
   ```

### Verification Commands

```bash
# Check current wasm-shim image being used
kubectl -n llm get wasmplugin kuadrant-inference-gateway -o jsonpath='{.spec.url}'

# Monitor gateway logs for image fetching
kubectl -n llm logs deployment/inference-gateway-istio -f | grep "fetching image"

# Verify operator environment variable
kubectl -n kuadrant-system get deployment kuadrant-operator-controller-manager \
  -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="RELATED_IMAGE_WASMSHIM")].value}'

# Check for wasm parsing errors (indicates compatibility issues)
kubectl -n llm logs deployment/inference-gateway-istio --since=5m | grep -E "(failed to parse|unknown variant)"

# Test token rate limiting functionality
for i in {1..5}; do
  curl -s -o /dev/null -w "Request #$i -> %{http_code}\n" \
    -H 'Authorization: APIKEY freeuser1_key' \
    -H 'Content-Type: application/json' \
    -d '{"model":"simulator-model","messages":[{"role":"user","content":"Test"}],"max_tokens":1}' \
    http://simulator.maas.local:8000/v1/chat/completions
done
```

### Why This Works
- **OLM Management**: The CSV is the source of truth for OLM-managed operators
- **Environment Variable**: `RELATED_IMAGE_WASMSHIM` controls which image the operator uses for WasmPlugin generation
- **Persistent**: Changes to the CSV persist across operator restarts and reconciliations
- **Automatic Propagation**: The operator automatically regenerates WasmPlugin resources when TokenRateLimitPolicy changes are detected

### Custom WASM-Shim Benefits
Using a compatible custom wasm-shim image (like `ghcr.io/nerdalert/wasm-shim:latest`) provides:
- Enhanced token tracking logs
- Detailed rate limiting decision logging
- Custom metrics and debugging information
- Better visibility into token consumption patterns
- Real-time monitoring of rate limit enforcement

### Troubleshooting
If the custom image isn't working:
1. **Verify CSV was updated**: Check the operator environment variable
2. **Ensure operator restarted successfully**: Check deployment status
3. **Check TokenRateLimitPolicy reconciliation**: Verify the annotation was added
4. **Monitor for compatibility errors**: Look for "unknown variant" errors in gateway logs
5. **Test functionality**: Verify token rate limiting is working as expected
6. **Monitor enhanced logs**: Use the logging commands above to see custom wasm-shim output
7. **Revert if needed**: Use default image if compatibility issues persist
