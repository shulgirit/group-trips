"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
} from "firebase/storage";
import { uploadToTrip } from "@/lib/firebase/upload";
import {
  BedDouble,
  ChevronDown,
  FileImage,
  FileText,
  Loader2,
  Lock,
  Paperclip,
  Plane,
  Sparkles,
  Ticket,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { db, signInWithGoogle, storage } from "@/lib/firebase/client";
import { useTrip } from "@/components/providers/TripProvider";
import { BookingImporter } from "@/components/creator/BookingImporter";
import type { TripDocument } from "@/types";
import { STROKE } from "@/components/ui/Icon";
import { useLocale, useT, type TKey } from "@/i18n";
import { intlLocale } from "@/i18n/format";

const MAX_FILE_MB = 20;

type DocKind = "flight" | "ticket" | "stay" | "pdf" | "image" | "file";

const KIND: Record<DocKind, { Icon: LucideIcon; label: TKey }> = {
  flight: { Icon: Plane, label: "money.docs.kind.flight" },
  ticket: { Icon: Ticket, label: "money.docs.kind.ticket" },
  stay: { Icon: BedDouble, label: "money.docs.kind.stay" },
  pdf: { Icon: FileText, label: "money.docs.kind.pdf" },
  image: { Icon: FileImage, label: "money.docs.kind.image" },
  file: { Icon: Paperclip, label: "money.docs.kind.file" },
};

/** Guess what a file is from its name first (boarding pass, hotel…), then its type. */
function docKind(document_: TripDocument): DocKind {
  const name = document_.name.toLowerCase();
  if (/boarding|flight|airline|e-?ticket|itinerary|טיסה|עליה למטוס|vuelo|embarque|رحلة|طيران/.test(name))
    return "flight";
  if (/hotel|booking|airbnb|villa|hostel|apartment|resort|מלון|וילה|לינה|דירה|alojamiento|فندق/.test(name))
    return "stay";
  if (/ticket|tour|museum|entry|\bpass\b|כרטיס|כניסה|entrada|تذكرة/.test(name))
    return "ticket";
  if (document_.contentType.startsWith("image/")) return "image";
  if (document_.contentType.includes("pdf")) return "pdf";
  return "file";
}

/** File name without its extension, for the pass title. */
function displayName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function formatSize(bytes: number): string {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1_000))}KB`;
}

const CARD_SHADOW =
  "shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)]";

export default function DocumentsPage() {
  const { ready, user, personal, epoch } = useFirebase();
  const { path: tripPath, id: tripId } = useTrip();
  const t = useT();
  const { locale } = useLocale();
  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState<"shared" | "private">("shared");
  const [sharedDocs, setSharedDocs] = useState<TripDocument[] | null>(null);
  const [myDocs, setMyDocs] = useState<TripDocument[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Shared documents
  useEffect(() => {
    if (!ready || !user) return;
    return onSnapshot(
      query(
        collection(db(), `${tripPath}/documents`),
        where("visibility", "==", "shared")
      ),
      (snap) =>
        setSharedDocs(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as TripDocument)
            .sort((a, b) => b.createdAt - a.createdAt)
        ),
      () => setSharedDocs([])
    );
  }, [ready, user, epoch]);

  // My documents (only meaningful with a personal identity)
  useEffect(() => {
    if (!ready || !user || !personal) {
      setMyDocs([]);
      return;
    }
    return onSnapshot(
      query(
        collection(db(), `${tripPath}/documents`),
        where("ownerUid", "==", user.uid)
      ),
      (snap) =>
        setMyDocs(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as TripDocument)
            .filter((d) => d.visibility === "private")
            .sort((a, b) => b.createdAt - a.createdAt)
        ),
      () => setMyDocs([])
    );
  }, [ready, user, personal, epoch]);

  async function handleGoogleSignIn() {
    setMessage("");
    try {
      await signInWithGoogle();
    } catch {
      setMessage(t("money.docs.errors.signIn"));
    }
  }

  async function handleUpload(file: File) {
    if (!user) return;
    if (file.size > MAX_FILE_MB * 1_000_000) {
      setMessage(t("money.docs.errors.tooLarge", { max: MAX_FILE_MB }));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const visibility = tab;
      const path = `${tripPath}/documents/${visibility}/${user.uid}/${Date.now()}-${file.name}`;
      await uploadToTrip(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      await addDoc(collection(db(), `${tripPath}/documents`), {
        name: file.name,
        ownerUid: user.uid,
        ownerName: user.displayName ?? t("money.docs.someone"),
        visibility,
        storagePath: path,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        createdAt: Date.now(),
      });
    } catch {
      setMessage(t("money.docs.errors.upload"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function openDocument(document_: TripDocument) {
    setOpeningId(document_.id);
    try {
      const url = await getDownloadURL(
        storageRef(storage(), document_.storagePath)
      );
      window.open(url, "_blank", "noopener");
    } catch {
      setMessage(t("money.docs.errors.open"));
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDelete(document_: TripDocument) {
    setDeletingId(null);
    try {
      await deleteDoc(doc(db(), `${tripPath}/documents/${document_.id}`));
      await deleteObject(storageRef(storage(), document_.storagePath)).catch(
        () => undefined
      );
    } catch {
      setMessage(t("money.docs.errors.delete"));
    }
  }

  const documents = tab === "shared" ? sharedDocs : myDocs;
  const canUpload = tab === "shared" ? Boolean(user) : personal;
  const dateFormat = new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="kicker text-ink-500">{t("money.docs.kicker")}</p>
        <h1 className="mt-1 font-display text-3xl font-light text-ink-900">
          {t("money.docs.title")}
        </h1>
      </div>

      {/* Booking import: AI reads a confirmation into the plan */}
      {personal && (
        <section className={`overflow-hidden rounded-2xl bg-white ${CARD_SHADOW}`}>
          <button
            type="button"
            onClick={() => setImporting((open) => !open)}
            aria-expanded={importing}
            aria-controls="booking-import"
            className="flex min-h-[72px] w-full items-center gap-4 px-4 py-4 text-start transition active:bg-cream-100/60"
          >
            <span
              aria-hidden
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brass-100 text-brass-600"
            >
              <Sparkles size={20} strokeWidth={STROKE} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-medium text-ink-900">
                {t("money.docs.importCardTitle")}
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-ink-500">
                {t("money.docs.importCardHint")}
              </span>
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream-100 text-ink-700">
              <ChevronDown
                size={18}
                strokeWidth={STROKE}
                aria-hidden
                className={`transition-transform ${importing ? "rotate-180" : ""}`}
              />
              <span className="sr-only">
                {importing ? t("common.close") : t("money.docs.open")}
              </span>
            </span>
          </button>
          {importing && (
            <div id="booking-import" className="border-t border-cream-200 px-4 py-4">
              <BookingImporter tripId={tripId} compact />
            </div>
          )}
        </section>
      )}

      {/* Shared / private */}
      <div
        role="tablist"
        aria-label={t("money.docs.title")}
        className="flex gap-1 rounded-2xl border border-cream-200 bg-white p-1"
      >
        {(
          [
            { id: "shared", label: t("money.docs.tabShared"), list: sharedDocs },
            { id: "private", label: t("money.docs.tabPrivate"), list: personal ? myDocs : null },
          ] as const
        ).map(({ id, label, list }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setDeletingId(null);
            }}
            className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-2 text-sm font-medium transition ${
              tab === id ? "bg-sea-900 text-cream-50" : "text-ink-500"
            }`}
          >
            {id === "private" && <Lock size={14} strokeWidth={STROKE} aria-hidden />}
            {label}
            {list && list.length > 0 && (
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${
                  tab === id ? "bg-cream-50/15" : "bg-cream-100"
                }`}
              >
                {list.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "private" && !personal ? (
        <div className={`rounded-2xl bg-white px-6 py-8 text-center ${CARD_SHADOW}`}>
          <span
            aria-hidden
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-cream-200 text-ink-700"
          >
            <Lock size={20} strokeWidth={STROKE} />
          </span>
          <p className="mt-4 font-display text-xl text-ink-900">
            {t("money.docs.privateNeedsSignIn")}
          </p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-500">
            {t("money.docs.privateExplain")}
          </p>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="btn-primary mt-6 px-6 py-3"
          >
            {t("money.docs.signInGoogle")}
          </button>
          {message && (
            <p role="alert" className="mt-4 text-sm text-terra-600">
              {message}
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Upload: the page's primary action */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <label
              className={`btn-primary min-h-12 cursor-pointer px-5 py-3 text-base focus-within:ring-2 focus-within:ring-sea-300 sm:w-auto ${
                !canUpload || uploading ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                disabled={!canUpload || uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
              {uploading ? (
                <Loader2 size={18} strokeWidth={STROKE} aria-hidden className="animate-spin" />
              ) : (
                <Upload size={18} strokeWidth={STROKE} aria-hidden />
              )}
              {uploading
                ? t("money.docs.uploading")
                : tab === "shared"
                  ? t("money.docs.uploadShared")
                  : t("money.docs.uploadPrivate")}
            </label>
            <p className="text-center text-xs text-ink-500 sm:text-start">
              {t("money.docs.uploadHint", { max: MAX_FILE_MB })}
            </p>
          </div>

          {message && (
            <p
              role="alert"
              className="rounded-2xl border border-terra-200 bg-terra-100 px-4 py-2.5 text-sm text-terra-600"
            >
              {message}
            </p>
          )}

          {/* Wallet */}
          {documents === null ? (
            <ListSkeleton rows={2} />
          ) : documents.length === 0 ? (
            <EmptyState
              icon={tab === "shared" ? Ticket : Lock}
              title={
                tab === "shared"
                  ? t("money.docs.emptySharedTitle")
                  : t("money.docs.emptyPrivateTitle")
              }
              description={
                tab === "shared"
                  ? t("money.docs.emptySharedDescription")
                  : t("money.docs.emptyPrivateDescription")
              }
            />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {documents.map((document_) => {
                const kind = KIND[docKind(document_)];
                const KindIcon = kind.Icon;
                const mine = user?.uid === document_.ownerUid;
                const confirming = deletingId === document_.id;
                return (
                  <li
                    key={document_.id}
                    className={`relative flex overflow-hidden rounded-2xl bg-white ${CARD_SHADOW}`}
                  >
                    <button
                      type="button"
                      onClick={() => openDocument(document_)}
                      aria-label={t("money.docs.openFile", { name: document_.name })}
                      className="flex min-w-0 flex-1 items-stretch text-start transition active:bg-cream-100/60"
                    >
                      {/* Stub */}
                      <span className="flex w-[72px] shrink-0 flex-col items-center justify-center gap-1.5 bg-sea-900 py-4 text-cream-50">
                        {openingId === document_.id ? (
                          <Loader2 size={22} strokeWidth={STROKE} aria-hidden className="animate-spin" />
                        ) : (
                          <KindIcon size={22} strokeWidth={STROKE} aria-hidden />
                        )}
                        <span className="px-1 text-center text-xs leading-tight text-cream-50/80">
                          {t(kind.label)}
                        </span>
                      </span>
                      {/* Perforation */}
                      <span aria-hidden className="relative w-0 shrink-0 border-s border-dashed border-cream-300">
                        <span className="absolute -top-2 -start-2 h-4 w-4 rounded-full bg-cream-50" />
                        <span className="absolute -bottom-2 -start-2 h-4 w-4 rounded-full bg-cream-50" />
                      </span>
                      {/* Body */}
                      <span className="min-w-0 flex-1 px-4 py-3.5">
                        <span className="block truncate text-[17px] font-medium text-ink-900">
                          <bdi>{displayName(document_.name)}</bdi>
                        </span>
                        <span className="mt-1 block truncate text-sm text-ink-500">
                          <bdi>{document_.ownerName}</bdi>
                        </span>
                        <span className="mt-1.5 flex items-center gap-2 text-xs text-ink-400">
                          <span className="tabular-nums">
                            {dateFormat.format(new Date(document_.createdAt))}
                          </span>
                          <span aria-hidden>·</span>
                          <span dir="ltr" className="tabular-nums">
                            {formatSize(document_.size)}
                          </span>
                        </span>
                      </span>
                    </button>
                    {mine && (
                      <div className="flex shrink-0 flex-col items-center justify-center gap-1 pe-2">
                        {confirming ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDelete(document_)}
                              className="btn-danger min-h-9 px-3 py-1.5 text-xs"
                            >
                              {t("money.confirmDelete")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              className="min-h-9 px-2 text-xs text-ink-500"
                            >
                              {t("common.cancel")}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingId(document_.id)}
                            aria-label={t("common.delete")}
                            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-300 transition hover:text-terra-600"
                          >
                            <Trash2 size={17} strokeWidth={STROKE} aria-hidden />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {tab === "shared" && !personal && user && (
            <button
              type="button"
              onClick={() => setTab("private")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cream-200 px-4 py-3 text-sm text-ink-500"
            >
              <Lock size={14} strokeWidth={STROKE} aria-hidden className="shrink-0" />
              {t("money.docs.wantPrivate")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
