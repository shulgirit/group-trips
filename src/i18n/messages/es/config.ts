import type { PartialMessages } from "../index";

const config: PartialMessages["config"] = {
  groupFallback: "El grupo",
  heroTitle: "{place} os espera",
  departureNote: "Salida · {start} – {end}",
  navHome: "Navegar a casa: {name}",
  signature: "{trip} · {group}",
  summarySuffix: " · {group}",
  ideasPoll: "La encuesta de ideas del grupo",
  ai: {
    heroBlurb: "{name}, a vuestro servicio: recomendaciones, itinerario, encuestas y novedades de los lugares. Conectado a todos los detalles del viaje.",
    subtitle: "Conoce los lugares, el itinerario y a todo el grupo",
    quickAdd: "Pregunta a {name}",
    aboutTitle: "Cuéntale a {name} sobre nosotros",
    aboutDescription:
      "Todo lo que escribas aquí pasa a formar parte de lo que sabe {name}: quién es quién, edades, lo que le encanta a cada uno, bromas internas. Lo usa en las conversaciones y recomendaciones.",
    aboutPlaceholder: "Por ejemplo: Noa tiene 9 años y le encantan los animales. A Dani le vuelve loco la comida callejera...",
    aboutSaved: "Guardado. {name} ya lo sabe",
    inputPlaceholder: "Pregúntame lo que quieras sobre el viaje…",
    prompts: {
      a: "Recomiéndanos una atracción",
      b: "¿Qué hacemos mañana?",
      c: "Busca un buen restaurante cerca",
      d: "Planéanos un día perfecto",
      e: "Busca un plan B por si llueve",
      f: "¿Qué falta aún en el itinerario?",
    },
  },
  group: {
    splitPick: "Elige quién participó",
    loading: "Cargando…",
    quickLoginTitle: "Acceso rápido",
    quickLoginHint: "Pide a los organizadores que compartan el código de invitación",
    pickName: "Y ahora, ¿quién eres?",
  },
  kinds: {
    families: {
      unitLabel: "Familias",
      pageTitle: "Las familias",
      pickUnit: "¿De qué familia eres?",
      splitEveryone: "Participaron todos (todas las familias)",
    },
    friends: {
      unitLabel: "Amigos",
      pageTitle: "El grupo",
      pickUnit: "¿Quién eres?",
      splitEveryone: "Participaron todos (todos los amigos)",
    },
    couple: {
      unitLabel: "Nosotros",
      pageTitle: "Nosotros",
      pickUnit: "¿Cuál de los dos eres?",
      splitEveryone: "Participamos los dos",
    },
    other: {
      unitLabel: "Grupos",
      pageTitle: "El grupo",
      pickUnit: "¿En qué grupo estás?",
      splitEveryone: "Participaron todos (todos los grupos)",
    },
  },
};

export default config;
