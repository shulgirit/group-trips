import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { STROKE } from "@/components/ui/Icon";
import { requestLocale } from "@/i18n/server";
import { translate, type TKey } from "@/i18n/translate";
import { BRAND } from "@/lib/brand";

/** Plain, readable legal page (server component). Keys are translated here. */
export async function LegalPage({
  title,
  sections,
}: {
  title: TKey;
  sections: { heading: TKey; body: TKey[] }[];
}) {
  const locale = await requestLocale();
  const t = (key: TKey, vars?: Record<string, string>) => translate(locale, key, vars);
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/welcome"
        className="inline-flex items-center gap-2 text-sm font-medium text-sea-700"
      >
        <ArrowLeft size={16} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
        {BRAND.name}
      </Link>
      <h1 className="mt-6 font-display text-3xl font-light text-ink-900">{t(title)}</h1>
      <p className="mt-2 text-sm text-ink-500">
        {t("product.legal.updated", { date: t("product.legal.updatedDate") })}
      </p>
      <div className="mt-10 space-y-8 border-t border-cream-200 pt-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-lg font-normal text-ink-900">{t(section.heading)}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-2 leading-relaxed text-ink-700">
                {t(paragraph)}
              </p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
