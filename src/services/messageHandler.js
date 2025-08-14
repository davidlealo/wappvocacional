import whatsappService from './whatsappService.js';
import appendToSheet from './googleSheetsService.js';
import openAiService from './openAiService.js';

class MessageHandler {

  constructor() {
    this.appointmentState = {};
    this.assistandState = {};
  }

  async handleIncomingMessage(message, senderInfo) {
    if (message?.type === 'text') {
      const incomingMessage = message.text.body.toLowerCase().trim();

      if(this.isGreeting(incomingMessage)){
        await this.sendWelcomeMessage(message.from, message.id, senderInfo);
        await this.sendWelcomeMenu(message.from);
      } else if(incomingMessage === 'media') {
        await this.sendMedia(message.from);
      } else if (this.appointmentState[message.from]) {
        await this.handleAppointmentFlow(message.from, incomingMessage);
      } else if (this.assistandState[message.from]) {
        await this.handleAssistandFlow(message.from, incomingMessage);
      } else {
        await this.handleMenuOption(message.from, incomingMessage);
      }
      await whatsappService.markAsRead(message.id);
    } else if (message?.type === 'interactive') {
      const option = message?.interactive?.button_reply?.id;
      await this.handleMenuOption(message.from, option);
      await whatsappService.markAsRead(message.id);
    }
  }

  isGreeting(message) {
    const greetings = ["hola", "hello", "hi", "buenas tardes"];
    return greetings.includes(message);
  }

  getSenderName(senderInfo) {
    return senderInfo.profile?.name || senderInfo.wa_id;
  }

  async sendWelcomeMessage(to, messageId, senderInfo) {
    const name = this.getSenderName(senderInfo);
    const welcomeMessage = `Hola ${name}, Bienvenido a Pillnow, Tu asistente post operatorio. ¿En qué puedo ayudarte hoy?`;
    await whatsappService.sendMessage(to, welcomeMessage, messageId);
  }

  async sendWelcomeMenu(to) {
    const menuMessage = "Elige una Opción"
    const buttons = [
      {
        type: 'reply', reply: { id: 'option_1', title: 'Agendar' }
      },
      {
        type: 'reply', reply: { id: 'option_2', title: 'Consultar'}
      },
      {
        type: 'reply', reply: { id: 'option_3', title: 'Ubicación'}
      }
    ];

    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }

  waiting = (delay, callback) => {
    setTimeout(callback, delay);
  };

  async handleMenuOption(to, option) {
    let response;
    switch (option) {
      case 'option_1':
        this.appointmentState[to] = { step: 'name' }
        response = "Por favor, ingresa tu nombre:";
        break;
      case 'option_2':
        this.assistandState[to] = { step: 'question' };
        response = "Realiza tu consulta";
        break
      case 'option_3': 
       response = 'Te esperamos en nuestra sucursal.';
       await this.sendLocation(to);
       break
      case 'option_6':
        response = "Si esto es una emergencia, te invitamos a llamar a nuestra linea de atención"
        await this.sendContact(to);
      default: 
       response = "Lo siento, no entendí tu selección, Por Favor, elige una de las opciones del menú."
    }
    await whatsappService.sendMessage(to, response);
  }

  async sendMedia(to) {
    // const mediaUrl = 'https://s3.amazonaws.com/gndx.dev/medpet-audio.aac';
    // const caption = 'Bienvenida';
    // const type = 'audio';

    // const mediaUrl = 'https://s3.amazonaws.com/gndx.dev/medpet-imagen.png';
    // const caption = '¡Esto es una Imagen!';
    // const type = 'image';

    // const mediaUrl = 'https://s3.amazonaws.com/gndx.dev/medpet-video.mp4';
    // const caption = '¡Esto es una video!';
    // const type = 'video';

    const mediaUrl = 'https://s3.amazonaws.com/gndx.dev/medpet-file.pdf';
    const caption = '¡Esto es un PDF!';
    const type = 'document';

    await whatsappService.sendMediaMessage(to, type, mediaUrl, caption);
  }

  completeAppointment(to) {
    const appointment = this.appointmentState[to];
    delete this.appointmentState[to];

    const userData = [
      to,
      appointment.name,
      appointment.pacienteName,
      appointment.pacienteType,
      appointment.reason,
      new Date().toISOString()
    ]

    appendToSheet(userData);

    return `Gracias por agendar tu cita. 
    Resumen de tu cita:
    
    Nombre: ${appointment.name}
    Nombre del paciente: ${appointment.pacienteName}
    Tipo de operación: ${appointment.pacienteType}
    Motivo: ${appointment.reason}
    
    Nos pondremos en contacto contigo pronto para confirmar la fecha y hora de tu cita.`
  }

  async handleAppointmentFlow(to, message) {
    const state = this.appointmentState[to];
    let response;

    switch (state.step) {
      case 'name':
        state.name = message;
        state.step = 'pacienteName';
        response = "Gracias, Ahora, ¿Cuál es el nombre del paciente?"
        break;
      case 'pacienteName':
        state.pacienteName = message;
        state.step = 'pacienteType';
        response = '¿Qué tipo de operación se realizó? '
        break;
      case 'pacienteType':
        state.pacienteType = message;
        state.step = 'reason';
        response = '¿Cuál es el motivo de la Consulta?';
        break;
      case 'reason':
        state.reason = message;
        response = this.completeAppointment(to);
        break;
    }
    await whatsappService.sendMessage(to, response);
  }

  async handleAssistandFlow(to, message) {
    const state = this.assistandState[to];
    let response;

    const menuMessage = "¿La respuesta fue de tu ayuda?"
    const buttons = [
      { type: 'reply', reply: { id: 'option_4', title: "Si, Gracias" } },
      { type: 'reply', reply: { id: 'option_5', title: 'Hacer otra pregunta'}},
      { type: 'reply', reply: { id: 'option_6', title: 'Emergencia'}}
    ];

    if (state.step === 'question') {
      response = await openAiService(message);
    }

    delete this.assistandState[to];
    await whatsappService.sendMessage(to, response);
    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }

  async sendContact(to) {
    const contact = {
      addresses: [
        {
          street: "123 Calle de las Mascotas",
          city: "Ciudad",
          state: "Estado",
          zip: "12345",
          country: "País",
          country_code: "PA",
          type: "WORK"
        }
      ],
      emails: [
        {
          email: "contacto@pillnow.com",
          type: "WORK"
        }
      ],
      name: {
        formatted_name: "PillNow Contacto",
        first_name: "PillNow",
        last_name: "Contacto",
        middle_name: "",
        suffix: "",
        prefix: ""
      },
      org: {
        company: "PillNow",
        department: "Atención al Cliente",
        title: "Representante"
      },
      phones: [
        {
          phone: "+1234567890",
          wa_id: "1234567890",
          type: "WORK"
        }
      ],
      urls: [
        {
          url: "https://www.pillnow.com",
          type: "WORK"
        }
      ]
    };

    await whatsappService.sendContactMessage(to, contact);
  }

  async sendLocation(to) {
    const latitude = 6.2071694;
    const longitude = -75.574607;
    const name = 'Pill Now';
    const address = 'Avenida Providencia s/n, Comuna Providencia, Santiago.'

    await whatsappService.sendLocationMessage(to, latitude, longitude, name, address);
  }

}

export default new MessageHandler();