// bot.js
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const API_URL = `https://graph.facebook.com/${process.env.API_VERSION}/${process.env.BUSINESS_PHONE}/messages`;
const API_TOKEN = process.env.API_TOKEN;

const openai = new OpenAI({
  apiKey: process.env.CHATGPT_API_KEY
});

const askOpenAI = async (message) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'Eres parte de un servicio de asistencia online y debes comportarte como un asistente médico llamado "PillNow", que apoya a enfermeras y personas recién operadas con los cuidados postoperatorios. Responde las preguntas de forma clara y sencilla, con explicaciones prácticas si es necesario. Si se trata de una emergencia o requiere atención médica urgente, indícale a la persona que debe acudir al centro de salud o contactar a su médico. Responde en texto simple, como si fueras un bot conversacional. No saludes, no hagas preguntas, no generes conversación: solo responde directamente a lo que el usuario pregunta.'
        },
        { role: 'user', content: message }
      ]
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error al consultar OpenAI:', error.message);
    return 'Lo siento, ocurrió un error al procesar tu consulta. Inténtalo nuevamente más tarde.';
  }
};

// Verificación del webhook
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Recepción de mensajes
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (message && message.type === 'text') {
      const from = message.from;
      const userText = message.text.body;

      const aiReply = await askOpenAI(userText);

      await axios.post(API_URL, {
        messaging_product: 'whatsapp',
        to: from,
        text: { body: aiReply }
      }, {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      return res.sendStatus(200);
    }

    res.sendStatus(404);
  } catch (error) {
    console.error('Error en webhook:', error.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot con OpenAI escuchando en puerto ${PORT}`);
});
