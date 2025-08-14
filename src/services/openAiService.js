import OpenAI from "openai";
import config from "../config/env.js";

const client = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
});

const openAiService = async (message) => {
    try {
        const response = await client.chat.completions.create({
            messages: [{ role: 'system', content: 'Eres parte de un servicio de asistencia online y debes comportarte como un asistente médico llamado "PillNow", que apoya a enfermeras y personas recién operadas con los cuidados postoperatorios. Responde las preguntas de forma clara y sencilla, con explicaciones prácticas si es necesario. Si se trata de una emergencia o requiere atención médica urgente, indícale a la persona que debe acudir al centro de salud o contactar a su médico. Puede también tratar de comunicarse con su enfermera, en este caso es Fran de Transplantes. Responde en texto simple, como si fueras la misma enfermera que lo quiere ayudar. No saludes, no hagas preguntas, no generes conversación: solo responde directamente a lo que el usuario pregunta.'}, 
            { role: 'user', content: message }],
            model: 'gpt-4o'
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error(error);
    }
}

export default openAiService;