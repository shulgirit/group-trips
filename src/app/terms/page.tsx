import type { Metadata } from "next";
import { LegalPage } from "@/components/product/LegalPage";

export const metadata: Metadata = { title: "תנאי שימוש" };

// DRAFT — have this reviewed by a lawyer before store submission.
export default function TermsPage() {
  return (
    <LegalPage
      title="תנאי שימוש"
      updated="אוקטובר 2026"
      sections={[
        {
          heading: "השירות",
          body: [
            "האפליקציה עוזרת לקבוצות לתכנן ולנהל טיול משותף. השימוש כרגע חינמי, בכפוף למגבלות שימוש סבירות (למשל מספר שיחות AI בחודש).",
          ],
        },
        {
          heading: "עוזר ה-AI",
          body: [
            "המלצות ה-AI נוצרות אוטומטית ועלולות להכיל טעויות. בדקו שעות פתיחה, מחירים והזמנות מול המקור לפני שאתם מסתמכים עליהם.",
          ],
        },
        {
          heading: "התוכן שלכם",
          body: [
            "התוכן שאתם מעלים שייך לכם. אתם אחראים לא להעלות תוכן שאין לכם זכות לשתף, ולשתף מידע אישי של אחרים רק בהסכמתם.",
          ],
        },
        {
          heading: "קשר",
          body: ["שאלות? כתבו לנו מתוך האפליקציה או במייל של מפעיל השירות."],
        },
      ]}
    />
  );
}
