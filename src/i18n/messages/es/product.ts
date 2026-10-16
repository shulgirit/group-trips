import type { PartialMessages } from "../index";

const product: PartialMessages["product"] = {
  shell: { account: "Mi cuenta", guest: "Invitado (sin cuenta)", logout: "Cerrar sesión" },
  signIn: {
    google: "Continuar con Google",
    apple: "Continuar con Apple",
    connecting: "Iniciando sesión…",
    failed: "No se pudo iniciar sesión. Inténtalo de nuevo",
    network: "Sin conexión. Inténtalo de nuevo",
  },
  welcome: {
    consent: {
      before: "Al iniciar sesión aceptas los ",
      terms: "Términos de uso",
      between: " y la ",
      privacy: "Política de privacidad",
      after: ".",
    },
  },
  account: { privacyLink: "Política de privacidad", termsLink: "Términos de uso" },
  legal: { updated: "Vigente desde el {date}", contents: "Contenido" },
};

export default product;
