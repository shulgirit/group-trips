import AsyncStorage from "@react-native-async-storage/async-storage";
import { type CreatorState, DRAFT_KEY } from "@together/backend/creator";

/** The unfinished wizard state kept on this phone before the trip exists on the server. */
export async function readDraft(): Promise<CreatorState | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as CreatorState) : null;
  } catch {
    return null;
  }
}

export function writeDraft(state: CreatorState | null) {
  (state ? AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(state)) : AsyncStorage.removeItem(DRAFT_KEY)).catch(() => undefined);
}
