// api/chat.js
// Backend corto para Clicity: usa Gemini (gratis) como motor principal.
// Si Gemini falla, se queda sin cupo, o responde con incertidumbre, cae
// automáticamente a Claude (de pago) como respaldo. El frontend nunca
// sabe ni le importa cuál de los dos respondió.

const GEMINI_MODEL = "gemini-2.5-flash"; // modelo gratuito vigente (mid-2026)
const CLAUDE_MODEL = "claude-sonnet-4-6";

// Frases que indican que el modelo "no supo qué responder" — si Gemini
// contesta con algo así, lo tratamos como una falla y pasamos a Claude.
const INDICADORES_INCERTIDUMBRE = [
  "no tengo información",
  "no tengo acceso",
  "no puedo responder",
  "no estoy seguro",
  "no cuento con esa información",
  "no dispongo de",
  "lo siento, no",
  "i don't have",
  "i cannot",
  "i'm not sure",
];

export default async function handler(req, res) {
  // CORS abierto: el frontend puede vivir en cualquier dominio (GitHub Pages,
  // Vercel, un archivo local, etc.) y siempre podrá llamar a este backend.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { system, messages } = req.body || {};
  if (!system || !Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: "Falta 'system' o 'messages' en el body" });
  }

  // 1) Intentar primero con Gemini (gratis)
  try {
    const texto = await llamarGemini(system, messages);
    if (texto && esRespuestaValida(texto)) {
      return res.status(200).json({ text: texto, motor: "gemini" });
    }
    throw new Error("Gemini respondió pero con incertidumbre o vacío");
  } catch (err) {
    console.log("[fallback] Gemini falló, paso a Claude:", err.message);
  }

  // 2) Respaldo de pago: Claude
  try {
    const texto = await llamarClaude(system, messages);
    return res.status(200).json({ text: texto, motor: "claude" });
  } catch (err) {
    console.error("[error] Claude también falló:", err.message);
    return res.status(500).json({ error: "No se pudo generar una respuesta en ningún motor" });
  }
}

// ── GEMINI (motor principal, gratis) ─────────────────────────────────────────
async function llamarGemini(system, messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY en las variables de entorno");

  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content || "" }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
    }),
  });

  if (!r.ok) {
    const cuerpo = await r.text().catch(() => "");
    throw new Error(`Gemini HTTP ${r.status}: ${cuerpo.slice(0, 200)}`);
  }

  const data = await r.json();
  const candidato = data.candidates?.[0];
  if (!candidato) throw new Error("Gemini no devolvió candidatos");
  if (candidato.finishReason && candidato.finishReason !== "STOP") {
    throw new Error(`Gemini finishReason: ${candidato.finishReason}`);
  }

  const texto = candidato.content?.parts?.[0]?.text;
  if (!texto) throw new Error("Gemini devolvió texto vacío");
  return texto.trim();
}

// ── CLAUDE (respaldo de pago) ─────────────────────────────────────────────────
async function llamarClaude(system, messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY en las variables de entorno");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!r.ok) {
    const cuerpo = await r.text().catch(() => "");
    throw new Error(`Claude HTTP ${r.status}: ${cuerpo.slice(0, 200)}`);
  }

  const data = await r.json();
  const texto = data.content?.[0]?.text;
  if (!texto) throw new Error("Claude devolvió texto vacío");
  return texto.trim();
}

// ── Heurística: ¿la respuesta de Gemini realmente sirve? ──────────────────────
function esRespuestaValida(texto) {
  if (!texto || texto.trim().length < 3) return false;
  const t = texto.toLowerCase();
  return !INDICADORES_INCERTIDUMBRE.some(frase => t.includes(frase));
}
