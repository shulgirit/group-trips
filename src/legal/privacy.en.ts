import { OPERATOR as O } from "./operator";
import type { LegalDoc } from "./types";

const privacyEn: LegalDoc = {
  title: "Privacy Policy",
  summary:
    "What we collect when you plan a trip with Together, why, who we share it with, and how you can delete it.",
  sections: [
    {
      id: "who",
      heading: "1. Who we are",
      blocks: [
        `Together ("Together", "we", "us") is a group-trip planning service available on the web and as an app for iOS and Android. It is operated by ${O.legalName} (registration no. ${O.registrationNumber}), ${O.address}. We are the controller of the personal data described in this policy.`,
        `For any privacy question or request, contact us at ${O.privacyEmail}.`,
        "This policy applies to the Together website, web app and mobile apps (together, the \"Service\"). It should be read together with our Terms of Use.",
      ],
    },
    {
      id: "summary",
      heading: "2. The short version",
      blocks: [
        {
          list: [
            "We collect what is needed to run your group's trip: your account, the trip content your group adds, and — only if you allow it — your location.",
            "Trip content is visible only to the members of that trip. Your AI conversations and private documents are visible only to you.",
            "We do not sell personal data, we do not show ads and we do not use your data to profile you for marketing.",
            "Some data is processed by service providers that run the Service for us (for example Google Firebase, Vercel and OpenAI).",
            "You can delete your data in the app at any time: leave a trip and delete your data in it, delete a whole trip you organize, or delete your entire account.",
          ],
        },
      ],
    },
    {
      id: "collect",
      heading: "3. The information we collect",
      blocks: [
        {
          lead: "Account information. When you sign in with Google or Apple, we receive:",
          list: [
            "your name, email address and profile photo (if you have one);",
            "a unique account identifier from the sign-in provider;",
            "if you use Sign in with Apple and choose to hide your email, a private relay address instead of your real email.",
          ],
        },
        "Guest and child access. You can join a trip as a guest without an email address, and a trip organizer can connect a child's device with a one-time link. In both cases we create an anonymous account identifier and store only the display name chosen at joining.",
        {
          lead: "Trip content. Information you and your group add to a trip, including:",
          list: [
            "trip details: name, destinations, dates, accommodation and itinerary;",
            "participants and families: names, roles, and — when the organizer adds them — ages or age groups of travelers, including children;",
            "places, schedule events, polls and votes, notes and comments;",
            "expenses: amounts, currencies, who paid and how costs are split;",
            "documents and files you upload, such as tickets, booking confirmations and photos. These may contain personal details such as names, booking references or passport numbers that appear on the document;",
            "forwarded booking confirmations that you ask us to import.",
          ],
        },
        "Conversations with the AI assistant. The messages you send to the trip's AI assistant, any images you attach, and the assistant's replies.",
        {
          lead: "Location (optional). Only if you grant permission on your device:",
          list: [
            "Your precise location is used while the app is open to show you on the map and to find places near you. It is processed on your device and is not stored on our servers.",
            "If you choose to share your live location with the group, your position is stored for the duration you select (for example 1 hour, 4 hours or until the end of the day), is visible to the members of that trip only, and is deleted automatically when sharing ends. You can stop sharing at any time.",
            "We never collect location in the background when the app is closed.",
          ],
        },
        "Notifications. If you enable notifications, we store a push-notification token for your device, your preferred language, and which trip it belongs to.",
        {
          lead: "Technical and usage information:",
          list: [
            "basic server logs (such as IP address, device and browser type, time and the page or request) kept by our hosting providers for security and troubleshooting;",
            "counters of how many AI conversations and imports each trip used in a month, to apply the free-plan limits;",
            "your language preference.",
          ],
        },
        "We do not use third-party advertising or analytics trackers.",
      ],
    },
    {
      id: "use",
      heading: "4. How we use information, and our legal bases",
      blocks: [
        {
          lead: "We use personal data only for the following purposes:",
          list: [
            "To provide the Service — creating your account, running the trips you belong to, showing trip content to its members, syncing between devices, sending reminders and trip updates, and operating the AI assistant and booking import. Legal basis: performance of our contract with you (the Terms of Use).",
            "To keep the Service secure and working — preventing abuse, enforcing usage limits, debugging and protecting our users. Legal basis: our legitimate interests in a safe, reliable service.",
            "To use your location, send push notifications and process sensitive details you choose to upload — only with your consent, which you can withdraw at any time in your device settings or in the app.",
            "To comply with the law — responding to lawful requests and keeping records we are required to keep. Legal basis: legal obligation.",
            "To communicate with you about the Service, for example important changes to these terms. We do not send marketing messages without your consent.",
          ],
        },
        "We do not use your trip content or conversations to train AI models, and we do not make decisions about you based solely on automated processing that have legal or similarly significant effects.",
      ],
    },
    {
      id: "visibility",
      heading: "5. Who can see your information inside a trip",
      blocks: [
        {
          list: [
            "Everything added to a trip — schedule, places, polls, expenses, the participant list, shared documents and live location you chose to share — is visible to all members of that trip.",
            "Your conversations with the AI assistant and documents you mark as private are visible only to you.",
            "The trip organizer and trip admins can invite and remove participants and edit trip details.",
            "Anyone who has a valid invite link can join the trip. Share invite links only with people you want in your group.",
          ],
        },
        "When you add information about other people — for example family members, children or fellow travelers — you confirm that you are allowed to share it with the group and with us for the purposes in this policy.",
      ],
    },
    {
      id: "sharing",
      heading: "6. Service providers we share data with",
      blocks: [
        "We do not sell or rent personal data. We share it only with service providers (processors) that run parts of the Service for us, under contracts that require them to protect it and use it only on our instructions:",
        {
          list: [
            "Google Cloud / Firebase (Google LLC) — database, file storage, authentication and push notifications.",
            "Vercel Inc. — hosting of the website and app servers.",
            "OpenAI, L.L.C. — generating AI assistant replies and reading booking confirmations you ask us to import. Content you send to the assistant is shared for this purpose only. Under OpenAI's API terms, this data is not used to train their models and is retained by them for a limited period for abuse monitoring.",
            "Google Maps Platform (Google LLC) — place search, place details and photos, maps and directions. Searches are sent without your account details.",
            "Firecrawl — reading public web pages (such as a restaurant's website) when you add or enrich a place from a link. Only the link or place name is sent.",
            "Apple Inc. and Google LLC — Sign in with Apple and Sign in with Google, and push-notification delivery on their devices.",
            "Open Exchange Rates (open.er-api.com) — currency exchange rates. No personal data is sent.",
          ],
        },
        "When you open a navigation link (for example Waze or Google Maps), you leave the Service and that app's own privacy policy applies.",
        "We may also disclose information if required by law or a valid legal request, to protect the rights, safety or property of our users or others, or as part of a merger, acquisition or sale of assets — in which case we will require the recipient to honor this policy and notify you.",
      ],
    },
    {
      id: "transfers",
      heading: "7. International transfers",
      blocks: [
        "Our service providers store and process data on servers in the United States, the European Union and other countries, which may have data-protection laws different from those of your country. Where required, we rely on appropriate safeguards for these transfers, such as the European Commission's Standard Contractual Clauses or an adequacy decision, and on the transfer rules of the Israeli Privacy Protection Regulations.",
      ],
    },
    {
      id: "retention",
      heading: "8. How long we keep information",
      blocks: [
        {
          list: [
            "Account and trip data are kept for as long as your account or the trip exists.",
            "Shared live location is deleted automatically when the sharing period you chose ends.",
            "Invite links expire automatically; child-device links are valid for 24 hours.",
            "When you delete data in the app (see section 9), it is removed from our live database and file storage immediately. Copies may remain in our providers' encrypted backups and logs for up to 30 days before they are overwritten.",
            "We may keep limited information longer when the law requires it or to resolve a dispute.",
          ],
        },
      ],
    },
    {
      id: "deletion",
      heading: "9. Deleting your data in the app",
      blocks: [
        "You don't need to contact us to delete your data — it can be done inside the app, and every deletion asks you to confirm first because it cannot be undone.",
        {
          list: [
            "Leave a trip and delete your data in it (Trip settings → Leave trip and delete my data): removes you from the trip and permanently deletes your AI conversations, documents and files you uploaded, booking imports, live location, notification devices and poll votes in that trip.",
            "Delete a trip (trip organizer only — Trip settings → Delete trip permanently): permanently deletes the entire trip for all participants, including its schedule, places, polls, expenses, documents, photos, AI conversations, participant list and invite links.",
            "Delete your account (My account → Delete account): permanently deletes your profile, sign-in account and all of your data in every trip, as described above. Trips you organize are handed over to another adult participant so the group doesn't lose its plan; a trip with no other participants is deleted entirely.",
            "Remove a participant (trip organizer or admin): deletes that person's personal data in the trip in the same way.",
          ],
        },
        "Places and schedule events you added to a shared trip are part of the group's plan, so they stay in the trip after you leave — but your name is removed from them. Expenses you recorded stay too, because the rest of the group needs them to settle up.",
      ],
    },
    {
      id: "rights",
      heading: "10. Your rights",
      blocks: [
        {
          lead: "Depending on where you live — including under the Israeli Privacy Protection Law, 5741-1981, and the EU and UK General Data Protection Regulation (GDPR) — you may have the right to:",
          list: [
            "access the personal data we hold about you and receive a copy;",
            "correct inaccurate data (most of it you can edit directly in the app);",
            "delete your data (available in the app, see section 9);",
            "restrict or object to certain processing, including processing based on our legitimate interests;",
            "receive your data in a portable format;",
            "withdraw consent at any time, without affecting processing that already took place;",
            "lodge a complaint with a supervisory authority — in Israel, the Privacy Protection Authority; in the EU or UK, your local data-protection authority.",
          ],
        },
        `To exercise any of these rights, write to ${O.privacyEmail}. We may need to verify your identity, and we will respond within the period required by law (usually 30 days). California residents: we do not sell or share personal information for cross-context behavioral advertising.`,
      ],
    },
    {
      id: "children",
      heading: "11. Children",
      blocks: [
        `The Service is designed for families, but it is not directed at children on their own. You must be at least ${O.minimumAge} years old (or older where local law requires) to create an account. Children take part in a trip only through a parent or guardian: an adult organizer adds them to the trip and may connect a child's device with a one-time link.`,
        "For a child, we store only the name and age or age group the parent enters, and the content the child adds to the trip. Parents and guardians are responsible for the information they provide about their children and may remove a child from a trip — deleting the child's data — at any time. If you believe a child has given us personal data without a parent's involvement, contact us and we will delete it.",
      ],
    },
    {
      id: "security",
      heading: "12. Security",
      blocks: [
        "We protect your data with industry-standard measures, including encryption in transit (HTTPS) and at rest, access rules that limit every trip to its members, server-side checks on every request, and limited staff access. No service is completely secure, so please keep your sign-in account protected and share invite links only with people you trust. If we become aware of a security incident affecting your data, we will notify you and the authorities as required by law.",
      ],
    },
    {
      id: "device",
      heading: "13. Cookies and storage on your device",
      blocks: [
        "We use only cookies and local storage that are necessary for the Service to work: keeping you signed in, remembering your language and the trip you last opened, saving an unfinished trip draft, and remembering that you've seen the app tour. We do not use advertising cookies.",
      ],
    },
    {
      id: "changes",
      heading: "14. Changes to this policy",
      blocks: [
        "We may update this policy as the Service evolves or the law changes. We will post the new version here with a new effective date, and if the changes are significant we will notify you in the app or by email before they take effect.",
      ],
    },
    {
      id: "contact",
      heading: "15. Contact",
      blocks: [
        `${O.legalName}, ${O.address}. Privacy questions and requests: ${O.privacyEmail}. General support: ${O.supportEmail}.`,
      ],
    },
  ],
};

export default privacyEn;
