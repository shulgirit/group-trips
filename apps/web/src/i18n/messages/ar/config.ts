import type { PartialMessages } from "../index";

const config: PartialMessages["config"] = {
  groupFallback: "المجموعة",
  heroTitle: "{place} بانتظاركم",
  departureNote: "المغادرة · {start} – {end}",
  navHome: "التوجّه إلى مقر الإقامة: {name}",
  signature: "{trip} · {group}",
  summarySuffix: " · {group}",
  ideasPoll: "استطلاع أفكار المجموعة",
  ai: {
    heroBlurb: "{name} في خدمتكم: اقتراحات وجدولة واستطلاعات وتحديثات للأماكن. متصل بكل تفاصيل الرحلة.",
    subtitle: "يعرف الأماكن والجدول والمجموعة كلها",
    quickAdd: "اسألوا {name}",
    aboutTitle: "حدّثوا {name} عنّا",
    aboutDescription:
      "كل ما تكتبونه هنا يصبح جزءًا مما يعرفه {name}: من هو من، الأعمار، ما يحبه كل واحد، النكات الداخلية. يستخدم ذلك في المحادثات والاقتراحات.",
    aboutPlaceholder: "مثلًا: نور عمرها 9 سنوات وتحب الحيوانات. سامي يعشق أكل الشارع...",
    aboutSaved: "تم الحفظ. {name} يعرف هذا الآن",
    inputPlaceholder: "اسألوني أي شيء عن الرحلة…",
    prompts: {
      a: "اقترح معلمًا سياحيًا",
      b: "ماذا نفعل غدًا؟",
      c: "ابحث عن مطعم جيد قريب",
      d: "خطّط لنا يومًا مثاليًا",
      e: "ابحث عن خطة بديلة إذا أمطرت",
      f: "ما الذي ليس في الجدول بعد؟",
    },
  },
  group: {
    splitPick: "اختاروا من شارك",
    loading: "جارٍ التحميل…",
    quickLoginTitle: "تسجيل دخول سريع",
    quickLoginHint: "اطلبوا من المنظّمين مشاركة رمز الدعوة",
    pickName: "والآن، من أنتم؟",
  },
  kinds: {
    families: {
      unitLabel: "العائلات",
      pageTitle: "العائلات",
      pickUnit: "إلى أي عائلة تنتمون؟",
      splitEveryone: "شارك الجميع (كل العائلات)",
    },
    friends: {
      unitLabel: "الأصدقاء",
      pageTitle: "المجموعة",
      pickUnit: "من أنتم؟",
      splitEveryone: "شارك الجميع (كل الأصدقاء)",
    },
    couple: {
      unitLabel: "نحن",
      pageTitle: "نحن",
      pickUnit: "من منكما هذا؟",
      splitEveryone: "شاركنا كلانا",
    },
    other: {
      unitLabel: "المجموعات",
      pageTitle: "المجموعة",
      pickUnit: "إلى أي مجموعة تنتمون؟",
      splitEveryone: "شارك الجميع (كل المجموعات)",
    },
  },
};

export default config;
