"use client";

/* eslint-disable @next/next/no-img-element -- tiny local/storage avatars, no optimisation needed */
import { useRef, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { STROKE } from "@/components/ui/Icon";
import { useT, type TKey } from "@/i18n";
import { avatarSrc, BOT_AVATARS } from "@/lib/avatars";
import { auth, storage } from "@/lib/firebase/client";

/** Square-crops and shrinks an image on the device (384px JPEG). */
async function squareAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 384;
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 384, 384);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("compress_failed");
  return blob;
}

/**
 * The guide's face: one of the gallery robots, or an image the organizer
 * uploads (stored with the trip's photos, so only members can read it).
 */
export function AvatarPicker({
  tripId,
  value,
  onChange,
}: {
  tripId: string | null;
  value: string | null;
  onChange: (avatar: string | null) => void;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const uploaded = value && !value.startsWith("bot:") ? value : null;

  async function upload(file: File) {
    if (!tripId) return;
    setUploading(true);
    setError("");
    try {
      const blob = await squareAvatar(file);
      const uid = auth().currentUser?.uid ?? "anon";
      const fileRef = ref(storage(), `trips/${tripId}/photos/avatar/${uid}-${Date.now()}.jpg`);
      await uploadBytes(fileRef, blob, { contentType: "image/jpeg" });
      onChange(await getDownloadURL(fileRef));
    } catch {
      setError(t("creator.ai.avatar.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  const tile = (selected: boolean) =>
    `relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl transition active:scale-[0.97] ${
      selected ? "bg-night-950 ring-2 ring-brass-500 ring-offset-2 ring-offset-cream-50" : "bg-night-900"
    }`;

  return (
    <section className="space-y-2">
      <p className="text-sm font-medium text-ink-700">{t("creator.ai.avatar.title")}</p>
      <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-7">
        {BOT_AVATARS.map((id) => {
          const key = `bot:${id}`;
          const selected = value === key;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              aria-label={t(`creator.ai.avatar.bots.${id}` as TKey)}
              onClick={() => onChange(key)}
              className={tile(selected)}
            >
              <img src={avatarSrc(key)!} alt="" className="h-full w-full object-cover" />
              {selected && (
                <span className="absolute end-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brass-500 text-night-950">
                  <Check size={13} strokeWidth={2.5} aria-hidden />
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={Boolean(uploaded)}
          disabled={!tripId || uploading}
          onClick={() => fileRef.current?.click()}
          className={`${tile(Boolean(uploaded))} ${uploaded ? "" : "border border-dashed border-cream-300 !bg-white text-ink-500"}`}
        >
          {uploading ? (
            <Loader2 size={20} strokeWidth={STROKE} aria-hidden className="animate-spin" />
          ) : uploaded ? (
            <img src={uploaded} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 px-1 text-center text-xs leading-tight">
              <ImagePlus size={20} strokeWidth={STROKE} aria-hidden />
              {t("creator.ai.avatar.upload")}
            </span>
          )}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
          event.target.value = "";
        }}
      />
      <p className="text-xs text-ink-500">
        {value ? t(value.startsWith("bot:") ? (`creator.ai.avatar.bots.${value.slice(4)}` as TKey) : "creator.ai.avatar.yours") : t("creator.ai.avatar.hint")}
      </p>
      {error && <p className="text-sm text-terra-600">{error}</p>}
    </section>
  );
}
