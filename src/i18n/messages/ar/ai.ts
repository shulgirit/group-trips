import type { PartialMessages } from "../index";

const ai: PartialMessages["ai"] = {
  speaker: "{name} ({family})",
  untitledChat: "محادثة",
  lookAtPhoto: "ألقِ نظرة على هذه الصورة",
  privateNote: "محادثاتكم خاصة. فقط ما تحفظونه في الأماكن أو الجدول تتم مشاركته مع المجموعة",
  sharedNote: "يعرف الأماكن والجدول والمجموعة كلها",
  newChat: "محادثة جديدة",
  deleteChat: "حذف المحادثة {title}",
  signInForHistory: "تريدون سجل محادثات خاصًا؟ سجّلوا الدخول باستخدام Google في الإعدادات",
  reviews: {
    one: "تقييم واحد على Google",
    other: "{n} تقييمات على Google",
  },
  dismiss: "إزالة من النتائج",
  saved: "محفوظ · التفاصيل والجدولة",
  savePlace: "إضافة إلى الأماكن",
  inPoll: "في استطلاع",
  toPoll: "إضافة إلى استطلاع…",
  tellMore: "أخبرني المزيد",
  website: "الموقع الإلكتروني",
  canDo: "ما الذي أستطيع فعله",
  thinking: "أفكّر",
  attachedPhoto: "صورة مرفقة",
  photoWillSend: "سيتم إرسال الصورة مع رسالتكم",
  removePhoto: "إزالة الصورة",
  attachPhoto: "إرفاق صورة",
  continuePlaceholder: "تابعوا المحادثة…",
  send: "إرسال",
  loadingInfo: "جارٍ تحميل التفاصيل",
  errors: {
    photoRead: "لم نتمكّن من قراءة هذه الصورة. جرّبوا صورة أخرى",
    placeInfo: "تعذّر جلب التفاصيل الآن. أغلقوا وحاولوا مجددًا",
    timeout:
      "استغرق الرد وقتًا طويلًا أو انقطع الاتصال. سؤالكم محفوظ، ويمكنكم المحاولة مجددًا",
    uploadFailed: "فشل رفع الصورة، حاولوا مجددًا",
    pollFailed: "تعذّرت الإضافة إلى الاستطلاع، حاولوا مجددًا",
  },
};

export default ai;
