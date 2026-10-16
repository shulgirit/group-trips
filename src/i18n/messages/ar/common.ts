import type { PartialMessages } from "../index";

const common: PartialMessages["common"] = {
  appName: "Together",
  tagline: "رحلتكم الجماعية في مكان واحد",
  save: "حفظ",
  saving: "جارٍ الحفظ…",
  cancel: "إلغاء",
  close: "إغلاق",
  confirm: {
    irreversible: "لا يمكن التراجع عن هذا الإجراء",
    typeToConfirm: "للتأكيد، اكتبوا {word}",
    working: "جارٍ الحذف…",
    word: "حذف",
  },
  delete: "حذف",
  edit: "تعديل",
  back: "رجوع",
  next: "التالي",
  continue: "متابعة",
  done: "تم",
  later: "لاحقًا",
  loading: "جارٍ التحميل…",
  retry: "حاولوا مجددًا",
  copy: "نسخ",
  copied: "تم النسخ",
  share: "مشاركة",
  search: "بحث",
  all: "الكل",
  everyone: "الجميع",
  yes: "نعم",
  no: "لا",
  or: "أو",
  today: "اليوم",
  tomorrow: "غدًا",
  errors: {
    generic: "حدث خطأ ما. حاولوا مجددًا",
    network: "أنتم غير متصلين. تحققوا من الاتصال وحاولوا مجددًا",
    saveFailed: "تعذّر الحفظ. حاولوا مجددًا",
    connection: "تعذّر الوصول إلى بيانات الرحلة. تحققوا من الاتصال وحدّثوا الصفحة",
  },
  language: {
    title: "اللغة",
    hint: "القوائم والأزرار. ما كتبته مجموعتكم يبقى كما هو.",
  },
};

export default common;
