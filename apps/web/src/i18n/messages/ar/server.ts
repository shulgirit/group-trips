import type { PartialMessages } from "../index";

const server: PartialMessages["server"] = {
  push: {
    welcomeTitle: "تم تفعيل الإشعارات",
    welcomeBody: "سنخبركم بالاستطلاعات الجديدة ونذكّركم قبل كل نشاط",
    pollTitle: "استطلاع جديد للمجموعة",
    pollOptionTitle: "خيار جديد في استطلاع المجموعة",
    pollOptionBody: "{title} · صوّتوا الآن",
    eventTitle: "أُضيف إلى الجدول",
    aiEventTitle: "أضاف {ai} إلى الجدول",
    ideasUpdatedTitle: "تم تحديث استطلاع أفكار المجموعة",
    andMore: "و{count} أخرى",
    reminderTitle: "بعد {minutes} د: {title}",
    navigate: "التوجّه",
  },
  booking: {
    checkIn: "تسجيل الوصول",
    checkOut: "تسجيل المغادرة",
    importer: "استيراد الحجز",
  },
};

export default server;
