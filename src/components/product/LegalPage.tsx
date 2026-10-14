import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { STROKE } from "@/components/ui/Icon";
import { requestLocale } from "@/i18n/server";
import { translate } from "@/i18n/translate";
import { BRAND } from "@/lib/brand";
import { LEGAL_DOCS, OPERATOR, type LegalBlock, type LegalDocKey } from "@/legal";

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return <p className="mt-3 leading-relaxed text-ink-700">{block}</p>;
  }
  return (
    <div className="mt-3">
      {block.lead && <p className="leading-relaxed text-ink-700">{block.lead}</p>}
      <ul className="mt-2 space-y-2 ps-5 text-ink-700">
        {block.list.map((item) => (
          <li key={item} className="list-disc leading-relaxed marker:text-lemon-500">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Privacy Policy / Terms of Use, in the reader's language (server component). */
export async function LegalPage({ doc: key }: { doc: LegalDocKey }) {
  const locale = await requestLocale();
  const doc = LEGAL_DOCS[key][locale];
  const other: LegalDocKey = key === "privacy" ? "terms" : "privacy";
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/welcome"
        className="inline-flex items-center gap-2 text-sm font-medium text-sea-700"
      >
        <ArrowLeft size={16} strokeWidth={STROKE} aria-hidden className="rtl:rotate-180" />
        {BRAND.name}
      </Link>
      <h1 className="mt-6 font-display text-3xl font-light text-ink-900">{doc.title}</h1>
      <p className="mt-2 text-sm text-ink-500">
        {translate(locale, "product.legal.updated", { date: OPERATOR.effectiveDate[locale] })}
      </p>
      <p className="mt-4 leading-relaxed text-ink-700">{doc.summary}</p>

      <nav
        aria-label={translate(locale, "product.legal.contents")}
        className="mt-8 rounded-2xl border border-cream-200 bg-white px-5 py-4"
      >
        <p className="kicker text-ink-500">{translate(locale, "product.legal.contents")}</p>
        <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
          {doc.sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-sea-700 underline-offset-4 hover:underline">
                {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10 border-t border-cream-200 pt-8">
        {doc.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-6">
            <h2 className="font-display text-lg font-medium text-ink-900">{section.heading}</h2>
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </section>
        ))}
      </div>

      <p className="mt-12 border-t border-cream-200 pt-6 text-sm text-ink-500">
        <Link href={`/${other}`} className="text-sea-700 underline-offset-4 hover:underline">
          {LEGAL_DOCS[other][locale].title}
        </Link>
      </p>
    </main>
  );
}
