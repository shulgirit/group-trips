"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
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
  uploadBytes,
} from "firebase/storage";
import { useFirebase } from "@/components/providers/FirebaseProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  auth,
  db,
  isPersonalUser,
  signInWithGoogle,
  storage,
} from "@/lib/firebase/client";
import { TRIP_PATH } from "@/lib/hooks";
import type { TripDocument } from "@/types";

const MAX_FILE_MB = 20;

function fileEmoji(contentType: string): string {
  if (contentType.startsWith("image/")) return "🖼️";
  if (contentType.includes("pdf")) return "📄";
  return "📎";
}

function formatSize(bytes: number): string {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1_000))}KB`;
}

export default function DocumentsPage() {
  const { ready } = useFirebase();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<"shared" | "private">("shared");
  const [sharedDocs, setSharedDocs] = useState<TripDocument[] | null>(null);
  const [myDocs, setMyDocs] = useState<TripDocument[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const personal = isPersonalUser(user);

  useEffect(() => {
    if (!ready) return;
    return onAuthStateChanged(auth(), setUser);
  }, [ready]);

  // Shared documents
  useEffect(() => {
    if (!ready || !user) return;
    return onSnapshot(
      query(
        collection(db(), `${TRIP_PATH}/documents`),
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
  }, [ready, user]);

  // My documents (only meaningful with a personal identity)
  useEffect(() => {
    if (!ready || !user || !personal) {
      setMyDocs([]);
      return;
    }
    return onSnapshot(
      query(
        collection(db(), `${TRIP_PATH}/documents`),
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
  }, [ready, user, personal]);

  async function handleGoogleSignIn() {
    setMessage("");
    try {
      await signInWithGoogle();
    } catch {
      setMessage(
        "ההתחברות לא הושלמה — ודאו שחלונות קופצים מותרים ונסו שוב"
      );
    }
  }

  async function handleUpload(file: File) {
    if (!user) return;
    if (file.size > MAX_FILE_MB * 1_000_000) {
      setMessage(`הקובץ גדול מדי (עד ${MAX_FILE_MB}MB)`);
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const visibility = tab;
      const path = `${TRIP_PATH}/documents/${visibility}/${user.uid}/${Date.now()}-${file.name}`;
      await uploadBytes(storageRef(storage(), path), file, {
        contentType: file.type || "application/octet-stream",
      });
      await addDoc(collection(db(), `${TRIP_PATH}/documents`), {
        name: file.name,
        ownerUid: user.uid,
        ownerName: user.displayName ?? "מישהו מהקבוצה",
        visibility,
        storagePath: path,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        createdAt: Date.now(),
      });
    } catch {
      setMessage("ההעלאה נכשלה, נסו שוב");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function openDocument(document_: TripDocument) {
    try {
      const url = await getDownloadURL(
        storageRef(storage(), document_.storagePath)
      );
      window.open(url, "_blank", "noopener");
    } catch {
      setMessage("לא הצלחנו לפתוח את הקובץ");
    }
  }

  async function handleDelete(document_: TripDocument) {
    setDeletingId(null);
    try {
      await deleteDoc(doc(db(), `${TRIP_PATH}/documents/${document_.id}`));
      await deleteObject(storageRef(storage(), document_.storagePath)).catch(
        () => undefined
      );
    } catch {
      setMessage("המחיקה נכשלה");
    }
  }

  const documents = tab === "shared" ? sharedDocs : myDocs;
  const canUpload = tab === "shared" ? Boolean(user) : personal;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-ink-900">
        🎟️ הזמנות ומסמכים
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl bg-cream-100 p-1">
        {(
          [
            { id: "shared", label: "משותף לכולם" },
            { id: "private", label: "האזור האישי שלי" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
              tab === id ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "private" && !personal ? (
        <div className="rounded-3xl border border-sea-200 bg-sea-100/50 p-5 text-center">
          <p className="text-lg font-semibold text-ink-900">
            האזור האישי דורש התחברות
          </p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-500">
            מסמכים אישיים (דרכונים, כרטיסים אישיים) גלויים רק לכם — בשביל זה
            צריך זהות אישית
          </p>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="mt-4 rounded-2xl bg-sea-600 px-5 py-3 font-semibold text-cream-50 transition active:scale-[0.98]"
          >
            התחברות עם Google
          </button>
        </div>
      ) : (
        <>
          {/* Upload */}
          <label
            className={`block rounded-3xl border-2 border-dashed px-4 py-5 text-center transition ${
              uploading
                ? "border-cream-300 opacity-60"
                : "border-sea-200 active:bg-sea-100/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              disabled={!canUpload || uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <span className="text-2xl" aria-hidden>
              {uploading ? "⏳" : "⬆️"}
            </span>
            <p className="mt-1 font-medium text-ink-900">
              {uploading
                ? "מעלה…"
                : tab === "shared"
                  ? "העלאת קובץ משותף"
                  : "העלאת קובץ אישי"}
            </p>
            <p className="text-xs text-ink-500">
              PDF, תמונות וכל קובץ עד {MAX_FILE_MB}MB
            </p>
          </label>

          {message && (
            <p
              role="alert"
              className="rounded-2xl bg-terra-100 px-4 py-2.5 text-sm font-medium text-terra-600"
            >
              {message}
            </p>
          )}

          {/* List */}
          {documents === null ? (
            <ListSkeleton rows={2} />
          ) : documents.length === 0 ? (
            <EmptyState
              emoji={tab === "shared" ? "🎟️" : "🔒"}
              title={tab === "shared" ? "אין עדיין מסמכים משותפים" : "האזור האישי ריק"}
              description={
                tab === "shared"
                  ? "כרטיסי טיסה, אישור הוילה, ביטוחים — הכל במקום אחד במקום לחפש בוואטסאפ"
                  : "רק אתם רואים את מה שמועלה כאן"
              }
            />
          ) : (
            <ul className="space-y-2">
              {documents.map((document_) => (
                <li
                  key={document_.id}
                  className="flex items-center gap-3 rounded-3xl border border-cream-200 bg-white px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => openDocument(document_)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-right"
                  >
                    <span className="text-2xl" aria-hidden>
                      {fileEmoji(document_.contentType)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-900">
                        {document_.name}
                      </span>
                      <span className="block text-xs text-ink-500">
                        {document_.ownerName} · {formatSize(document_.size)}
                      </span>
                    </span>
                  </button>
                  {user?.uid === document_.ownerUid &&
                    (deletingId === document_.id ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(document_)}
                        className="rounded-xl bg-terra-600 px-2.5 py-2 text-xs font-semibold text-cream-50"
                      >
                        למחוק
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(document_.id)}
                        aria-label="מחיקה"
                        className="text-ink-300"
                      >
                        🗑️
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          )}

          {tab === "shared" && !personal && user && (
            <p className="text-center text-sm text-ink-500">
              💡 רוצים גם אזור אישי? עברו לטאב ״האזור האישי שלי״ והתחברו עם
              Google
            </p>
          )}
        </>
      )}
    </div>
  );
}
