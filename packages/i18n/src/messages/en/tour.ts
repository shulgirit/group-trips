import type he from "../he/tour";

const tour: typeof he = {
  row: {
    title: "Intro tour",
    description: "A one-minute look at everything the app can do",
  },
  dialogLabel: "App intro tour",
  skip: "Skip the tour",
  previous: "Previous",
  start: "Let's begin",
  sicily: {
    welcome: {
      kicker: "Micha's crew · Sicily 2026",
      title: "Welcome to our app",
      a: "The whole trip in one place, instead of digging through WhatsApp for addresses and decisions",
      b: "Whatever anyone adds, everyone sees instantly",
      c: "One minute of explanation and you'll be pros. Ready?",
    },
    home: {
      kicker: "Home screen",
      title: "Now: what's happening, what's next",
      a: "Before the trip: a countdown to the flight",
      b: "During the trip: the next activity, with the time, who's coming, and a button that opens Waze",
      c: "Below it: the whole day's schedule, marking where we are now",
    },
    places: {
      kicker: "Places tab",
      title: "Our attractions, restaurants and beaches",
      a: "Adding a place? Type the name freely (“Barbera stadium Palermo”) and the app finds it, photo and location included",
      b: "Have a website link? Paste it and the AI fills in the description, hours and prices",
      c: "Every place page has a button that adds more detail, so there's no need to leave the app",
    },
    calendar: {
      kicker: "Schedule tab",
      title: "The trip, day by day",
      a: "Tap any event to change its time, participants or text",
      b: "Splitting up? No problem. Some go to the match, some to dinner, and the schedule shows it",
      c: "About 45 minutes before each activity, everyone gets a reminder on their phone",
    },
    map: {
      kicker: "Map tab",
      title: "Everything on one map",
      a: "Our villa has a large pin, impossible to miss",
      b: "Tap any pin for a photo and details, and navigate in one tap",
    },
    polls: {
      kicker: "Polls (under More)",
      title: "Decide together, without the debate",
      a: "Everyone votes with one tap, and you can see who voted for what",
      b: "Next to each option: “Read about it”, with all the details",
      c: "Once it's decided, “Schedule it” puts it straight on the calendar",
    },
    expenses: {
      kicker: "Expenses (under More)",
      title: "Who paid and who owes",
      a: "Bought groceries? Log it in seconds and the app splits it between the families",
      b: "At the end of the trip, it settles automatically: who pays whom, and how much",
    },
    ai: {
      kicker: "The real magic",
      title: "The crew's butler",
      a: "An AI assistant that knows our whole trip. Just talk to it:",
      chips: {
        a: "“Recommend a kid-friendly restaurant in Palermo”",
        b: "“Add the hot springs tomorrow at 14:00”",
        c: "“Make a poll: what do we do on Tuesday?”",
        d: "“What's the plan for tomorrow?”",
      },
    },
    final: {
      kicker: "Three last steps",
      title: "To get the most out of it",
      a: "1. Add it to your home screen: tap Share, then “Add to Home Screen”, and it's a real app",
      b: "2. In Settings: turn on notifications for new polls and reminders",
      c: "3. In Settings: link yourself to your family, and vote in a single tap",
    },
  },
  sardinia: {
    welcome: {
      kicker: "The Sardinia squadron · Turning 60",
      title: "Welcome to the trip app",
      a: "The whole trip in one place, instead of digging through WhatsApp for addresses and decisions",
      b: "Whatever anyone adds, everyone sees instantly",
      c: "One minute of explanation and you're airborne. Ready?",
    },
    places: {
      a: "Restaurants, viewpoints, beaches and wineries, with photos, ratings and navigation",
    },
    expenses: {
      a: "Log any expense in seconds and the app splits it between friends",
      b: "At the end of the trip: one summary in shekels, and everyone settles up",
    },
    ai: {
      title: "The Pilot",
      chips: {
        a: "“Recommend a viewpoint on the way to Alghero”",
        b: "“Add a seafood dinner in Cagliari tomorrow at 19:00”",
        c: "“Make a poll: winery or boat trip tomorrow?”",
        d: "“What's the plan for tomorrow?”",
      },
    },
  },
  trip: {
    welcome: {
      title: "Welcome to the trip app",
      a: "The whole trip in one place, instead of digging through the group chat for addresses and decisions",
      b: "Whatever anyone adds, everyone sees instantly",
      c: "One minute of explanation and you're ready",
    },
    home: {
      kicker: "Home screen",
      title: "Now: what's happening, what's next",
      a: "A countdown to departure, the next activity and today's schedule",
      b: "Once a home base is set, a home button navigates there with Waze from any screen",
    },
    places: {
      kicker: "Places tab",
      title: "Every recommendation in one place",
      a: "Restaurants, attractions, beaches and viewpoints, with photos, ratings and navigation",
      b: "Found something good? Add it in seconds and everyone sees it",
    },
    calendar: {
      kicker: "Schedule tab",
      title: "Each day's plan",
      a: "Schedule activities and see who's joining",
      b: "An automatic reminder for everyone about 45 minutes before each activity",
    },
    map: {
      kicker: "Map tab",
      title: "Every place on one map",
      a: "See what's near what and plan smarter days",
      b: "Tap a pin for details and instant navigation",
    },
    expenses: {
      kicker: "Expenses",
      title: "Who paid and who owes",
      a: "Log any expense in seconds and the app splits it between everyone",
      b: "At the end of the trip: one summary, and everyone settles up",
    },
    ai: {
      kicker: "The real magic",
      a: "The group's private AI. It knows the whole trip",
      b: "Just talk to it:",
      chips: {
        a: "“Recommend a great attraction near our base”",
        b: "“Add a good dinner tomorrow at 19:00”",
        c: "“Make a poll: beach or hike tomorrow?”",
        d: "“What's the plan for tomorrow?”",
      },
    },
    final: {
      kicker: "Three steps and you're set",
      title: "What now?",
      a: "1. Allow notifications to get reminders and polls",
      b: "2. Add a first recommendation to Places",
      c: "3. In Settings: link yourself to your name, and vote in a single tap",
    },
  },
};

export default tour;
