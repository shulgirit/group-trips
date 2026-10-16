"use client";

import { useRef, useState } from "react";
import { uploadToTrip } from "@/lib/firebase/upload";
import {
  BedDouble,
  CarFront,
  Check,
  ClipboardPaste,
  FileText,
  FileUp,
  Loader2,
  MapPin,
  Plane,
  Ticket,
  Trash2,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import { tActive } from "@together/i18n/active";
import { apiFetch, auth } from "@/lib/firebase/client";
import type { BookingItem } from "@together/shared/booking";

const KIND_ICON: Record<BookingItem["kind"], LucideIcon> = {
  flight: Plane,
  lodging: BedDouble,
  car: CarFront,
  activity: Ticket,
  restaurant: Utensils,
  other: MapPin,
};

interface PendingImport {
  key: string;
  label: string;
  status: "uploading" | "reading" | "review" | "applying" | "applied" | "failed";
  importId?: string;
  items: (BookingItem & { include: boolean })[];
  message?: string;
}

function itemWhen(item: BookingItem) {
  if (!item.startDate) return tActive("creator.booking.noDate");
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
  const t = useT();
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
              ? t("creator.booking.errors.unsupported")
              : result.error === "quota_exceeded"
                ? t("creator.booking.errors.quota")
                : t("creator.booking.errors.unreadable"),
        });
        return;
      }
      const items = (result.items as BookingItem[]).map((item) => ({ ...item, include: true }));
      patch(key, {
        status: items.length ? "review" : "failed",
        importId: result.id,
        items,
        message: items.length ? undefined : t("creator.booking.errors.noneFound"),
      });
    } catch {
      patch(key, { status: "failed", message: t("creator.booking.errors.network") });
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
        patch(key, { status: "failed", message: t("creator.booking.errors.tooBig") });
        continue;
      }
      try {
        const safeName = file.name.replace(/[^\w.\-א-ת]+/g, "_").slice(-80);
        const storagePath = `trips/${tripId}/imports/${uid}/${Date.now()}-${safeName}`;
        await uploadToTrip(storagePath, file, {
          contentType: file.type || "application/octet-stream",
        });
        await extract(key, { storagePath, fileName: file.name });
      } catch {
        patch(key, { status: "failed", message: t("creator.booking.errors.uploadFailed") });
      }
    }
  }

  async function handleText() {
    if (!text.trim()) return;
    const key = `text-${Date.now()}`;
    setImports((current) => [
      ...current,
      { key, label: t("creator.booking.pastedLabel"), status: "reading", items: [] },
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
        message:
          t("creator.booking.applied", { count: summary.events }) +
          (summary.places ? t("creator.booking.appliedPlaces", { count: summary.places }) : "") +
          (summary.homeBase ? t("creator.booking.appliedHome") : ""),
      });
      onApplied?.(summary);
    } catch {
      patch(entry.key, { status: "review", message: t("creator.booking.errors.saveFailed") });
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
          className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-cream-300 bg-white px-4 py-7 text-center transition hover:border-route-300 active:scale-[0.99]"
        >
          <FileUp size={24} strokeWidth={STROKE} aria-hidden className="text-route-500" />
          <span className="font-medium text-ink-900">{t("creator.booking.upload.title")}</span>
          <span className="text-xs text-ink-500">{t("creator.booking.upload.text")}</span>
        </button>
        <button
          type="button"
          onClick={() => setPasting((open) => !open)}
          className={`flex flex-col items-center gap-2 rounded-2xl border bg-white px-4 py-7 text-center transition hover:border-route-300 active:scale-[0.99] ${pasting ? "border-route-500" : "border-chart-200"}`}
        >
          <ClipboardPaste size={24} strokeWidth={STROKE} aria-hidden className="text-route-500" />
          <span className="font-medium text-ink-900">{t("creator.booking.paste.title")}</span>
          <span className="text-xs text-ink-500">{t("creator.booking.paste.text")}</span>
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
            placeholder={t("creator.booking.paste.placeholder")}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button type="button" onClick={handleText} disabled={!text.trim()} className="btn-primary w-full py-3">
            {t("creator.booking.paste.read")}
          </button>
        </div>
      )}

      {imports.map((entry) => (
        <div key={entry.key} className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-cream-200/70 px-4 py-3">
            {entry.status === "uploading" || entry.status === "reading" || entry.status === "applying" ? (
              <Loader2 size={20} strokeWidth={STROKE} aria-hidden className="animate-spin text-route-500" />
            ) : entry.status === "applied" ? (
              <Check size={20} strokeWidth={STROKE} aria-hidden className="text-route-500" />
            ) : (
              <FileText size={20} strokeWidth={STROKE} aria-hidden className="text-ink-500" />
            )}
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">{entry.label}</p>
            <span className="shrink-0 text-xs text-ink-500">
              {entry.status === "uploading"
                ? t("creator.booking.status.uploading")
                : entry.status === "reading"
                  ? t("creator.booking.status.reading")
                  : entry.status === "applying"
                    ? t("creator.booking.status.applying")
                    : ""}
            </span>
          </div>
          {entry.status === "review" && (
            <div className="space-y-3 px-4 py-3">
              <ul className="space-y-2">
                {entry.items.map((item, index) => {
                  const KindIcon = KIND_ICON[item.kind] ?? MapPin;
                  return (
                    <li
                      key={index}
                      className={`rounded-2xl border px-3 py-2.5 transition ${item.include ? "border-chart-200 bg-white" : "border-chart-200 bg-cream-50 opacity-60"}`}
                    >
                      <div className="flex items-center gap-2">
                        <KindIcon size={18} strokeWidth={STROKE} aria-hidden className="shrink-0 text-route-500" />
                        <input
                          className="min-w-0 flex-1 bg-transparent font-medium text-ink-900 outline-none"
                          value={item.title}
                          onChange={(event) => updateItem(entry.key, index, { title: event.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => updateItem(entry.key, index, { include: !item.include })}
                          aria-label={item.include ? t("creator.booking.exclude") : t("creator.booking.include")}
                          className="-me-2 flex h-10 w-10 shrink-0 items-center justify-center text-ink-400"
                        >
                          {item.include ? (
                            <Trash2 size={16} strokeWidth={STROKE} aria-hidden />
                          ) : (
                            <Check size={16} strokeWidth={STROKE} aria-hidden />
                          )}
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
                        <span>{t(`creator.booking.kinds.${item.kind}`)}</span>
                        {item.flightNumber && <span dir="ltr">{item.flightNumber}</span>}
                        {item.confirmationCode && <span dir="ltr">#{item.confirmationCode}</span>}
                      </div>
                      {(item.location || item.notes) && (
                        <p className="mt-1 line-clamp-2 text-xs text-ink-500">
                          {[item.location, item.notes].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {!item.startDate && (
                        <p className="mt-1 text-xs italic text-ink-500">
                          {t("creator.booking.placeOnly", { when: itemWhen(item) })}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => apply(entry)}
                disabled={!entry.items.some((i) => i.include)}
                className="btn-primary w-full py-3"
              >
                {t("creator.booking.add", { count: entry.items.filter((i) => i.include).length })}
              </button>
            </div>
          )}
          {entry.message && (
            <p
              className={`px-4 py-3 text-sm ${entry.status === "failed" ? "text-terra-600" : "text-route-700"}`}
            >
              {entry.message}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
