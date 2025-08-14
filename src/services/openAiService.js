import OpenAI from "openai";
import config from "../config/env.js";
import { searchAnswer } from './knowledgeBase.js';

const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });

const openAiService = async (message) => {
    try {
        // Primero revisamos la base de conocimiento
        const answerFromExcel = searchAnswer(message);
        if (answerFromExcel) return answerFromExcel;

        // Si no hay coincidencia, usamos OpenAI
        const response = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'Eres parte de un servicio de asistencia online llamado "PillNow"...' },
                { role: 'user', content: message }
            ]
        });

        return response.choices[0].message.content;

    } catch (error) {
        console.error(error);
        return 'Lo siento, ocurrió un error al procesar tu consulta.';
    }
};

export default openAiService;
