# SAP AI Core — Practical Integration Guide

A complete, battle-tested guide for integrating SAP AI Core's Generative AI Hub into any application. Based on real production implementation — every code snippet here has been tested against live SAP AI Core deployments.

---

## Table of Contents

1. [What You Need Before Starting](#1-what-you-need-before-starting)
2. [Authentication — OAuth 2.0](#2-authentication--oauth-20)
3. [Discovering Your Deployed Models](#3-discovering-your-deployed-models)
4. [The Three API Patterns](#4-the-three-api-patterns)
5. [Azure OpenAI Models (GPT)](#5-azure-openai-models-gpt)
6. [AWS Bedrock Models (Claude, Llama, Mistral)](#6-aws-bedrock-models-claude-llama-mistral)
7. [Google Vertex AI Models (Gemini)](#7-google-vertex-ai-models-gemini)
8. [Complete Python Integration](#8-complete-python-integration)
9. [Complete Node.js Integration](#9-complete-nodejs-integration)
10. [Error Handling & Troubleshooting](#10-error-handling--troubleshooting)
11. [Tips & Gotchas](#11-tips--gotchas)

---

## 1. What You Need Before Starting

### From SAP BTP Cockpit

You need a **Service Key** from your SAP AI Core instance. It's a JSON block containing:

```json
{
  "clientid": "sb-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx!bXXXX",
  "clientsecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "url": "https://your-subdomain.authentication.eu10.hana.ondemand.com",
  "serviceurls": {
    "AI_API_URL": "https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com"
  }
}
```

**Extract these 4 values:**

| Field | What It Is | Example |
|-------|-----------|---------|
| `clientid` | OAuth client ID | `sb-abc123...` |
| `clientsecret` | OAuth client secret | `xK9mP2...` |
| `url` | UAA auth server URL | `https://xxx.authentication.eu10.hana.ondemand.com` |
| `serviceurls.AI_API_URL` | AI Core API base URL | `https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com` |

### Deployed Models

Each model you want to use must be **deployed** in SAP AI Launchpad. Each deployment gives you a **deployment ID** (e.g., `de30d0f94e5070da`).

**Important:** The deployment ID tells SAP AI Core WHICH model to route to. The underlying provider (Azure OpenAI, AWS Bedrock, Google Vertex) determines HOW to call it.

---

## 2. Authentication — OAuth 2.0

Every API call requires a bearer token. Get it via OAuth 2.0 Client Credentials flow.

### Python

```python
import requests
import base64
import time

class SAPAICoreAuth:
    def __init__(self, client_id: str, client_secret: str, auth_url: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.auth_url = auth_url.rstrip('/')
        self._token = None
        self._token_expiry = 0

    def get_token(self) -> str:
        """Get a valid bearer token, refreshing if expired."""
        if self._token and time.time() < self._token_expiry - 60:
            return self._token

        basic = base64.b64encode(
            f"{self.client_id}:{self.client_secret}".encode()
        ).decode()

        resp = requests.post(
            f"{self.auth_url}/oauth/token",
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': f'Basic {basic}',
            },
            data='grant_type=client_credentials',
            timeout=15,
        )
        resp.raise_for_status()

        data = resp.json()
        self._token = data['access_token']
        self._token_expiry = time.time() + int(data.get('expires_in', 3600))
        return self._token
```

### Node.js

```javascript
const fetch = require('node-fetch');

let cachedToken = null;
let tokenExpiry = 0;

async function getToken(clientId, clientSecret, authUrl) {
  if (cachedToken && Date.now() / 1000 < tokenExpiry - 60) {
    return cachedToken;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const resp = await fetch(`${authUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basic}`,
    },
    body: 'grant_type=client_credentials',
  });

  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() / 1000 + (data.expires_in || 3600);
  return cachedToken;
}
```

### Common Headers for All API Calls

```
Authorization: Bearer {token}
AI-Resource-Group: default
Content-Type: application/json
```

> **Note:** `AI-Resource-Group` is usually `default` unless you've created custom resource groups.

---

## 3. Discovering Your Deployed Models

List all running deployments to find model names and deployment IDs:

```
GET {AI_API_URL}/v2/lm/deployments?status=RUNNING
```

### Python

```python
def discover_models(api_url: str, token: str, resource_group: str = 'default'):
    """List all running deployments and extract model info."""
    headers = {
        'Authorization': f'Bearer {token}',
        'AI-Resource-Group': resource_group,
    }

    resp = requests.get(
        f"{api_url}/v2/lm/deployments",
        headers=headers,
        params={'status': 'RUNNING'},
        timeout=15,
    )
    resp.raise_for_status()

    models = []
    for d in resp.json().get('resources', []):
        deploy_id = d.get('id', '')
        scenario = d.get('scenarioId', '')
        details = d.get('details', {})

        # Extract model name from deployment details
        model_name = (
            details.get('resources', {})
            .get('backend_details', {})
            .get('model', {})
            .get('name', '')
        )
        if not model_name:
            model_name = (
                details.get('scaling', {})
                .get('backend_details', {})
                .get('model', {})
                .get('name', '')
            )

        if not model_name or 'embed' in model_name:
            continue  # Skip embeddings

        # Determine backend type from scenario
        if 'azure' in scenario or 'openai' in scenario:
            backend = 'openai'
        elif 'aws' in scenario or 'bedrock' in scenario:
            backend = 'bedrock'
        elif 'gcp' in scenario or 'vertex' in scenario:
            backend = 'vertex'
        else:
            # Guess from model name
            lower = model_name.lower()
            if any(p in lower for p in ('claude', 'anthropic', 'titan', 'llama', 'mistral')):
                backend = 'bedrock'
            elif 'gemini' in lower:
                backend = 'vertex'
            else:
                backend = 'openai'

        models.append({
            'model_name': model_name,
            'deployment_id': deploy_id,
            'backend': backend,
            'scenario': scenario,
        })

    return models
```

### Example Output

```python
[
    {'model_name': 'gpt-4o', 'deployment_id': 'abc123...', 'backend': 'openai', 'scenario': 'azure-openai'},
    {'model_name': 'anthropic--claude-3.5-sonnet', 'deployment_id': 'def456...', 'backend': 'bedrock', 'scenario': 'aws-bedrock'},
    {'model_name': 'gemini-1.5-pro', 'deployment_id': 'ghi789...', 'backend': 'vertex', 'scenario': 'gcp-vertexai'},
]
```

---

## 4. The Three API Patterns

**This is the most critical thing to understand.** SAP AI Core proxies to different cloud providers, and each provider has its own API format:

| Backend | Provider | Endpoint Subpath | Payload Format | Response Format |
|---------|----------|-----------------|----------------|-----------------|
| `openai` | Azure OpenAI | `/chat/completions` | OpenAI messages | `choices[0].message.content` |
| `bedrock` | AWS Bedrock | `/converse` | Bedrock Converse | `output.message.content[0].text` |
| `vertex` | Google Vertex AI | `/models/{model}:generateContent` | Vertex AI | `candidates[0].content.parts[0].text` |

**Base URL pattern:**
```
{AI_API_URL}/v2/inference/deployments/{deployment_id}/{subpath}
```

---

## 5. Azure OpenAI Models (GPT)

### Endpoint
```
POST {AI_API_URL}/v2/inference/deployments/{deployment_id}/chat/completions
```

### Request

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is SAP BTP?"}
  ],
  "max_tokens": 2000,
  "temperature": 0.7
}
```

### Response

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "SAP BTP is..."
      }
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 150,
    "total_tokens": 175
  }
}
```

### Python Code

```python
def call_openai(api_url, deployment_id, token, messages, resource_group='default',
                max_tokens=2000, temperature=0.7):
    """Call Azure OpenAI model via SAP AI Core."""
    url = f"{api_url}/v2/inference/deployments/{deployment_id}/chat/completions"

    resp = requests.post(url, json={
        'messages': messages,
        'max_tokens': max_tokens,
        'temperature': temperature,
    }, headers={
        'Authorization': f'Bearer {token}',
        'AI-Resource-Group': resource_group,
        'Content-Type': 'application/json',
    }, timeout=60)

    resp.raise_for_status()
    data = resp.json()
    return data['choices'][0]['message']['content']
```

### Models Typically Available
- `gpt-4o`, `gpt-4o-mini`, `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`

---

## 6. AWS Bedrock Models (Claude, Llama, Mistral)

### Endpoint
```
POST {AI_API_URL}/v2/inference/deployments/{deployment_id}/converse
```

### Request

```json
{
  "messages": [
    {
      "role": "user",
      "content": [{"text": "What is SAP BTP?"}]
    }
  ],
  "system": [{"text": "You are a helpful assistant."}],
  "inferenceConfig": {
    "maxTokens": 2000,
    "temperature": 0.7
  }
}
```

**Key differences from OpenAI:**
- `content` is an array of `{"text": "..."}` objects, not a plain string
- `system` is a separate top-level array, NOT a message with `role: "system"`
- Parameters use `inferenceConfig` with camelCase (`maxTokens`, not `max_tokens`)

### Response

```json
{
  "output": {
    "message": {
      "role": "assistant",
      "content": [{"text": "SAP BTP is..."}]
    }
  },
  "usage": {
    "inputTokens": 25,
    "outputTokens": 150,
    "totalTokens": 175
  }
}
```

### Python Code

```python
def call_bedrock(api_url, deployment_id, token, system_prompt, user_message,
                 resource_group='default', max_tokens=2000, temperature=0.7):
    """Call AWS Bedrock model (Claude, Llama, etc.) via SAP AI Core."""
    url = f"{api_url}/v2/inference/deployments/{deployment_id}/converse"

    payload = {
        'messages': [
            {'role': 'user', 'content': [{'text': user_message}]}
        ],
        'inferenceConfig': {
            'maxTokens': max_tokens,
            'temperature': temperature,
        }
    }
    if system_prompt:
        payload['system'] = [{'text': system_prompt}]

    resp = requests.post(url, json=payload, headers={
        'Authorization': f'Bearer {token}',
        'AI-Resource-Group': resource_group,
        'Content-Type': 'application/json',
    }, timeout=60)

    resp.raise_for_status()
    data = resp.json()

    # Extract text from content blocks
    blocks = data.get('output', {}).get('message', {}).get('content', [])
    return ''.join(b.get('text', '') for b in blocks)
```

### Multi-turn Conversation

```python
messages = [
    {'role': 'user', 'content': [{'text': 'Hello!'}]},
    {'role': 'assistant', 'content': [{'text': 'Hi there! How can I help?'}]},
    {'role': 'user', 'content': [{'text': 'Tell me about SAP BTP.'}]},
]

payload = {
    'messages': messages,
    'system': [{'text': 'You are a helpful SAP consultant.'}],
    'inferenceConfig': {'maxTokens': 2000, 'temperature': 0.7},
}
```

### Models Typically Available
- `anthropic--claude-3.5-sonnet`, `anthropic--claude-3-opus`, `anthropic--claude-3-haiku`
- `meta.llama3-70b-instruct`, `meta.llama3-8b-instruct`
- `mistral.mistral-large`, `mistral.mixtral-8x7b`
- `amazon.titan-text-premier`

> **Note:** Model names on SAP AI Core often have provider prefixes like `anthropic--` or `meta.`. Use the full name as returned by the deployment discovery.

---

## 7. Google Vertex AI Models (Gemini)

### Endpoint
```
POST {AI_API_URL}/v2/inference/deployments/{deployment_id}/models/{model_name}:generateContent
```

> **Important:** Unlike OpenAI/Bedrock, the model name is part of the URL path.

### Request

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{"text": "What is SAP BTP?"}]
    }
  ],
  "generationConfig": {
    "maxOutputTokens": 2000,
    "temperature": 0.7
  }
}
```

**Key differences:**
- Uses `contents` (not `messages`)
- Each message has `parts` array with `{"text": "..."}`
- Roles are `user` and `model` (not `assistant`)
- No separate system message — prepend to first user message or use `systemInstruction`
- Parameters in `generationConfig` with `maxOutputTokens`

### Response

```json
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [{"text": "SAP BTP is..."}]
      }
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 25,
    "candidatesTokenCount": 150,
    "totalTokenCount": 175
  }
}
```

### Python Code

```python
def call_vertex(api_url, deployment_id, model_name, token, system_prompt, user_message,
                resource_group='default', max_tokens=2000, temperature=0.7):
    """Call Google Vertex AI model (Gemini) via SAP AI Core."""
    url = f"{api_url}/v2/inference/deployments/{deployment_id}/models/{model_name}:generateContent"

    # Vertex doesn't have a separate system role — prepend to user message
    full_message = f"{system_prompt}\n\n{user_message}" if system_prompt else user_message

    payload = {
        'contents': [
            {'role': 'user', 'parts': [{'text': full_message}]}
        ],
        'generationConfig': {
            'maxOutputTokens': max_tokens,
            'temperature': temperature,
        }
    }

    resp = requests.post(url, json=payload, headers={
        'Authorization': f'Bearer {token}',
        'AI-Resource-Group': resource_group,
        'Content-Type': 'application/json',
    }, timeout=60)

    resp.raise_for_status()
    data = resp.json()

    candidates = data.get('candidates', [])
    if candidates:
        parts = candidates[0].get('content', {}).get('parts', [])
        return ''.join(p.get('text', '') for p in parts)
    return ''
```

### Multi-turn Conversation

```python
contents = [
    {'role': 'user', 'parts': [{'text': 'Hello!'}]},
    {'role': 'model', 'parts': [{'text': 'Hi there!'}]},
    {'role': 'user', 'parts': [{'text': 'Tell me about SAP.'}]},
]
```

### Models Typically Available
- `gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-1.0-pro`

---

## 8. Complete Python Integration

A unified class that handles all three backends:

```python
import requests
import base64
import time
import json


class SAPAICore:
    """Unified SAP AI Core client for all model backends."""

    def __init__(self, service_key_json: str, resource_group: str = 'default'):
        """
        Args:
            service_key_json: The full SAP AI Core service key JSON string.
            resource_group: AI Core resource group (default: 'default').
        """
        svc = json.loads(service_key_json) if isinstance(service_key_json, str) else service_key_json
        self.client_id = svc['clientid']
        self.client_secret = svc['clientsecret']
        self.auth_url = svc['url'].rstrip('/')
        self.api_url = svc['serviceurls']['AI_API_URL'].rstrip('/')
        self.resource_group = resource_group
        self._token = None
        self._token_expiry = 0

    def _get_token(self) -> str:
        if self._token and time.time() < self._token_expiry - 60:
            return self._token
        basic = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()
        resp = requests.post(
            f"{self.auth_url}/oauth/token",
            headers={'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': f'Basic {basic}'},
            data='grant_type=client_credentials', timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        self._token = data['access_token']
        self._token_expiry = time.time() + data.get('expires_in', 3600)
        return self._token

    def _headers(self) -> dict:
        return {
            'Authorization': f'Bearer {self._get_token()}',
            'AI-Resource-Group': self.resource_group,
            'Content-Type': 'application/json',
        }

    def _base_url(self, deployment_id: str) -> str:
        return f"{self.api_url}/v2/inference/deployments/{deployment_id}"

    def discover_models(self) -> list[dict]:
        """List all running model deployments."""
        resp = requests.get(
            f"{self.api_url}/v2/lm/deployments",
            headers=self._headers(),
            params={'status': 'RUNNING'},
            timeout=15,
        )
        resp.raise_for_status()
        models = []
        for d in resp.json().get('resources', []):
            deploy_id = d.get('id', '')
            scenario = (d.get('scenarioId', '') or '').lower()
            details = d.get('details', {})
            name = (details.get('resources', {}).get('backend_details', {}).get('model', {}).get('name', '')
                    or details.get('scaling', {}).get('backend_details', {}).get('model', {}).get('name', ''))
            if not name or 'embed' in name or 'rerank' in name:
                continue

            if 'azure' in scenario or 'openai' in scenario:
                backend = 'openai'
            elif 'aws' in scenario or 'bedrock' in scenario:
                backend = 'bedrock'
            elif 'gcp' in scenario or 'vertex' in scenario:
                backend = 'vertex'
            else:
                lower = name.lower()
                backend = ('bedrock' if any(p in lower for p in ('claude', 'anthropic', 'titan', 'llama', 'mistral'))
                           else 'vertex' if 'gemini' in lower else 'openai')

            models.append({'name': name, 'deployment_id': deploy_id, 'backend': backend, 'scenario': scenario})
        return models

    def chat(self, deployment_id: str, backend: str, system_prompt: str,
             user_message: str, model_name: str = '', max_tokens: int = 2000,
             temperature: float = 0.7) -> str:
        """
        Send a chat message. Automatically routes to the correct API format.

        Args:
            deployment_id: The deployment ID from SAP AI Launchpad.
            backend: 'openai', 'bedrock', or 'vertex'.
            system_prompt: System instructions.
            user_message: The user's message.
            model_name: Required for Vertex AI (model name in URL).
            max_tokens: Maximum response tokens.
            temperature: Creativity (0.0-1.0).

        Returns:
            The assistant's response text.
        """
        base = self._base_url(deployment_id)
        headers = self._headers()

        if backend == 'openai':
            url = f"{base}/chat/completions"
            payload = {
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_message},
                ],
                'max_tokens': max_tokens,
                'temperature': temperature,
            }
        elif backend == 'bedrock':
            url = f"{base}/converse"
            payload = {
                'messages': [{'role': 'user', 'content': [{'text': user_message}]}],
                'system': [{'text': system_prompt}],
                'inferenceConfig': {'maxTokens': max_tokens, 'temperature': temperature},
            }
        elif backend == 'vertex':
            if not model_name:
                raise ValueError("model_name is required for Vertex AI backend")
            url = f"{base}/models/{model_name}:generateContent"
            prompt = f"{system_prompt}\n\n{user_message}" if system_prompt else user_message
            payload = {
                'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
                'generationConfig': {'maxOutputTokens': max_tokens, 'temperature': temperature},
            }
        else:
            raise ValueError(f"Unknown backend: {backend}")

        resp = requests.post(url, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()

        # Parse response based on backend
        if backend == 'openai':
            return data['choices'][0]['message']['content']
        elif backend == 'bedrock':
            blocks = data.get('output', {}).get('message', {}).get('content', [])
            return ''.join(b.get('text', '') for b in blocks)
        elif backend == 'vertex':
            candidates = data.get('candidates', [])
            if candidates:
                return ''.join(p.get('text', '') for p in candidates[0].get('content', {}).get('parts', []))
            return ''


# ============================================================
# Usage Example
# ============================================================

if __name__ == '__main__':
    SERVICE_KEY = '''{ paste your service key JSON here }'''

    client = SAPAICore(SERVICE_KEY)

    # 1. Discover available models
    models = client.discover_models()
    print("Available models:")
    for m in models:
        print(f"  {m['name']} ({m['backend']}) — deploy: {m['deployment_id']}")

    # 2. Call a model
    if models:
        m = models[0]
        response = client.chat(
            deployment_id=m['deployment_id'],
            backend=m['backend'],
            model_name=m['name'],
            system_prompt="You are a helpful assistant.",
            user_message="What is SAP BTP in 2 sentences?",
        )
        print(f"\nResponse from {m['name']}:")
        print(response)
```

---

## 9. Complete Node.js Integration

```javascript
const fetch = require('node-fetch');

class SAPAICore {
  constructor(serviceKeyJson, resourceGroup = 'default') {
    const svc = typeof serviceKeyJson === 'string' ? JSON.parse(serviceKeyJson) : serviceKeyJson;
    this.clientId = svc.clientid;
    this.clientSecret = svc.clientsecret;
    this.authUrl = svc.url.replace(/\/$/, '');
    this.apiUrl = svc.serviceurls.AI_API_URL.replace(/\/$/, '');
    this.resourceGroup = resourceGroup;
    this._token = null;
    this._tokenExpiry = 0;
  }

  async getToken() {
    if (this._token && Date.now() / 1000 < this._tokenExpiry - 60) return this._token;
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const resp = await fetch(`${this.authUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
      body: 'grant_type=client_credentials',
    });
    const data = await resp.json();
    this._token = data.access_token;
    this._tokenExpiry = Date.now() / 1000 + (data.expires_in || 3600);
    return this._token;
  }

  async headers() {
    return {
      Authorization: `Bearer ${await this.getToken()}`,
      'AI-Resource-Group': this.resourceGroup,
      'Content-Type': 'application/json',
    };
  }

  async discoverModels() {
    const resp = await fetch(`${this.apiUrl}/v2/lm/deployments?status=RUNNING`, { headers: await this.headers() });
    const data = await resp.json();
    return (data.resources || []).map(d => {
      const name = d.details?.resources?.backend_details?.model?.name
                || d.details?.scaling?.backend_details?.model?.name || '';
      const scenario = (d.scenarioId || '').toLowerCase();
      let backend = 'openai';
      if (scenario.includes('bedrock') || scenario.includes('aws')) backend = 'bedrock';
      else if (scenario.includes('vertex') || scenario.includes('gcp')) backend = 'vertex';
      else if (/claude|anthropic|llama|mistral|titan/.test(name.toLowerCase())) backend = 'bedrock';
      else if (/gemini/.test(name.toLowerCase())) backend = 'vertex';
      return { name, deploymentId: d.id, backend, scenario };
    }).filter(m => m.name && !m.name.includes('embed'));
  }

  async chat(deploymentId, backend, systemPrompt, userMessage, modelName = '', maxTokens = 2000, temperature = 0.7) {
    const base = `${this.apiUrl}/v2/inference/deployments/${deploymentId}`;
    let url, payload;

    if (backend === 'openai') {
      url = `${base}/chat/completions`;
      payload = {
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
        max_tokens: maxTokens, temperature,
      };
    } else if (backend === 'bedrock') {
      url = `${base}/converse`;
      payload = {
        messages: [{ role: 'user', content: [{ text: userMessage }] }],
        system: [{ text: systemPrompt }],
        inferenceConfig: { maxTokens, temperature },
      };
    } else if (backend === 'vertex') {
      url = `${base}/models/${modelName}:generateContent`;
      payload = {
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      };
    }

    const resp = await fetch(url, { method: 'POST', headers: await this.headers(), body: JSON.stringify(payload) });
    const data = await resp.json();

    if (backend === 'openai') return data.choices?.[0]?.message?.content || '';
    if (backend === 'bedrock') return (data.output?.message?.content || []).map(b => b.text).join('');
    if (backend === 'vertex') return (data.candidates?.[0]?.content?.parts || []).map(p => p.text).join('');
    return '';
  }
}

// Usage
(async () => {
  const client = new SAPAICore(process.env.SAP_SERVICE_KEY);

  const models = await client.discoverModels();
  console.log('Models:', models.map(m => `${m.name} (${m.backend})`));

  if (models.length) {
    const m = models[0];
    const reply = await client.chat(m.deploymentId, m.backend, 'You are helpful.', 'What is SAP?', m.name);
    console.log('Reply:', reply);
  }
})();
```

---

## 10. Error Handling & Troubleshooting

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Token expired or bad credentials | Regenerate service key |
| `400 "Subpath 'completion' is not allowed"` | Wrong endpoint for model type | Check backend: use `/converse` for Bedrock, `/chat/completions` for OpenAI |
| `400 "Subpath 'chat/completions' is not allowed"` | Calling OpenAI endpoint on Bedrock/Vertex model | Match endpoint to backend type |
| `404 "The model completions does not exist"` | Vertex AI model with wrong path | Use `/models/{name}:generateContent` for Vertex |
| `404 "Deployment not found"` | Wrong deployment ID or deployment stopped | Check AI Launchpad → Deployments |
| `429 Too Many Requests` | Rate limit | Reduce frequency or upgrade plan |
| `403 Forbidden` | Wrong resource group | Use `default` or check your resource group config |

### Robust Error Handling

```python
def safe_chat(client, deployment_id, backend, system, message, model_name=''):
    try:
        return client.chat(deployment_id, backend, system, message, model_name)
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code
        body = e.response.text[:500]
        if status == 401:
            print("Auth failed — regenerate service key")
        elif status == 400 and 'Subpath' in body:
            print(f"Wrong endpoint for this model. Backend={backend}, Error: {body}")
        elif status == 429:
            print("Rate limited — retry after delay")
        else:
            print(f"HTTP {status}: {body}")
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None
```

---

## 11. Tips & Gotchas

### 1. Model Name Prefixes
SAP AI Core often prefixes model names with the provider:
- `anthropic--claude-3.5-sonnet` (not just `claude-3.5-sonnet`)
- `meta.llama3-70b-instruct`
- GPT models usually don't have a prefix: `gpt-4o`

**Always use the exact name returned by the deployment discovery API.**

### 2. Bedrock Content Format
The biggest mistake developers make: Bedrock expects `content: [{"text": "..."}]` (array of text blocks), NOT `content: "..."` (plain string). This will give you a 400 error that's hard to debug.

### 3. Vertex System Messages
Vertex AI doesn't support a separate `system` role in messages. Options:
- Prepend system prompt to the first user message
- Use `systemInstruction` field (newer Gemini versions)

### 4. Token Caching
Always cache your OAuth token. It's valid for ~12 hours. Making a new token request for every API call will slow you down and may hit rate limits.

### 5. Deployment IDs Are Stable
Once a model is deployed, the deployment ID doesn't change unless you delete and recreate it. Store them in your config.

### 6. Resource Groups
Most setups use `default`. If you have multiple teams, each can have their own resource group. Always include `AI-Resource-Group` header.

### 7. Timeout
LLM calls can take 10-60 seconds depending on the model and prompt size. Set your HTTP timeout to at least 60 seconds.

### 8. Streaming
SAP AI Core proxy does NOT support server-sent events (SSE) streaming for Bedrock/Vertex. Only Azure OpenAI deployments may support streaming. For a chat-like UX, simulate streaming by chunking the response on the client side.

### 9. JSON Mode
Azure OpenAI models support `response_format: { type: "json_object" }` in the payload. Bedrock and Vertex don't — you must instruct the model via the prompt to return JSON.

### 10. Cost & Quotas
- SAP AI Core charges per token based on your service plan
- Each deployment has its own quota
- Monitor usage in SAP AI Launchpad → Usage & Monitoring

---

## Quick Reference Card

```
Authentication:
  POST {auth_url}/oauth/token
  Authorization: Basic {base64(clientid:clientsecret)}
  Body: grant_type=client_credentials

Discovery:
  GET {api_url}/v2/lm/deployments?status=RUNNING
  → resources[].id = deployment_id
  → resources[].details.resources.backend_details.model.name = model_name
  → resources[].scenarioId → determines backend type

Azure OpenAI (GPT):
  POST {api_url}/v2/inference/deployments/{id}/chat/completions
  Body: { messages: [{role, content}], max_tokens, temperature }
  Response: choices[0].message.content

AWS Bedrock (Claude, Llama):
  POST {api_url}/v2/inference/deployments/{id}/converse
  Body: { messages: [{role, content: [{text}]}], system: [{text}], inferenceConfig: {maxTokens} }
  Response: output.message.content[0].text

Google Vertex (Gemini):
  POST {api_url}/v2/inference/deployments/{id}/models/{model}:generateContent
  Body: { contents: [{role, parts: [{text}]}], generationConfig: {maxOutputTokens} }
  Response: candidates[0].content.parts[0].text
```

---

*This guide is based on production implementation with SAP AI Core. For service plans, regional availability, and quotas, see [SAP AI Core Documentation](https://help.sap.com/docs/sap-ai-core).*
