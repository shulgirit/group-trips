import { z } from "zod";
import { PLACE_CATEGORIES } from "@/types";

const optionalTrimmed = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : undefined))
  .optional();

const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : undefined))
  .optional()
  .refine((value) => !value || /^https?:\/\//.test(value), {
    message: "קישור לא תקין",
  });

export const PlaceInputSchema = z.object({
  name: z.string().trim().min(1, "חסר שם"),
  category: z.enum(
    Object.keys(PLACE_CATEGORIES) as [string, ...string[]]
  ),
  area: optionalTrimmed,
  address: optionalTrimmed,
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  website: optionalUrl,
  bookingUrl: optionalUrl,
  imageUrl: optionalUrl,
  summary: optionalTrimmed,
  openingHours: optionalTrimmed,
  priceNotes: optionalTrimmed,
  recommendedDurationMin: z.number().int().positive().nullable().optional(),
  tips: optionalTrimmed,
  reviewsSummary: optionalTrimmed,
  popularDishes: optionalTrimmed,
  sourceUrl: optionalUrl,
});

export type PlaceInput = z.infer<typeof PlaceInputSchema>;

export const ParticipantsSchema = z.union([
  z.object({ type: z.literal("all") }),
  z.object({
    type: z.literal("families"),
    familyIds: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal("members"),
    memberIds: z.array(z.string()).min(1),
  }),
]);

export const EventInputSchema = z.object({
  title: z.string().trim().min(1, "חסר שם לאירוע"),
  emoji: optionalTrimmed,
  placeId: z.string().nullable().optional(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMin: z.number().int().positive().nullable().optional(),
  participants: ParticipantsSchema,
  notes: optionalTrimmed,
});

export type EventInput = z.infer<typeof EventInputSchema>;

export const ExpenseInputSchema = z.object({
  payerFamilyId: z.string().min(1),
  description: z.string().trim().min(1, "חסר תיאור"),
  amount: z.number().positive("סכום לא תקין"),
  currency: z.enum(["EUR", "ILS"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  participantFamilyIds: z.array(z.string()).min(1).nullable(),
});

export type ExpenseInput = z.infer<typeof ExpenseInputSchema>;

export const PollInputSchema = z.object({
  question: z.string().trim().min(1, "חסרה שאלה"),
  options: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().trim().min(1),
        placeId: z.string().nullable().optional(),
      })
    )
    .min(2, "צריך לפחות שתי אפשרויות"),
});

export type PollInput = z.infer<typeof PollInputSchema>;
