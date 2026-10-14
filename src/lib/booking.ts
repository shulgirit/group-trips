import { z } from "zod";

/** One reservation item extracted from a booking confirmation. */
export const BookingItemSchema = z.object({
  kind: z.enum(["flight", "lodging", "car", "activity", "restaurant", "other"]),
  title: z.string(),
  startDate: z.string(),
  startTime: z.string(),
  endDate: z.string(),
  endTime: z.string(),
  /** Place name or address (hotel, venue, pickup desk) */
  location: z.string(),
  city: z.string(),
  confirmationCode: z.string(),
  flightNumber: z.string(),
  from: z.string(),
  to: z.string(),
  travelers: z.array(z.string()),
  notes: z.string(),
});

export type BookingItem = z.infer<typeof BookingItemSchema>;

export interface BookingImport {
  id: string;
  fileName: string;
  storagePath: string | null;
  contentType: string;
  status: "processing" | "review" | "applied" | "failed";
  items: BookingItem[];
  createdBy: string;
  createdAt: number;
  error?: string;
}

/** Every reservation kind, in display order (labels/icons live in the UI). */
export const BOOKING_KINDS = BookingItemSchema.shape.kind.options;
