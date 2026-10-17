import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";
import type { ActionCtx, MutationCtx } from "./_generated/server";

// Durable, retried delivery through the Resend component. Test mode (only
// Resend-approved addresses receive mail) until RESEND_LIVE=1 is set.
export const resend = new Resend(components.resend, {
  testMode: process.env.RESEND_LIVE !== "1",
});

const FROM = process.env.AUTH_EMAIL_FROM ?? "Together <no-reply@togethergroup.app>";

const COPY = {
  he: { subject: "קוד הכניסה שלך ל-Together", lead: "הקוד שלך:", note: "הקוד בתוקף ל-5 דקות. אם לא ביקשת אותו, אפשר להתעלם." },
  en: { subject: "Your Together sign-in code", lead: "Your code:", note: "The code is valid for 5 minutes. If you didn't ask for it, ignore this email." },
  ar: { subject: "رمز الدخول إلى Together", lead: "رمزك:", note: "الرمز صالح لمدة 5 دقائق. إن لم تطلبه فتجاهل هذه الرسالة." },
  es: { subject: "Tu código para entrar en Together", lead: "Tu código:", note: "El código es válido durante 5 minutos. Si no lo pediste, ignora este correo." },
} as const;

export async function sendOtpEmail(
  ctx: MutationCtx | ActionCtx,
  { email, otp, locale }: { email: string; otp: string; locale?: string }
) {
  // Local development without Resend: opt-in only, never set on production
  if (process.env.AUTH_DEV_LOG_OTP === "1") {
    console.log(`[auth] sign-in code for ${email}: ${otp}`);
    return;
  }
  const lang = (locale && locale in COPY ? locale : "en") as keyof typeof COPY;
  const copy = COPY[lang];
  const dir = lang === "he" || lang === "ar" ? "rtl" : "ltr";
  await resend.sendEmail(ctx, {
    from: FROM,
    to: email,
    subject: copy.subject,
    html: `<div dir="${dir}" style="font-family:system-ui,sans-serif;font-size:16px;color:#0f1b2d">
<p>${copy.lead}</p>
<p style="font-size:32px;letter-spacing:6px;font-weight:600;font-family:ui-monospace,monospace" dir="ltr">${otp}</p>
<p style="color:#6b6a63;font-size:14px">${copy.note}</p></div>`,
    text: `${copy.lead} ${otp}\n\n${copy.note}`,
  });
}
