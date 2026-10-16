/** Hebrew — source of truth for the "config" namespace (trip config copy built by tripConfigFromDoc). */
const config = {
  groupFallback: "החבורה",
  heroTitle: "{place} מחכה לנו",
  departureNote: "יוצאים · {start} – {end}",
  navHome: "נווט הביתה: {name}",
  signature: "{trip} · {group}",
  summarySuffix: " · {group}",
  ideasPoll: "סקר הרעיונות של הקבוצה",
  ai: {
    heroBlurb: "{name} לשירותכם: המלצות, שיבוצים בלוח, סקרים ועדכון מקומות. מחובר לכל נתוני הטיול",
    subtitle: "מכיר את המקומות, הלו״ז ואת כל החבורה",
    quickAdd: "שאלו את {name}",
    aboutTitle: "ספרו ל{bare} עלינו",
    aboutDescription:
      "כל מה שתכתבו כאן נכנס לידע של {name}: מי זה מי, גילאים, מה כל אחד אוהב, בדיחות פנימיות. והוא ישתמש בזה בשיחות ובהמלצות",
    aboutPlaceholder: "למשל: נועה בת 9 ואוהבת חיות. דני משוגע על אוכל רחוב...",
    aboutSaved: "נשמר. {name} כבר מכיר את זה",
    inputPlaceholder: "שאלו אותי כל דבר על הטיול…",
    prompts: {
      a: "תמליץ לנו על אטרקציה",
      b: "מה כדאי לעשות מחר?",
      c: "תמצא מסעדה טובה לידנו",
      d: "תכנן לנו יום מושלם",
      e: "תמצא Plan B אם יורד גשם",
      f: "מה עוד לא שובץ בלוח?",
    },
  },
  group: {
    splitPick: "בחרו מי השתתף",
    loading: "טוען…",
    quickLoginTitle: "כניסה מהירה",
    quickLoginHint: "בקשו מהמארגנים לשתף את קוד ההזמנה",
    pickName: "ועכשיו, מי אתם?",
  },
  kinds: {
    families: {
      unitLabel: "משפחות",
      pageTitle: "המשפחות",
      pickUnit: "מאיזו משפחה אתם?",
      splitEveryone: "כולם השתתפו (כל המשפחות)",
    },
    friends: {
      unitLabel: "חברים",
      pageTitle: "החבורה",
      pickUnit: "מי אתם?",
      splitEveryone: "כולם השתתפו (כל החברים)",
    },
    couple: {
      unitLabel: "אנחנו",
      pageTitle: "אנחנו",
      pickUnit: "מי מכם?",
      splitEveryone: "שנינו השתתפנו",
    },
    other: {
      unitLabel: "קבוצות",
      pageTitle: "הקבוצה",
      pickUnit: "מאיזו קבוצה אתם?",
      splitEveryone: "כולם השתתפו (כל הקבוצות)",
    },
  },
};

export default config;
