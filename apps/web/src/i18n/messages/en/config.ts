import type he from "../he/config";

const config: typeof he = {
  groupFallback: "The group",
  heroTitle: "{place} awaits",
  departureNote: "Departing · {start} – {end}",
  navHome: "Navigate home: {name}",
  signature: "{trip} · {group}",
  summarySuffix: " · {group}",
  ideasPoll: "The group's ideas poll",
  ai: {
    heroBlurb: "{name}, at your service: recommendations, scheduling, polls and place updates. Connected to all of the trip's details.",
    subtitle: "Knows the places, the schedule and the whole group",
    quickAdd: "Ask {name}",
    aboutTitle: "Tell {name} about us",
    aboutDescription:
      "Everything you write here becomes part of what {name} knows: who's who, ages, what everyone loves, inside jokes. It uses this in conversations and recommendations.",
    aboutPlaceholder: "For example: Noa is 9 and loves animals. Danny is crazy about street food...",
    aboutSaved: "Saved. {name} knows this now",
    inputPlaceholder: "Ask me anything about the trip…",
    prompts: {
      a: "Recommend an attraction",
      b: "What should we do tomorrow?",
      c: "Find a good restaurant nearby",
      d: "Plan us a perfect day",
      e: "Find a plan B if it rains",
      f: "What isn't on the schedule yet?",
    },
  },
  group: {
    splitPick: "Choose who took part",
    loading: "Loading…",
    quickLoginTitle: "Quick sign-in",
    quickLoginHint: "Ask the organizers to share the invite code",
    pickName: "And now, who are you?",
  },
  kinds: {
    families: {
      unitLabel: "Families",
      pageTitle: "The families",
      pickUnit: "Which family are you in?",
      splitEveryone: "Everyone took part (all families)",
    },
    friends: {
      unitLabel: "Friends",
      pageTitle: "The group",
      pickUnit: "Who are you?",
      splitEveryone: "Everyone took part (all friends)",
    },
    couple: {
      unitLabel: "Us",
      pageTitle: "Us",
      pickUnit: "Which of you is this?",
      splitEveryone: "Both of us took part",
    },
    other: {
      unitLabel: "Groups",
      pageTitle: "The group",
      pickUnit: "Which group are you in?",
      splitEveryone: "Everyone took part (all groups)",
    },
  },
};

export default config;
