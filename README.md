# Clicity Backend

Backend serverless para el chat IA de Clicity.

- **Motor principal:** Gemini 2.5 Flash (gratuito — ~1.500 req/día sin tarjeta)
- **Respaldo:** Claude Sonnet (de pago, solo si Gemini falla o no sabe responder)
- **Hosting:** Vercel (plan gratuito suficiente para el demo)

## Endpoint

```
POST /api/chat
Content-Type: application/json

{
  "system": "string — instrucciones del agente",
  "messages": [{ "role": "user|assistant", "content": "string" }]
}
```

Respuesta:
```json
{ "text": "respuesta del agente", "motor": "gemini | claude" }
```

## Despliegue en Vercel (5 minutos)

### 1. Sube este repo a GitHub
```bash
git init
git add .
git commit -m "clicity backend"
gh repo create clicity-backend --public --push
```

### 2. Conecta en Vercel
- Ve a https://vercel.com/new
- Importa el repo `clicity-backend`
- En **Environment Variables** agrega:
  - `GEMINI_API_KEY` → tu key de Google AI Studio
  - `ANTHROPIC_API_KEY` → tu key de Anthropic
- Click en **Deploy**

### 3. Obtén tu URL
Vercel te da una URL tipo:
```
https://clicity-backend-xxx.vercel.app
```

### 4. Actualiza el frontend
En `clicity.html` busca la línea:
```js
const BACKEND_URL = "https://TU-BACKEND.vercel.app";
```
Y reemplaza con tu URL real.

## Consigue las API keys

**Gemini (gratis):**
1. Ve a https://aistudio.google.com/app/apikey
2. Click "Create API key"
3. Copia y pega en Vercel como `GEMINI_API_KEY`

**Anthropic (respaldo de pago):**
1. Ve a https://console.anthropic.com/
2. Settings → API Keys → Create Key
3. Copia y pega en Vercel como `ANTHROPIC_API_KEY`

## Lógica de fallback

```
Usuario → Frontend (clicity.html)
             ↓
        Backend (/api/chat)
             ↓
     [1] Gemini 2.5 Flash (gratis)
          ↓ si OK → responde
          ↓ si falla (cuota, error, incertidumbre)
     [2] Claude Sonnet (pago)
          ↓ → responde
```
