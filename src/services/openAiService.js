// src/services/openAiService.js
import dotenv from 'dotenv';
import { retrieveRelevant } from './knowledgeService.js';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ASSISTANT_NAME = process.env.ASSISTANT_NAME || 'Proyéctate';
const MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS || 600);

/**
 * Arma un bloque de contexto con QA relevantes
 */
function buildContextBlock(items) {
  if (!items || items.length === 0) return 'No hay entradas relevantes.';
  const lines = items.map((it, idx) => {
    const cat = it.category ? ` [${it.category}]` : '';
    return `- Q${idx + 1}${cat}: ${it.question}\n  A: ${it.answer}`;
  });
  return lines.join('\n');
}

/**
 * Llama a OpenAI con system + contexto + mensaje del usuario
 * Export: default
 */
export default async function openAiService(userMessage) {
  const topK = await retrieveRelevant(userMessage, 6);
  const contextBlock = buildContextBlock(topK);

  const systemPrompt = `
Eres "${ASSISTANT_NAME}", un asistente vocacional por WhatsApp.
Objetivo: orientar a estudiantes sobre decisiones vocacionales, formación técnica/profesional, becas, vías de admisión, empleabilidad y rutas de aprendizaje.
Instrucciones:
- Responde en español, claro y empático.
- Da respuestas breves y accionables (máx. 6-8 líneas), con bullets si ayuda.
- Usa el bloque de CONTEXTO como fuente prioritaria y cítalo de forma natural ("Según nuestras preguntas frecuentes...").
- Si el contexto no cubre algo, razona con sentido común; si sigue faltando info, acláralo y propone qué dato pedir.
- Evita prometer resultados; entrega pasos o enlaces genéricos (sin URLs completas si no las tienes).
- Mantén el nombre de marca: ${ASSISTANT_NAME}.

CONTEXTO (QA relevantes):
${contextBlock}
`.trim();

  const body = {
    model: OPENAI_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.4,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error('[openAiService] Error:', txt);
    throw new Error(`OpenAI ${resp.status}`);
  }

  const data = await resp.json();
  const answer = data?.choices?.[0]?.message?.content?.trim() || 'Lo siento, no tengo una respuesta por ahora.';
  return answer;
}

/**
 * Export named opcional, por si prefieres import { openAiService }
 */
export async function openAiServiceFn(userMessage) {
  return openAiService(userMessage);
}
