import { OPERATOR as O, operatorIdentity } from "./operator";
import type { LegalDoc } from "./types";

const termsEn: LegalDoc = {
  title: "Terms of Use",
  summary:
    "The agreement between you and Together when you use the website and apps. Please read it — by using the Service you accept it.",
  sections: [
    {
      id: "agreement",
      heading: "1. The agreement",
      blocks: [
        `These Terms of Use ("Terms") are a binding agreement between you and ${operatorIdentity("en")} ("Together", "we", "us"), which operates the Together website, web app and mobile apps (the "Service").`,
        "By creating an account, joining a trip or otherwise using the Service, you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the Service.",
      ],
    },
    {
      id: "service",
      heading: "2. The Service",
      blocks: [
        "Together helps groups plan and run a shared trip: an itinerary and calendar, a map of places, polls, shared expenses, documents, invitations, notifications, and an AI travel assistant. Features may change, be added or be removed over time.",
        "Together is a planning tool only. We are not a travel agent, tour operator, airline, hotel or booking platform. We do not sell, book or guarantee any travel service, and we are not a party to any agreement between you and a provider of travel services.",
      ],
    },
    {
      id: "eligibility",
      heading: "3. Who may use the Service",
      blocks: [
        `You must be at least ${O.minimumAge} years old (or the age of digital consent where you live, if higher) to create an account. Children may take part in a trip only when a parent or legal guardian adds them and supervises their use; the parent or guardian accepts these Terms on the child's behalf and is responsible for the child's use.`,
        "You may not use the Service if you are barred from doing so under applicable law.",
      ],
    },
    {
      id: "accounts",
      heading: "4. Accounts, guests and security",
      blocks: [
        "You sign in with Google or Apple, or join a trip as a guest. You are responsible for the activity on your account and devices. Keep your sign-in account secure and tell us promptly about any unauthorized use.",
        "Guest and child-device access is tied to the device used to join. If you sign out or lose the device, guest access may be lost unless you first link a Google or Apple account.",
        "Invite links grant access to a trip. Share them only with people you want in the group; anyone with a valid link can join until it expires or is used up.",
      ],
    },
    {
      id: "organizers",
      heading: "5. Trip organizers",
      blocks: [
        {
          lead: "If you create a trip, you are its organizer. As organizer you:",
          list: [
            "decide who is invited, may appoint admins and may remove participants;",
            "are responsible for having the right to add the information you enter about other travelers — in particular, children — and for having their (or their parents') permission;",
            "may archive the trip or delete it permanently, which deletes it for all participants.",
          ],
        },
        "If the organizer deletes their account, ownership of the trip passes to another adult participant, or the trip is deleted if no one else is in it.",
      ],
    },
    {
      id: "content",
      heading: "6. Your content",
      blocks: [
        "You keep all rights to the content you upload or create in the Service — trip details, places, messages, documents, photos and so on (\"Your Content\").",
        "You grant us a worldwide, non-exclusive, royalty-free license to host, store, copy, process, transmit and display Your Content solely to operate, secure and improve the Service for you and your trip group — including sending it to the service providers listed in the Privacy Policy, such as our AI provider. This license ends when Your Content is deleted from the Service, except for copies in backups that are deleted on their normal schedule.",
        "Content you add to a shared trip is visible to the trip's members, and some of it (such as places and events) remains part of the group's plan if you leave, as described in the Privacy Policy.",
        "You are responsible for Your Content. You confirm that you have the rights and permissions needed to upload it, and that it does not infringe anyone's rights or break the law.",
      ],
    },
    {
      id: "use",
      heading: "7. Acceptable use",
      blocks: [
        {
          lead: "You agree not to:",
          list: [
            "upload content that is unlawful, harmful, threatening, harassing, defamatory, obscene, or that infringes intellectual-property or privacy rights;",
            "share other people's personal data without a lawful basis, or track someone's location without their knowledge;",
            "use the Service to send spam or unsolicited commercial messages;",
            "attempt to access trips, accounts or data you are not authorized to access, or interfere with the security or operation of the Service;",
            "scrape, reverse-engineer, decompile or copy the Service, except as permitted by law;",
            "use the AI assistant to generate unlawful content or to try to bypass its safeguards;",
            "use the Service in a way that exceeds reasonable use or places an unreasonable load on our systems.",
          ],
        },
      ],
    },
    {
      id: "ai",
      heading: "8. The AI assistant and third-party information",
      blocks: [
        "The AI assistant generates answers automatically using third-party AI models. Its output can be incomplete, outdated or wrong, and it may describe places, prices, opening hours, transport options or safety conditions inaccurately.",
        "AI output and information shown from third parties (such as Google Maps, websites or exchange-rate services) is provided for convenience only and is not professional, legal, medical, safety or travel advice. Always verify important details — bookings, opening hours, prices, entry requirements, accessibility and safety — with the official source before relying on them.",
        "You are responsible for the actions the assistant takes on your request (for example adding places or events to the trip) and for reviewing them.",
      ],
    },
    {
      id: "location",
      heading: "9. Location and navigation",
      blocks: [
        "Location features depend on your device and may be inaccurate. Live location sharing is optional and time-limited. Navigation links open third-party apps such as Waze or Google Maps; follow road signs and local law, and never use the app in a way that distracts you while driving.",
      ],
    },
    {
      id: "expenses",
      heading: "10. Shared expenses",
      blocks: [
        "The expenses feature is a calculator to help your group keep track of who paid what. It does not process payments or hold money. Exchange rates are indicative and may differ from the rates your bank or card applies. Settlements between participants are solely between them.",
      ],
    },
    {
      id: "fees",
      heading: "11. Price, limits and changes",
      blocks: [
        "The Service is currently free of charge. To keep it sustainable we apply reasonable usage limits — for example the number of active trips you organize, AI conversations per trip per month, and booking imports. Limits are shown in the app and may change.",
        "We may introduce paid plans or features in the future. We will tell you in advance, and we will not charge you for anything without your explicit agreement.",
      ],
    },
    {
      id: "third",
      heading: "12. Third-party services",
      blocks: [
        "The Service relies on and links to third-party services (such as Google, Apple, OpenAI, Waze and websites of places). Their own terms and privacy policies apply to your use of them, and we are not responsible for their content, availability or practices.",
      ],
    },
    {
      id: "ip",
      heading: "13. Our intellectual property",
      blocks: [
        "The Service, including its software, design, logo and the Together name, belongs to us or our licensors and is protected by law. We grant you a personal, non-exclusive, non-transferable, revocable license to use the Service in accordance with these Terms. If you send us feedback or ideas, we may use them without obligation to you.",
      ],
    },
    {
      id: "termination",
      heading: "14. Ending your use, and deletion",
      blocks: [
        "You can stop using the Service at any time. You can leave a trip and delete your data in it, delete a trip you organize, or delete your account entirely from within the app; the effects of each are described in the Privacy Policy. Deletion is permanent and cannot be undone.",
        "We may suspend or close an account, or remove content, if we reasonably believe it breaches these Terms or the law, creates risk for other users or for us, or if required by law. Where reasonable we will notify you and explain why. We may also discontinue the Service, in which case we will give reasonable advance notice so you can save what you need.",
      ],
    },
    {
      id: "disclaimer",
      heading: "15. Disclaimers",
      blocks: [
        "To the maximum extent permitted by law, the Service is provided \"as is\" and \"as available\", without warranties of any kind, whether express or implied — including warranties of merchantability, fitness for a particular purpose, accuracy and non-infringement. We do not guarantee that the Service will be uninterrupted, error-free or secure, or that data will never be lost. Keep your own copies of important travel documents.",
      ],
    },
    {
      id: "liability",
      heading: "16. Limitation of liability",
      blocks: [
        "To the maximum extent permitted by law, we will not be liable for any indirect, incidental, special, consequential or punitive damages, or for any loss of profits, data, bookings or enjoyment, arising from or related to your use of the Service — including reliance on AI output or third-party information, missed reminders, travel disruptions, or the acts of other participants or third-party providers.",
        "Our total liability for any claim related to the Service is limited to the greater of the amount you paid us in the 12 months before the claim, or 100 US dollars (or the equivalent in New Israeli Shekels).",
        "Nothing in these Terms limits liability that cannot be limited by law, such as liability for fraud, or for death or personal injury caused by negligence, or your rights as a consumer under mandatory law.",
      ],
    },
    {
      id: "indemnity",
      heading: "17. Indemnity",
      blocks: [
        "To the extent permitted by law, you will indemnify us against claims, losses and reasonable legal costs arising from Your Content or from your breach of these Terms or of the law.",
      ],
    },
    {
      id: "law",
      heading: "18. Governing law and disputes",
      blocks: [
        "These Terms are governed by the laws of the State of Israel, without regard to its conflict-of-laws rules. The competent courts of Tel Aviv-Jaffa, Israel, have exclusive jurisdiction over any dispute, except that if you are a consumer living in another country you may also have the right to bring a claim in your local courts and to rely on the mandatory consumer-protection laws of your country.",
        "Before starting any legal proceeding, please contact us — most issues can be resolved quickly.",
      ],
    },
    {
      id: "apps",
      heading: "19. App stores",
      blocks: [
        "If you downloaded the app from the Apple App Store or Google Play, these Terms are between you and us, not Apple or Google, and we — not they — are responsible for the app. Apple and its subsidiaries are third-party beneficiaries of these Terms and may enforce them against you with respect to the iOS app. Your use of the app must also comply with the store's own terms.",
      ],
    },
    {
      id: "general",
      heading: "20. General",
      blocks: [
        "We may update these Terms from time to time. We will post the new version with a new effective date and, for material changes, notify you in the app or by email before they take effect. Continuing to use the Service after that date means you accept the updated Terms.",
        "If any provision is found unenforceable, the rest remain in effect. Our failure to enforce a provision is not a waiver. You may not transfer your rights under these Terms; we may transfer ours as part of a reorganization, merger or sale (including to a company we form to run the Service). These Terms and the Privacy Policy are the entire agreement between us about the Service. If the English and Hebrew versions differ, the Hebrew version prevails for users in Israel and the English version for everyone else.",
      ],
    },
    {
      id: "contact",
      heading: "21. Contact",
      blocks: [
        `${operatorIdentity("en")}. Email: ${O.supportEmail}.`,
      ],
    },
  ],
};

export default termsEn;
