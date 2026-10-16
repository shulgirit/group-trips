import type { PartialMessages } from "../index";

const product: PartialMessages["product"] = {
  shell: { account: "حسابي", guest: "ضيف (بدون حساب)", logout: "تسجيل الخروج" },
  signIn: {
    google: "المتابعة باستخدام Google",
    apple: "المتابعة باستخدام Apple",
    connecting: "جارٍ تسجيل الدخول…",
    failed: "تعذّر تسجيل الدخول، حاولوا مجددًا",
    network: "لا يوجد اتصال بالشبكة، حاولوا مجددًا",
  },
  welcome: {
    consent: {
      before: "بتسجيل الدخول توافقون على ",
      terms: "شروط الاستخدام",
      between: " و",
      privacy: "سياسة الخصوصية",
      after: ".",
    },
  },
  account: { privacyLink: "سياسة الخصوصية", termsLink: "شروط الاستخدام" },
  legal: { updated: "سارية اعتبارًا من {date}", contents: "المحتويات" },
};

export default product;
