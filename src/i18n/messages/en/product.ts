import type he from "../he/product";

const product: typeof he = {
  shell: {
    account: "My account",
    guest: "Guest (no account)",
    logout: "Sign out",
  },
  welcome: {
    lead: "Plan a trip in minutes, invite your group on WhatsApp, and everything you need — schedule, map, expenses and an AI assistant — waits for everyone in one app.",
    consent: {
      before: "By signing in you agree to the ",
      terms: "Terms of Use",
      between: " and the ",
      privacy: "Privacy Policy",
      after: ".",
    },
    features: {
      ai: {
        title: "A personal AI assistant for the group",
        text: "You choose its name and personality. It recommends places, books them into the schedule and opens polls",
      },
      bookings: {
        title: "Upload tickets and bookings",
        text: "Flights, hotels and attractions land in the schedule and on the map on their own",
      },
      map: {
        title: "Map, schedule and navigation",
        text: "See where you are and what's next, and get there in one tap with Waze",
      },
      money: {
        title: "Expenses and polls",
        text: "Who paid, who owes, and decide together without the arguments",
      },
    },
    legacy: {
      question: "Traveling with Sicily 2026 or Sardinia?",
      link: "Enter with your trip code",
    },
  },
  signIn: {
    google: "Continue with Google",
    apple: "Continue with Apple",
    connecting: "Signing in…",
    failed: "Sign-in failed — please try again",
    network: "No network connection — please try again",
  },
  trips: {
    title: "My trips",
    signedOutText: "Sign in to see your trips and start a new one",
    greeting: "Hi {name}",
    greetingAnon: "Hi there",
    subtitle: "Where to this time?",
    guestNote:
      "You're signed in as a guest. To start a trip of your own, sign out and sign in with Google or Apple, or save your account from the trip settings.",
    newTrip: {
      title: "New trip",
      text: "Destination, group, bookings and an AI assistant — in a few minutes",
    },
    current: "Upcoming and current",
    past: "Past trips",
    empty: "No trips yet. Got an invitation? Open the link from WhatsApp",
  },
  card: {
    draft: "Draft — continue",
    live: "On the trip now",
    tomorrow: "Tomorrow",
    inDays: "In {count} days",
    past: "Memories",
  },
  gate: {
    signInTitle: "Enter the trip",
    signInText: "Sign in with the account you used to join this trip",
    notFound: "Trip not found",
    noAccess: "You don't have access to this trip",
    noAccessText:
      "Ask the organizers for an invite link and open it on your phone. If you joined with a different account, sign out and sign in with that one.",
    myTrips: "Go to my trips",
  },
  account: {
    title: "My account",
    deleteTitle: "Delete account",
    deleteText:
      "We'll delete your profile and remove you from all trips. Trips you organize will be archived. This can't be undone.",
    confirmDelete: "Yes, delete permanently",
    deleting: "Deleting…",
    deleteFailed:
      "Deletion failed. If you signed in a while ago, sign out, sign in again and retry.",
  },
  join: {
    errors: {
      notFound: "This link doesn't exist — check that you copied all of it",
      expired: "This link has expired — ask the organizers for a new one",
      usedUp: "This link has been fully used — ask for a new one",
      revoked: "The organizers have revoked this link",
      tripClosed: "This trip has already closed",
      tripFull: "This trip is full — contact the organizers",
      signInRequired: "Please sign in with Google or Apple",
      failed: "Couldn't join — please try again",
      failedNetwork: "Couldn't join — check your connection and try again",
    },
    invited: "You're invited",
    organizers: "Organized by {name}",
    aiWaiting: "{name}, the trip's AI assistant, is already waiting",
    alreadyIn: "{count} already joined",
    signInTitle: "Sign in to join",
    signInText: "One account for all your trips — no passwords",
    guest: "Continue without an account",
    guestNote:
      "No Gmail? No problem — pick your name and you're in. Access is saved on this phone, and you can connect an account later in settings.",
    whoKids: "Who are you?",
    whoGroup: "Which one are you?",
    pickFamily: "Choose your family, then your name",
    joining: "Joining…",
    notListed: "I'm not on the list — join anyway",
    signedInAs: "Signed in as {name}",
    guestHint: "Joining as a guest — access is saved on this phone",
  },
  invite: {
    qr: "QR code",
    qrAlt: "QR code to join",
    qrHint: "Scan with the camera to join",
    copyLink: "Copy link",
    send: "Send",
    loadFailed: "Couldn't load the invite links",
    create: "Create an invite link",
    creating: "Creating…",
    general: "General link for the whole group",
    joined: "{uses}/{max} joined",
    footnote:
      "A family link preselects the family — people just pick their name. Links are valid for 60 days.",
    message: {
      title: "You're invited to \"{trip}\"{who}!",
      body: "Our schedule, map, expenses and AI assistant — all in one place.",
      join: "Join here: {url}",
    },
  },
  saveAccount: {
    title: "Keep your access",
    text: "You joined without an account, so your access is saved only on this phone. Connect Google or Apple so you don't lose it — everything stays exactly as it is.",
    alreadyExists:
      "This account already exists. Sign out, sign in with it and open the invite link again.",
    failed: "Couldn't connect — please try again",
    done: "Account saved — you can now open the trip on any phone",
    wait: "One moment…",
  },
  admin: {
    inviteTitle: "Invite the group",
    editTrip: "Edit trip",
    kidsTitle: "Connect the kids' phones",
    kidsText:
      "No email, no password: open the link on the child's phone, pick a name — done. The link is valid for 24 hours.",
    copyLink: "Copy link",
    createKidLink: "Create a link for the kids",
    wait: "One moment…",
    kidLinkFailed: "Couldn't create a link — please try again",
    members: "Who's on the trip ({count})",
    noName: "No name",
    guest: "Guest",
    remove: "Remove",
    removeConfirm: "Remove {name} from the trip?",
    theParticipant: "this participant",
    leave: "Leave trip",
    leaveConfirm: "Leave the trip? You can only come back with a new invite link",
    leaveFailed: "The trip organizer can't leave — you can archive the trip instead",
    roles: {
      owner: "Organizer",
      admin: "Admin",
      kid: "Kid",
    },
  },
  legal: {
    updated: "Last updated: {date}",
    updatedDate: "October 2026",
    privacy: {
      title: "Privacy Policy",
      collect: {
        heading: "What we collect",
        p1: "Account details from Google or Apple: name, email and profile photo.",
        p2: "Content you and your group add to the trip: places, schedule events, polls, expenses, documents and photos.",
        p3: "Location — only when you allow it, only while the app is open, and only to show you on the map or share your location with the group when you choose to.",
        p4: "A push notification token, to send reminders and trip updates.",
      },
      use: {
        heading: "How we use it",
        p1: "Your information is used only to run your trip: showing it to trip members, sending notifications and powering the AI assistant.",
        p2: "When you chat with the AI assistant or upload a booking confirmation, the relevant content is sent to our AI provider (OpenAI) for processing only. Place searches run against Google Maps.",
        p3: "We don't sell data and we don't show ads.",
      },
      visibility: {
        heading: "Who sees what",
        p1: "Everything in a trip is visible only to members of that trip. Documents you mark as private and your conversations with the AI assistant are visible only to you.",
      },
      deletion: {
        heading: "Deletion",
        p1: "You can delete your account at any time from within the app: My account → Delete account. Your profile is deleted and you leave all trips.",
      },
    },
    terms: {
      title: "Terms of Use",
      service: {
        heading: "The service",
        p1: "The app helps groups plan and manage a shared trip. It is currently free, subject to reasonable usage limits (for example, a monthly number of AI conversations).",
      },
      ai: {
        heading: "The AI assistant",
        p1: "AI recommendations are generated automatically and may contain mistakes. Check opening hours, prices and bookings against the source before relying on them.",
      },
      content: {
        heading: "Your content",
        p1: "The content you upload belongs to you. You are responsible for not uploading content you don't have the right to share, and for sharing other people's personal information only with their consent.",
      },
      contact: {
        heading: "Contact",
        p1: "Questions? Write to us from within the app or by email to the service operator.",
      },
    },
  },
};

export default product;
