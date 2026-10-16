import type { PartialMessages } from "../index";

const server: PartialMessages["server"] = {
  push: {
    welcomeTitle: "Notificaciones activadas",
    welcomeBody: "Te avisaremos de nuevas encuestas y te recordaremos cada actividad antes de que empiece",
    pollTitle: "Nueva encuesta del grupo",
    pollOptionTitle: "Nueva opción en la encuesta del grupo",
    pollOptionBody: "{title} · Vota",
    eventTitle: "Añadido al itinerario",
    aiEventTitle: "{ai} lo añadió al itinerario",
    ideasUpdatedTitle: "Se actualizó la encuesta de ideas del grupo",
    andMore: "y {count} más",
    reminderTitle: "En {minutes} min: {title}",
    navigate: "Navegar",
  },
  booking: {
    checkIn: "Entrada",
    checkOut: "Salida",
    importer: "Importación de reservas",
  },
};

export default server;
