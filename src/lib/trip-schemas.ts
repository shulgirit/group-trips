import { z } from "zod";

/** Payloads of the trip creator — validated on the server, typed on the client. */

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const DestinationSchema = z.object({
  label: z.string().trim().min(1).max(80),
  placeId: z.string().max(300).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  region: z.string().trim().max(80),
  country: z.string().trim().max(80).optional(),
});

export const FamilyInputSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().trim().min(1).max(40),
  members: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]{2,40}$/),
        name: z.string().trim().min(1).max(30),
        kid: z.boolean().optional(),
        age: z.number().int().min(0).max(120).nullable().optional(),
      })
    )
    .min(1)
    .max(15),
});

export const AiInputSchema = z.object({
  name: z.string().trim().min(1).max(30),
  emoji: z.string().trim().min(1).max(16),
  preset: z.enum(["butler", "pilot", "buddy", "guide", "custom"]),
  rules: z.array(z.string().max(20)).max(12),
  customRules: z.string().max(1500),
});

export const HomeBaseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(240),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

export const TripInputSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    emoji: z.string().trim().min(1).max(16),
    destination: DestinationSchema,
    startDate: IsoDate,
    endDate: IsoDate,
    timezone: z.string().max(60),
    currency: z.enum(["EUR", "ILS", "USD"]),
    coverImage: z.string().url().nullable(),
    departureAt: z.string().max(40).nullable().optional(),
    departureNote: z.string().max(120).optional(),
    homeBase: HomeBaseSchema.nullable(),
    groupKind: z.enum(["families", "friends", "couple", "other"]),
    groupName: z.string().trim().max(40),
    aboutUs: z.string().max(4000).optional(),
    families: z.array(FamilyInputSchema).max(20),
    ai: AiInputSchema,
    /** The organizer's own seat in the group */
    me: z
      .object({ familyId: z.string(), memberId: z.string() })
      .nullable()
      .optional(),
    status: z.enum(["draft", "active"]),
  })
  .refine((trip) => trip.endDate >= trip.startDate, {
    message: "end_before_start",
    path: ["endDate"],
  })
  .refine(
    (trip) => {
      const days =
        (Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86_400_000;
      return days <= 60;
    },
    { message: "trip_too_long", path: ["endDate"] }
  );

export type TripInput = z.infer<typeof TripInputSchema>;
export type FamilyInput = z.infer<typeof FamilyInputSchema>;

export const InviteCreateSchema = z.object({
  role: z.enum(["admin", "member", "kid"]).default("member"),
  familyId: z.string().nullable().optional(),
  /** days until expiry */
  days: z.number().int().min(1).max(90).default(30),
  maxUses: z.number().int().min(1).max(100).default(40),
});

export const RedeemSchema = z.object({
  code: z.string().regex(/^[a-z0-9]{6,16}$/),
  familyId: z.string().max(40).nullable().optional(),
  memberId: z.string().max(40).nullable().optional(),
});
