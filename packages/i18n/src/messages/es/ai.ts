import type { PartialMessages } from "../index";

const ai: PartialMessages["ai"] = {
  speaker: "{name} ({family})",
  untitledChat: "Chat",
  lookAtPhoto: "Echa un vistazo a esta foto",
  privateNote: "Tus chats son privados. Solo se comparte con el grupo lo que guardes en lugares o en el itinerario",
  sharedNote: "Conoce los lugares, el itinerario y a todo el grupo",
  newChat: "Nuevo chat",
  deleteChat: "Eliminar el chat {title}",
  signInForHistory: "¿Quieres un historial de chats privado? Inicia sesión con Google en Ajustes",
  reviews: {
    one: "1 reseña de Google",
    other: "{n} reseñas de Google",
  },
  dismiss: "Quitar de los resultados",
  saved: "Guardado · detalles y programación",
  savePlace: "Añadir a lugares",
  inPoll: "En una encuesta",
  toPoll: "Añadir a una encuesta…",
  tellMore: "Cuéntame más",
  website: "Sitio web",
  canDo: "Lo que puedo hacer",
  thinking: "Pensando",
  attachedPhoto: "Foto adjunta",
  photoWillSend: "La foto se enviará con tu mensaje",
  removePhoto: "Quitar la foto",
  attachPhoto: "Adjuntar una foto",
  continuePlaceholder: "Sigue la conversación…",
  send: "Enviar",
  loadingInfo: "Cargando detalles",
  errors: {
    photoRead: "No pudimos leer esa foto. Prueba con otra",
    placeInfo: "No se pudieron obtener los detalles ahora. Cierra e inténtalo de nuevo",
    timeout:
      "La respuesta tardó demasiado o se cortó la conexión. Tu pregunta está guardada, puedes volver a intentarlo",
    uploadFailed: "No se pudo subir la foto. Inténtalo de nuevo",
    pollFailed: "No se pudo añadir a la encuesta. Inténtalo de nuevo",
    failed: "Esta vez no pude responder. Vuelve a preguntar",
    notConfigured: "El guía aún no está conectado. Inténtalo más tarde",
    quota: "Tu viaje alcanzó el límite mensual de IA ({limit} mensajes). Se renueva a principios del mes que viene.",
  },
};

export default ai;
