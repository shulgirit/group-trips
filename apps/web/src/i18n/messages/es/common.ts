import type { PartialMessages } from "../index";

const common: PartialMessages["common"] = {
  appName: "Together",
  tagline: "Vuestro viaje en grupo, todo en un lugar",
  save: "Guardar",
  saving: "Guardando…",
  cancel: "Cancelar",
  close: "Cerrar",
  confirm: {
    irreversible: "Esta acción no se puede deshacer",
    typeToConfirm: "Para confirmar, escribe {word}",
    working: "Eliminando…",
    word: "ELIMINAR",
  },
  delete: "Eliminar",
  edit: "Editar",
  back: "Atrás",
  next: "Siguiente",
  continue: "Continuar",
  done: "Listo",
  later: "Más tarde",
  loading: "Cargando…",
  retry: "Reintentar",
  copy: "Copiar",
  copied: "Copiado",
  share: "Compartir",
  search: "Buscar",
  all: "Todo",
  everyone: "Todos",
  yes: "Sí",
  no: "No",
  or: "o",
  today: "Hoy",
  tomorrow: "Mañana",
  errors: {
    generic: "Algo salió mal. Inténtalo de nuevo",
    network: "No hay conexión. Revisa tu red e inténtalo de nuevo",
    saveFailed: "No se pudo guardar. Inténtalo de nuevo",
    connection: "No se puede acceder a los datos del viaje. Revisa la conexión y recarga",
  },
  language: {
    title: "Idioma",
    hint: "Menús y botones. Lo que escribió tu grupo se mantiene tal cual.",
  },
};

export default common;
