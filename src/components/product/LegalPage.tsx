import Link from "next/link";
import { BRAND } from "@/lib/brand";

/** Plain, readable legal page (server component). */
export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: { heading: string; body: string[] }[];
}) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/welcome" className="text-sm font-medium text-sea-700">
        → {BRAND.name}
      </Link>
      <h1 className="mt-4 font-display text-3xl font-normal text-ink-900">{title}</h1>
      <p className="mt-1 text-sm text-ink-500">עודכן לאחרונה: {updated}</p>
      <div className="mt-8 space-y-7">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-xl font-medium text-ink-900">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-2 leading-relaxed text-ink-700">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
