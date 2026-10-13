"use client";

import { useRef, useState } from "react";
import { ref, uploadBytes } from "firebase/storage";
import { Check, ClipboardPaste, FileUp, Loader2, Trash2 } from "lucide-react";
import { apiFetch, auth, storage } from "@/lib/firebase/client";
import { BOOKING_KIND, type BookingItem } from "@/lib/booking";

interface PendingImport {
  key: string;
  label: string;
  status: "uploading" | "reading" | "review" | "applying" | "applied" | "failed";
  importId?: string;
  items: (BookingItem & { include: boolean })[];
  message?: string;
}

function itemWhen(item: BookingItem) {
  if (!item.startDate) return "בלי תאריך";
  const [, m, d] = item.startDate.split("-");
  return `${Number(d)}.${Number(m)}${item.startTime ? ` · ${item.startTime}` : ""}`;
}

/**
 * Upload flight tickets / hotel / attraction confirmations (PDF, photo or
 * pasted email). The AI extracts each reservation; the user reviews and
 * confirms, then events, places and the home base are created.
 */
export function BookingImporter({
  tripId,
  onApplied,
  compact = false,
}: {
  tripId: string;
  onApplied?: (summary: { events: number; places: number; homeBase: boolean }) => void;
  compact?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [imports, setImports] = useState<PendingImport[]>([]);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");

  function patch(key: string, value: Partial<PendingImport>) {
    setImports((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, ...value } : entry))
    );
  }

  async function extract(key: string, body: Record<string, unknown>) {
    patch(key, { status: "reading" });
    try {
      const response = await apiFetch("/api/import/booking", {
        method: "POST",
        body: JSON.stringify({ tripId, ...body }),
      });
      const result = await response.json();
      if (!response.ok) {
        patch(key, {
          status: "failed",
          message:
            result.error === "unsupported_type"
              ? "סוג קובץ לא נתמך — PDF או תמונה"
              : result.error === "quota_exceeded"
                ? "הגעתם למכסת הייבוא החודשית"
                : "לא הצלחנו לקרוא את הקובץ",
        });
        return;
      }
      const items = (result.items as BookingItem[]).map((item) => ({ ...item, include: true }));
      patch(key, {
        status: items.length ? "review" : "failed",
        importId: result.id,
        items,
        message: items.length ? undefined : "לא מצאנו הזמנות במסמך הזה",
      });
    } catch {
      patch(key, { status: "failed", message: "שגיאת רשת — נסו שוב" });
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    // The storage rule reads the trip from the token's claims
    await auth().currentUser?.getIdToken(true).catch(() => undefined);
    for (const file of Array.from(files).slice(0, 8)) {
      const key = `${Date.now()}-${file.name}`;
      setImports((current) => [
        ...current,
        { key, label: file.name, status: "uploading", items: [] },
      ]);
      if (file.size > 15 * 1024 * 1024) {
        patch(key, { status: "failed", message: "הקובץ גדול מדי (עד 15MB)" });
        continue;
      }
      try {
        const safeName = file.name.replace(/[^\w.\-א-ת]+/g, "_").slice(-80);
        const storagePath = `trips/${tripId}/imports/${uid}/${Date.now()}-${safeName}`;
        await uploadBytes(ref(storage(), storagePath), file, {
          contentType: file.type || "application/octet-stream",
        });
        await extract(key, { storagePath, fileName: file.name });
      } catch {
        patch(key, { status: "failed", message: "ההעלאה נכשלה" });
      }
    }
  }

  async function handleText() {
    if (!text.trim()) return;
    const key = `text-${Date.now()}`;
    setImports((current) => [
      ...current,
      { key, label: "טקסט מהמייל", status: "reading", items: [] },
    ]);
    setPasting(false);
    const body = text;
    setText("");
    await extract(key, { text: body });
  }

  async function apply(entry: PendingImport) {
    patch(entry.key, { status: "applying" });
    try {
      const items = entry.items
        .filter((i) => i.include)
        .map((entryItem) => {
          const { include, ...item } = entryItem;
          void include;
          return item;
        });
      const response = await apiFetch("/api/import/booking/apply", {
        method: "POST",
        body: JSON.stringify({ tripId, importId: entry.importId, items }),
      });
      if (!response.ok) throw new Error();
      const summary = await response.json();
      patch(entry.key, {
        status: "applied",
        message: `נוספו ${summary.events} אירועים ללו״ז${summary.places ? ` ו-${summary.places} מקומות` : ""}${summary.homeBase ? " · הוגדר בית 🏡" : ""}`,
      });
      onApplied?.(summary);
    } catch {
      patch(entry.key, { status: "review", message: "השמירה נכשלה — נסו שוב" });
    }
  }

  function updateItem(entryKey: string, index: number, value: Partial<BookingItem & { include: boolean }>) {
    setImports((current) =>
      current.map((entry) =>
        entry.key === entryKey
          ? {
              ...entry,
              items: entry.items.map((item, i) => (i === index ? { ...item, ...value } : item)),
            }
          : entry
      )
    );
  }

  return (
    <div className="space-y-4">
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="card flex flex-col items-center gap-2 border-2 border-dashed border-sea-200 bg-sea-100/30 px-4 py-6 text-center transition active:scale-[0.99]"
        >
          <FileUp className="h-7 w-7 text-sea-700" />
          <span className="font-semibold text-ink-900">העלאת קבצים</span>
          <span className="text-xs text-ink-500">PDF או צילום מסך — כרטיסי טיסה, מלון, אטרקציות</span>
        </button>
        <button
          type="button"
          onClick={() => setPasting((open) => !open)}
          className="card flex flex-col items-center gap-2 px-4 py-6 text-center transition active:scale-[0.99]"
        >
          <ClipboardPaste className="h-7 w-7 text-terra-500" />
          <span className="font-semibold text-ink-900">הדבקה מהמייל</span>
          <span className="text-xs text-ink-500">מעתיקים את אישור ההזמנה ומדביקים</span>
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,image/*"
        multiple
        hidden
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {pasting && (
        <div className="space-y-2">
          <textarea
            className="field min-h-36 text-sm"
            placeholder="הדביקו כאן את תוכן המייל עם אישור ההזמנה…"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button type="button" onClick={handleText} disabled={!text.trim()} className="btn-primary w-full py-3">
            קריאת ההזמנה ✨
          </button>
        </div>
      )}

      {imports.map((entry) => (
        <div key={entry.key} className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-cream-200/70 px-4 py-3">
            {entry.status === "uploading" || entry.status === "reading" || entry.status === "applying" ? (
              <Loader2 className="h-5 w-5 animate-spin text-sea-600" />
            ) : entry.status === "applied" ? (
              <Check className="h-5 w-5 text-olive-500" />
            ) : (
              <span aria-hidden>📄</span>
            )}
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">{entry.label}</p>
            <span className="shrink-0 text-xs text-ink-500">
              {entry.status === "uploading"
                ? "מעלים…"
                : entry.status === "reading"
                  ? "ה-AI קורא…"
                  : entry.status === "applying"
                    ? "מוסיפים…"
                    : ""}
            </span>
          </div>
          {entry.status === "review" && (
            <div className="space-y-3 px-4 py-3">
              <ul className="space-y-2">
                {entry.items.map((item, index) => (
                  <li
                    key={index}
                    className={`rounded-2xl border px-3 py-2.5 transition ${item.include ? "border-sea-200 bg-white" : "border-cream-200 bg-cream-50 opacity-60"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden>
                        {BOOKING_KIND[item.kind].emoji}
                      </span>
                      <input
                        className="min-w-0 flex-1 bg-transparent font-semibold text-ink-900 outline-none"
                        value={item.title}
                        onChange={(event) => updateItem(entry.key, index, { title: event.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => updateItem(entry.key, index, { include: !item.include })}
                        aria-label={item.include ? "לא להוסיף" : "להוסיף"}
                        className="p-1 text-ink-300"
                      >
                        {item.include ? <Trash2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      <input
                        type="date"
                        className="rounded-lg bg-cream-100 px-2 py-1"
                        value={item.startDate}
                        onChange={(event) => updateItem(entry.key, index, { startDate: event.target.value })}
                      />
                      <input
                        type="time"
                        className="rounded-lg bg-cream-100 px-2 py-1"
                        value={item.startTime}
                        onChange={(event) => updateItem(entry.key, index, { startTime: event.target.value })}
                      />
                      <span>{BOOKING_KIND[item.kind].label}</span>
                      {item.flightNumber && <span dir="ltr">{item.flightNumber}</span>}
                      {item.confirmationCode && <span dir="ltr">#{item.confirmationCode}</span>}
                    </div>
                    {(item.location || item.notes) && (
                      <p className="mt-1 line-clamp-2 text-xs text-ink-500">
                        {[item.location, item.notes].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {!item.startDate && (
                      <p className="mt-1 text-xs text-terra-600">{itemWhen(item)} — יתווסף כמקום בלבד</p>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => apply(entry)}
                disabled={!entry.items.some((i) => i.include)}
                className="btn-primary w-full py-3"
              >
                הוספה לטיול ({entry.items.filter((i) => i.include).length})
              </button>
            </div>
          )}
          {entry.message && (
            <p
              className={`px-4 py-3 text-sm ${entry.status === "failed" ? "text-terra-600" : "text-olive-500"}`}
            >
              {entry.message}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
