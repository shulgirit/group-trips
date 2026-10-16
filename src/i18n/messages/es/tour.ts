import type { PartialMessages } from "../index";

const tour: PartialMessages["tour"] = {
  row: {
    title: "Recorrido de introducción",
    description: "Un minuto para ver todo lo que puede hacer la app",
  },
  dialogLabel: "Recorrido de introducción a la app",
  skip: "Saltar el recorrido",
  previous: "Anterior",
  start: "Empecemos",
  sicily: {
    welcome: {
      kicker: "La pandilla de Micha · Sicilia 2026",
      title: "Bienvenidos a nuestra app",
      a: "Todo el viaje en un solo lugar, en vez de rebuscar en WhatsApp direcciones y decisiones",
      b: "Lo que alguien añade, lo ven todos al instante",
      c: "Un minuto de explicación y seréis expertos. ¿Listos?",
    },
    home: {
      kicker: "Pantalla de inicio",
      title: "Ahora: qué está pasando y qué viene después",
      a: "Antes del viaje: una cuenta atrás hasta el vuelo",
      b: "Durante el viaje: la próxima actividad, con la hora, quién va y un botón que abre Waze",
      c: "Debajo: el itinerario de todo el día, marcando dónde estamos ahora",
    },
    places: {
      kicker: "Pestaña Lugares",
      title: "Nuestras atracciones, restaurantes y playas",
      a: "¿Añades un lugar? Escribe el nombre libremente (“estadio Barbera Palermo”) y la app lo encuentra, con foto y ubicación",
      b: "¿Tienes el enlace de su web? Pégalo y la IA rellena la descripción, el horario y los precios",
      c: "Cada página de lugar tiene un botón que añade más detalles, así que no hace falta salir de la app",
    },
    calendar: {
      kicker: "Pestaña Itinerario",
      title: "El viaje, día a día",
      a: "Toca cualquier evento para cambiar la hora, los participantes o el texto",
      b: "¿Os separáis? Sin problema. Unos van al partido, otros a cenar, y el itinerario lo muestra",
      c: "Unos 45 minutos antes de cada actividad, todos reciben un recordatorio en el móvil",
    },
    map: {
      kicker: "Pestaña Mapa",
      title: "Todo en un mismo mapa",
      a: "Nuestra villa tiene un marcador grande, imposible no verla",
      b: "Toca cualquier marcador para ver foto y detalles, y navega con un toque",
    },
    polls: {
      kicker: "Encuestas (en Más)",
      title: "Decidid juntos, sin debates",
      a: "Todos votan con un toque y se ve quién votó qué",
      b: "Junto a cada opción: “Leer sobre el lugar”, con todos los detalles",
      c: "Cuando está decidido, “Programarlo” lo lleva directo al calendario",
    },
    expenses: {
      kicker: "Gastos (en Más)",
      title: "Quién pagó y quién debe",
      a: "¿Has hecho la compra? Anótalo en segundos y la app lo reparte entre las familias",
      b: "Al final del viaje, se salda automáticamente: quién paga a quién y cuánto",
    },
    ai: {
      kicker: "La verdadera magia",
      title: "El mayordomo de la pandilla",
      a: "Un asistente de IA que conoce todo nuestro viaje. Solo tienes que hablarle:",
      chips: {
        a: "“Recomiéndanos un restaurante para niños en Palermo”",
        b: "“Añade las termas mañana a las 14:00”",
        c: "“Haz una encuesta: ¿qué hacemos el martes?”",
        d: "“¿Cuál es el plan de mañana?”",
      },
    },
    final: {
      kicker: "Tres últimos pasos",
      title: "Para sacarle el máximo partido",
      a: "1. Añádela a tu pantalla de inicio: toca Compartir y luego “Añadir a pantalla de inicio”, y será una app de verdad",
      b: "2. En Ajustes: activa las notificaciones de nuevas encuestas y recordatorios",
      c: "3. En Ajustes: vincúlate a tu familia y vota con un solo toque",
    },
  },
  sardinia: {
    welcome: {
      kicker: "El escuadrón de Cerdeña · Cumpliendo 60",
      title: "Bienvenidos a la app del viaje",
      a: "Todo el viaje en un solo lugar, en vez de rebuscar en WhatsApp direcciones y decisiones",
      b: "Lo que alguien añade, lo ven todos al instante",
      c: "Un minuto de explicación y despegamos. ¿Listos?",
    },
    places: {
      a: "Restaurantes, miradores, playas y bodegas, con fotos, valoraciones y navegación",
    },
    expenses: {
      a: "Anota cualquier gasto en segundos y la app lo reparte entre los amigos",
      b: "Al final del viaje: un único resumen en séqueles y todos saldan cuentas",
    },
    ai: {
      title: "El Piloto",
      chips: {
        a: "“Recomiéndanos un mirador de camino a Alghero”",
        b: "“Añade una cena de marisco en Cagliari mañana a las 19:00”",
        c: "“Haz una encuesta: ¿bodega o paseo en barco mañana?”",
        d: "“¿Cuál es el plan de mañana?”",
      },
    },
  },
  trip: {
    welcome: {
      title: "Bienvenidos a la app del viaje",
      a: "Todo el viaje en un solo lugar, en vez de rebuscar en el chat del grupo direcciones y decisiones",
      b: "Lo que alguien añade, lo ven todos al instante",
      c: "Un minuto de explicación y estaréis listos",
    },
    home: {
      kicker: "Pantalla de inicio",
      title: "Ahora: qué está pasando y qué viene después",
      a: "Una cuenta atrás hasta la salida, la próxima actividad y el itinerario de hoy",
      b: "Cuando se fija el alojamiento, un botón de casa te lleva allí con Waze desde cualquier pantalla",
    },
    places: {
      kicker: "Pestaña Lugares",
      title: "Todas las recomendaciones en un lugar",
      a: "Restaurantes, atracciones, playas y miradores, con fotos, valoraciones y navegación",
      b: "¿Has encontrado algo bueno? Añádelo en segundos y lo verán todos",
    },
    calendar: {
      kicker: "Pestaña Itinerario",
      title: "El plan de cada día",
      a: "Programa actividades y mira quién se apunta",
      b: "Un recordatorio automático para todos unos 45 minutos antes de cada actividad",
    },
    map: {
      kicker: "Pestaña Mapa",
      title: "Todos los lugares en un mapa",
      a: "Mira qué queda cerca de qué y planifica mejor cada día",
      b: "Toca un marcador para ver detalles y navegar al instante",
    },
    expenses: {
      kicker: "Gastos",
      title: "Quién pagó y quién debe",
      a: "Anota cualquier gasto en segundos y la app lo reparte entre todos",
      b: "Al final del viaje: un único resumen y todos saldan cuentas",
    },
    ai: {
      kicker: "La verdadera magia",
      a: "La IA privada del grupo. Conoce todo el viaje",
      b: "Solo tienes que hablarle:",
      chips: {
        a: "“Recomiéndanos una gran atracción cerca del alojamiento”",
        b: "“Añade una buena cena mañana a las 19:00”",
        c: "“Haz una encuesta: ¿playa o excursión mañana?”",
        d: "“¿Cuál es el plan de mañana?”",
      },
    },
    final: {
      kicker: "Tres pasos y listo",
      title: "¿Y ahora qué?",
      a: "1. Permite las notificaciones para recibir recordatorios y encuestas",
      b: "2. Añade una primera recomendación en Lugares",
      c: "3. En Ajustes: vincúlate a tu nombre y vota con un solo toque",
    },
  },
};

export default tour;
