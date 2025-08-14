// src/services/messageHandler.js
import whatsappService from './whatsappService.js';
import appendToSheet, { appendToSheet as appendToSheetNamed } from './googleSheetsService.js';
import openAiService, { openAiServiceFn } from './openAiService.js';
import dotenv from 'dotenv';

dotenv.config();

const ASSISTANT_NAME = process.env.ASSISTANT_NAME || 'Proyéctate';

class MessageHandler {
  constructor() {
    this.appointmentState = {};
    this.assistandState = {};
  }

  // --- Utilidades ---
  isGreeting(message) {
    const t = (message || '').toLowerCase().trim();
    const greetings = [
      'hola', 'hello', 'hi', 'buenas', 'buenas tardes', 'buenos dias', 'buenos días', 'buenas noches'
    ];
    return greetings.includes(t);
  }

  getSenderName(senderInfo) {
    return senderInfo?.profile?.name || senderInfo?.wa_id || '';
  }

  detectIntent(text) {
    const t = (text || '').toLowerCase();
    if (t.includes('beca') || t.includes('arancel') || t.includes('gratuidad')) return 'financiamiento';
    if (t.includes('psu') || t.includes('paes') || t.includes('admision') || t.includes('admisión')) return 'admision';
    if (t.includes('trabajo') || t.includes('empleo') || t.includes('empleabilidad')) return 'empleabilidad';
    if (t.includes('carrera') || t.includes('universidad') || t.includes('instituto') || t.includes('malla')) return 'oferta_formativa';
    if (t.includes('test') || t.includes('vocacion') || t.includes('vocación') || t.includes('intereses')) return 'orientacion';
    if (this.isGreeting(t)) return 'saludo';
    return 'general';
  }

  async logChat({ phone, name, userMessage, botResponse, intent = 'general' }) {
    try {
      const timestamp = new Date().toISOString();
      const channel = 'whatsapp';
      // Puedes usar cualquiera de las dos exports; ambas funcionan
      await appendToSheet([
        timestamp,
        phone,
        name || '',
        userMessage,
        botResponse,
        channel,
        intent
      ]);
      // await appendToSheetNamed([...]) // alternativa
    } catch (e) {
      console.error('[MessageHandler] logChat:', e?.message || e);
    }
  }

  // --- Mensajes base ---
  async sendWelcomeMessage(to, messageId, senderInfo) {
    const name = this.getSenderName(senderInfo);
    const welcomeMessage = `Hola ${name}, soy ${ASSISTANT_NAME}, tu asistente vocacional. ¿En qué puedo ayudarte hoy?`;
    await whatsappService.sendMessage(to, welcomeMessage, messageId);
    await this.logChat({
      phone: to,
      name,
      userMessage: 'saludo',
      botResponse: welcomeMessage,
      intent: 'saludo'
    });
  }

  async sendWelcomeMenu(to) {
    const menuMessage = 'Elige una opción';
    const buttons = [
      { type: 'reply', reply: { id: 'option_1', title: 'Hacer una consulta' } },
      { type: 'reply', reply: { id: 'option_3', title: 'Ubicación (demo)' } }
    ];
    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
    await this.logChat({
      phone: to,
      name: '',
      userMessage: 'mostrar_menu',
      botResponse: menuMessage + ' [buttons: Consulta | Ubicación]',
      intent: 'menu'
    });
  }

  waiting = (delay, callback) => {
    setTimeout(callback, delay);
  };

  // --- Flujo principal ---
  async handleIncomingMessage(message, senderInfo) {
    try {
      if (message?.type === 'text') {
        const incomingMessage = (message.text?.body || '').toLowerCase().trim();
        const phone = message.from;
        const name = this.getSenderName(senderInfo);

        if (this.isGreeting(incomingMessage)) {
          await this.sendWelcomeMessage(phone, message.id, senderInfo);
          await this.sendWelcomeMenu(phone);
        } else if (incomingMessage === 'media') {
          await this.sendMedia(phone);
          await this.logChat({ phone, name, userMessage: 'media', botResponse: 'Envío de media', intent: 'media' });
        } else if (this.appointmentState[phone]) {
          await this.handleAppointmentFlow(phone, incomingMessage, name);
        } else if (this.assistandState[phone]) {
          await this.handleAssistandFlow(phone, incomingMessage, name);
        } else {
          await this.handleMenuOption(phone, incomingMessage, name);
        }

        await whatsappService.markAsRead(message.id);
      } else if (message?.type === 'interactive') {
        const option = message?.interactive?.button_reply?.id;
        const phone = message.from;
        const name = this.getSenderName(senderInfo);
        await this.handleMenuOption(phone, option, name);
        await whatsappService.markAsRead(message.id);
      }
    } catch (err) {
      console.error('[MessageHandler] handleIncomingMessage:', err?.message || err);
    }
  }

  // --- Menú e interacción ---
  async handleMenuOption(to, option, name = '') {
    let response;
    let intent = 'menu';

    switch (option) {
      case 'option_1':
      case 'consultar':
      case 'consulta':
        this.assistandState[to] = { step: 'question' };
        response = 'Cuéntame tu duda (becas, admisión, carreras, empleabilidad, etc.)';
        intent = 'consulta';
        break;

      case 'option_3':
      case 'ubicacion':
      case 'ubicación':
        response = 'Demo: te enviamos una ubicación de ejemplo.';
        await whatsappService.sendMessage(to, response);
        await this.logChat({ phone: to, name, userMessage: option, botResponse: response, intent: 'ubicacion' });
        await this.sendLocation(to);
        await this.logChat({
          phone: to,
          name,
          userMessage: 'solicita_ubicacion',
          botResponse: 'Envío de ubicación',
          intent: 'ubicacion'
        });
        return;

      default:
        // Texto libre -> tratar como consulta con intención detectada
        const detected = this.detectIntent(option);
        this.assistandState[to] = { step: 'question' };
        response = 'Gracias, procesemos tu consulta.';
        intent = detected;
        break;
    }

    await whatsappService.sendMessage(to, response);
    await this.logChat({ phone: to, name, userMessage: option, botResponse: response, intent });
  }

  // --- Media & ubicación demo ---
  async sendMedia(to) {
    const mediaUrl = 'https://s3.amazonaws.com/gndx.dev/medpet-file.pdf';
    const caption = 'PDF de ejemplo';
    const type = 'document';
    await whatsappService.sendMediaMessage(to, type, mediaUrl, caption);
  }

  async sendLocation(to) {
    const latitude = -33.4372;   // Santiago (demo)
    const longitude = -70.6506;
    const name = 'Proyéctate (demo)';
    const address = 'Santiago, Chile (demo)';
    await whatsappService.sendLocationMessage(to, latitude, longitude, name, address);
  }

  // --- Flujo derivación simple (opcional) ---
  async completeAppointment(to) {
    const appointment = this.appointmentState[to];
    delete this.appointmentState[to];

    const resumen = `Gracias. Hemos recibido tus datos:
Nombre: ${appointment.name}
Asunto: ${appointment.reason}
Pronto te contactaremos para coordinar.`;

    await this.logChat({
      phone: to,
      name: appointment.name || '',
      userMessage: appointment.reason || '',
      botResponse: resumen,
      intent: 'derivacion'
    });

    return resumen;
  }

  async handleAppointmentFlow(to, message, name = '') {
    const state = this.appointmentState[to];
    let response;

    switch (state.step) {
      case 'name':
        state.name = message;
        state.step = 'reason';
        response = '¿Cuál es el motivo de tu consulta?';
        break;

      case 'reason':
        state.reason = message;
        response = await this.completeAppointment(to);
        break;

      default:
        response = 'Continuemos. Por favor, indícame tu nombre.';
        state.step = 'name';
        break;
    }

    await whatsappService.sendMessage(to, response);
    await this.logChat({
      phone: to,
      name,
      userMessage: message,
      botResponse: response,
      intent: 'derivacion'
    });
  }

  // --- Flujo Asistente (consulta con IA + conocimiento) ---
  async handleAssistandFlow(to, message, name = '') {
    const state = this.assistandState[to];
    let response;

    const menuMessage = '¿La respuesta fue de ayuda?';
    const buttons = [
      { type: 'reply', reply: { id: 'option_4', title: 'Sí, gracias' } },
      { type: 'reply', reply: { id: 'option_5', title: 'Hacer otra pregunta' } },
      { type: 'reply', reply: { id: 'option_6', title: 'Derivar' } }
    ];

    if (state?.step === 'question') {
      // Puedes llamar al default o al named, ambos devuelven la respuesta del modelo
      response = await openAiService(message);
      // response = await openAiServiceFn(message);

      await this.logChat({
        phone: to,
        name,
        userMessage: message,
        botResponse: response,
        intent: this.detectIntent(message)
      });
    } else {
      response = '¿En qué puedo ayudarte?';
      await this.logChat({
        phone: to,
        name,
        userMessage: message,
        botResponse: response,
        intent: 'consulta'
      });
    }

    delete this.assistandState[to];

    await whatsappService.sendMessage(to, response);
    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);

    await this.logChat({
      phone: to,
      name,
      userMessage: 'mostrar_feedback_buttons',
      botResponse: menuMessage + ' [Sí | Otra pregunta | Derivar]',
      intent: 'feedback'
    });
  }
}

const handler = new MessageHandler();
export default handler;
export { MessageHandler };
