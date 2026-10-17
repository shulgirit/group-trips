"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { STROKE } from "@/components/ui/Icon";
import { useT } from "@/i18n";
import { api } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import { convex } from "@/lib/convex";

/** Owner-only: delete a trip straight from My trips (same flow as Settings). */
export function DeleteTripButton({
  tripId,
  tripName,
  onDeleted,
  className = "",
  tone = "dark",
}: {
  tripId: string;
  tripName: string;
  onDeleted: () => void;
  className?: string;
  /** dark = over a cover photo, light = on a white row */
  tone?: "dark" | "light";
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function purge() {
    setError("");
    try {
      await convex.mutation(api.trips.remove, { tripId: tripId as Id<"trips"> });
      setOpen(false);
      onDeleted();
    } catch {
      setError(t("product.admin.deleteTripFailed"));
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={t("product.admin.deleteTrip")}
        onClick={() => setOpen(true)}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          tone === "dark"
            ? "bg-night-950/45 text-cream-50 backdrop-blur"
            : "text-ink-500 hover:bg-cream-100"
        } ${className}`}
      >
        <Trash2 size={18} strokeWidth={STROKE} aria-hidden />
      </button>
      <ConfirmDialog
        open={open}
        title={t("product.admin.deleteTripTitle", { name: tripName })}
        description={t("product.admin.deleteTripText")}
        items={[
          t("product.admin.deleteTripItems.content"),
          t("product.admin.deleteTripItems.files"),
          t("product.admin.deleteTripItems.chats"),
          t("product.admin.deleteTripItems.people"),
        ]}
        confirmWord={t("common.confirm.word")}
        confirmLabel={t("product.admin.deleteTrip")}
        error={error}
        onConfirm={purge}
        onClose={() => {
          setOpen(false);
          setError("");
        }}
      />
    </>
  );
}
