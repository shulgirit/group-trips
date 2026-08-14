export const PLACE_CATEGORIES = {
  attraction: { label: "אטרקציה", emoji: "🎡" },
  restaurant: { label: "מסעדה", emoji: "🍝" },
  beach: { label: "חוף", emoji: "🏖️" },
  icecream: { label: "גלידה", emoji: "🍦" },
  shopping: { label: "קניות", emoji: "🛍️" },
  supermarket: { label: "סופר", emoji: "🛒" },
  viewpoint: { label: "תצפית", emoji: "🌅" },
  parking: { label: "חניה", emoji: "🅿️" },
  accommodation: { label: "לינה", emoji: "🏡" },
  sport: { label: "ספורט", emoji: "⚽" },
  other: { label: "אחר", emoji: "📌" },
} as const;

export type PlaceCategory = keyof typeof PLACE_CATEGORIES;

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  area?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  website?: string;
  bookingUrl?: string;
  imageUrl?: string;
  /** Hebrew summary (often AI generated) */
  summary?: string;
  openingHours?: string;
  priceNotes?: string;
  recommendedDurationMin?: number | null;
  tips?: string;
  /** What reviewers say (AI-summarized from the web) */
  reviewsSummary?: string;
  /** For restaurants: dishes people recommend */
  popularDishes?: string;
  favorite?: boolean;
  sourceUrl?: string;
  createdAt?: number;
  createdBy?: string;
}

export type Participants =
  | { type: "all" }
  | { type: "families"; familyIds: string[] }
  | { type: "members"; memberIds: string[] };

export interface TripEvent {
  id: string;
  title: string;
  emoji?: string;
  placeId?: string | null;
  /** ISO date YYYY-MM-DD */
  day: string;
  /** HH:mm 24h */
  startTime: string;
  durationMin?: number | null;
  participants: Participants;
  notes?: string;
  createdAt?: number;
  createdByUid?: string;
  createdByName?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
}

export interface Family {
  id: string;
  name: string;
  /** accent color token for chips/avatars */
  color: string;
  members: FamilyMember[];
  order: number;
}

export interface Expense {
  id: string;
  payerFamilyId: string;
  description: string;
  amount: number;
  currency: "EUR" | "ILS";
  /** ISO date YYYY-MM-DD */
  date: string;
  /** null = all families participate */
  participantFamilyIds: string[] | null;
  createdAt?: number;
}

export interface PollOption {
  id: string;
  label: string;
  placeId?: string | null;
}

export interface PollVote {
  optionId: string;
  /** Voter display name, denormalized for the "who voted" view */
  name: string;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  /** voterUid -> vote (legacy entries may be a bare optionId string) */
  votes: Record<string, string | PollVote>;
  closed: boolean;
  /** The standing group poll, always shown first */
  pinned?: boolean;
  createdAt?: number;
}

export interface TripDocument {
  id: string;
  name: string;
  ownerUid: string;
  ownerName: string;
  visibility: "shared" | "private";
  storagePath: string;
  contentType: string;
  size: number;
  createdAt: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL: string;
  /** Which family member this Google account belongs to */
  familyId: string | null;
  memberId: string | null;
  createdAt: number;
}

export interface ChatCandidate {
  name: string;
  category: string;
  area?: string;
  description: string;
  why: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  priceNotes?: string;
  website?: string;
  imageUrl?: string;
  rating?: number;
  ratingCount?: number;
  savedPlaceId?: string;
  dismissed?: boolean;
  polled?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  candidates?: ChatCandidate[];
}

export interface ChatSession {
  id: string;
  ownerUid: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface TripSettings {
  name: string;
  startDate: string;
  endDate: string;
  currency: string;
  villa: {
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
  };
}
