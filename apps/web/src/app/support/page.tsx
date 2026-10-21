import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { STROKE } from "@/components/ui/Icon";
import { contentLocale } from "@together/i18n/config";
import { requestLocale } from "@/i18n/server";
import { BRAND } from "@together/shared/brand";
import { OPERATOR } from "@/legal";

export const metadata: Metadata = {
  title: "Support",
  description: "Help and contact for Together, the group trip planner.",
};

const COPY = {
  en: {
    title: "Support",
    lead: "Questions, a problem with the app, or a request to delete your data? Write to us and a person will reply, usually within two business days.",
    contact: "Email us",
    faqTitle: "Common questions",
    faq: [
      ["I didn't get my sign-in code", "Check your spam folder, then request a new code. The email comes from no-reply@togethergroup.app and the code is valid for 5 minutes. You can also sign in with Google."],
      ["How do I invite people?", "Open your trip, tap More, then Invite the group, and share the link on WhatsApp or any app. Everyone who opens it joins in one tap."],
      ["How do I delete my account?", "In the app: More, then Settings, then Delete account. You can also do it on the web at the link below. Your personal data is removed; shared trip content you created stays with the group unless you remove it first."],
      ["Which languages are supported?", "English, Hebrew, Arabic and Spanish. You can switch the language in Settings."],
    ],
    deleteLink: "Delete my account",
    privacy: "Privacy Policy",
    terms: "Terms of Use",
  },
  he: {
    title: "תמיכה",
    lead: "שאלה, תקלה באפליקציה או בקשה למחיקת המידע שלך? כתבו לנו ואדם אמיתי יענה, בדרך כלל תוך יומיים עסקים.",
    contact: "שלחו לנו מייל",
    faqTitle: "שאלות נפוצות",
    faq: [
      ["לא קיבלתי קוד כניסה", "בדקו בתיבת הספאם ובקשו קוד חדש. המייל נשלח מ-no-reply@togethergroup.app והקוד תקף ל-5 דקות. אפשר גם להיכנס עם Google."],
      ["איך מזמינים אנשים?", "פתחו את הטיול, לחצו על עוד ואז על הזמנת הקבוצה, ושתפו את הקישור בוואטסאפ או בכל אפליקציה. כולם מצטרפים בלחיצה אחת."],
      ["איך מוחקים את החשבון?", "באפליקציה: עוד, הגדרות, מחיקת חשבון. אפשר גם באתר בקישור למטה. המידע האישי שלכם נמחק; תוכן משותף שיצרתם נשאר אצל הקבוצה אלא אם תמחקו אותו קודם."],
      ["באילו שפות זה זמין?", "אנגלית, עברית, ערבית וספרדית. אפשר להחליף שפה בהגדרות."],
    ],
    deleteLink: "מחיקת החשבון שלי",
    privacy: "מדיניות פרטיות",
    terms: "תנאי שימוש",
  },
} as const;

/** Public support page (also the Support URL in App Store Connect and Google Play). */
export default async function SupportPage() {
  const locale = await requestLocale();
  const copy = COPY[contentLocale(locale) === "he" ? "he" : "en"];
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/welcome" className="inline-flex items-center gap-2 text-sm font-medium text-sea-700">
        <ArrowLeft size={16} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
        {BRAND.name}
      </Link>
      <h1 className="mt-6 font-display text-3xl font-light text-ink-900">{copy.title}</h1>
      <p className="mt-4 leading-relaxed text-ink-700">{copy.lead}</p>
      <a
        href={`mailto:${OPERATOR.supportEmail}`}
        className="mt-6 inline-flex rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-white"
      >
        {copy.contact}: {OPERATOR.supportEmail}
      </a>

      <h2 className="mt-12 font-display text-xl font-medium text-ink-900">{copy.faqTitle}</h2>
      <div className="mt-4 space-y-6">
        {copy.faq.map(([question, answer]) => (
          <section key={question}>
            <h3 className="font-medium text-ink-900">{question}</h3>
            <p className="mt-1 leading-relaxed text-ink-700">{answer}</p>
          </section>
        ))}
      </div>

      <p className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-cream-200 pt-6 text-sm text-sea-700">
        <Link href="/account/delete" className="underline-offset-4 hover:underline">{copy.deleteLink}</Link>
        <Link href="/privacy" className="underline-offset-4 hover:underline">{copy.privacy}</Link>
        <Link href="/terms" className="underline-offset-4 hover:underline">{copy.terms}</Link>
      </p>
    </main>
  );
}
