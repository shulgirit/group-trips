import { getRandomValues } from "expo-crypto";

// Hermes has no Web Crypto; shared code (ids for trips, stops, people) needs
// crypto.getRandomValues. expo-crypto fills it from the platform CSPRNG.
const g = globalThis as { crypto?: { getRandomValues?: unknown } };
if (!g.crypto) g.crypto = {};
if (typeof g.crypto.getRandomValues !== "function") g.crypto.getRandomValues = getRandomValues;
