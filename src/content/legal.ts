/**
 * Legal page templates (English). These are starting points written to match how the
 * application actually behaves — they MUST be reviewed by qualified counsel and completed
 * with the operating company's details before launch. Bracketed placeholders are intentional.
 */
export interface LegalDoc {
  title: string;
  updated: string;
  sections: { heading: string; body: string[] }[];
}

export const LEGAL: Record<"privacy" | "terms" | "cookies" | "subscriptions", LegalDoc> = {
  privacy: {
    title: "Privacy Policy",
    updated: "2026-11-02",
    sections: [
      { heading: "Who we are", body: ["TRIPLAN is operated by [Company legal name], [registered address], [company registration number] (\"we\", \"us\"). For privacy questions contact [privacy contact email]. If required, our Data Protection Officer is [name/contact]."] },
      { heading: "What we collect", body: [
        "Account data: email address, display name, password hash (never the password itself), optional home city and bio.",
        "Trip data: destinations, dates, traveller counts, budgets, preferences (including food preferences and any dietary notes you choose to enter), accommodation details you provide, and the itineraries you create and edit.",
        "Community content: posts, comments, photos, optional places and map pins, reviews, likes, saves and reports you submit. Photos are resized in your browser and their metadata (including any GPS location and camera details) is removed before they are stored.",
        "Billing data: plan, payment status and amounts. Card details are handled by our payment processor (Stripe) and never stored by TRIPLAN.",
        "Technical data: session cookie, language preference, IP address (used transiently for security and rate limiting) and browser user-agent stored with your session.",
        "Partner link clicks: when you follow a link marked \"Partner\", we record the partner, the page it was on, the destination, the time and — if you are signed in — your account. We do not store your IP address; a code that changes every day lets us count unique visitors without identifying you.",
      ] },
      { heading: "Why we use it (legal bases)", body: [
        "To provide the service you request — accounts, trip planning, saved itineraries (performance of a contract).",
        "To process payments and keep accounting records (contract; legal obligation).",
        "To keep the platform secure, prevent abuse and moderate community content (legitimate interests).",
        "To send optional product emails only if you opt in (consent, withdrawable at any time in Account settings).",
      ] },
      { heading: "Sensitive information", body: ["Dietary notes may reveal health or religious information. Only enter what you want used for planning. You can edit or delete it at any time; it is used solely to tailor your itinerary."] },
      { heading: "Processors and sharing", body: [
        "We use service providers to run TRIPLAN: hosting and photo storage [hosting provider, e.g. Vercel incl. Vercel Blob], database [database provider], email delivery [email provider], payments (Stripe), and — if enabled — an AI model provider (Anthropic) to draft itineraries from your trip preferences. Map tiles are loaded from [map tile provider]. We do not sell personal data.",
        "Photos you add to community posts are public while the post is published. Deleting a post or your account deletes its photos from storage.",
        "When you click an external booking or information link (for example a hotel, flight or activity site), you leave TRIPLAN and that site's own privacy policy applies.",
      ] },
      { heading: "International transfers", body: ["Where data is transferred outside the EEA/UK, we rely on appropriate safeguards such as Standard Contractual Clauses. [Confirm per provider.]"] },
      { heading: "Retention", body: ["Account and trip data are kept while your account is active. When you delete your account, personal data is deleted immediately from our live database; backups expire within [N] days. Payment records are retained for the period required by tax law."] },
      { heading: "Your rights", body: ["You can access and export your data (Account → Download my data), correct it, delete your account (Account → Delete account), object to or restrict certain processing, and withdraw consent. You may also complain to your local data protection authority."] },
      { heading: "Children", body: ["TRIPLAN is not directed at children under 16 and they may not create accounts. Trip plans may include children as travellers; we only store the information you enter."] },
      { heading: "Changes", body: ["We will notify registered users of material changes before they take effect."] },
    ],
  },
  terms: {
    title: "Terms and Conditions",
    updated: "2026-11-02",
    sections: [
      { heading: "The service", body: ["TRIPLAN helps you plan trips: it organises destinations, suggested places, meals, transport estimates and links to third-party services into an itinerary. TRIPLAN is not a travel agency and does not sell or book flights, accommodation or activities."] },
      { heading: "Accuracy of information", body: [
        "Destination content marked \"sample\" is editorial guidance awaiting verification. Opening hours, prices, availability, accessibility and dietary suitability can change — always confirm with the provider before you travel or book.",
        "Travel times are estimates unless labelled as provided by a routing service. Cost figures are estimates unless labelled as confirmed.",
        "AI-assisted itineraries are generated from our place database and your preferences and may contain mistakes. You are responsible for checking your plans.",
      ] },
      { heading: "Accounts", body: ["You must provide accurate information, keep your password confidential and be at least 16 years old. We may suspend accounts that abuse the service or violate these terms."] },
      { heading: "Community content", body: ["You keep ownership of what you post and grant us a non-exclusive licence to display it on TRIPLAN. You must only post your own genuine experiences, must not post content that is unlawful, misleading, hateful or promotional, and must only upload images you have the right to share. We may moderate or remove content."] },
      { heading: "Payments", body: ["Paid features are described on the Pricing page and in the Subscription Policy. Prices include applicable taxes unless stated otherwise."] },
      { heading: "Third-party services", body: ["Links to booking and information partners are provided for convenience. Your contract for any booking is with that provider, under their terms."] },
      { heading: "Partner and affiliate links", body: ["Links marked \"Partner\" are affiliate links of programmes that have accepted TRIPLAN. If you make a booking through them, TRIPLAN may receive a commission from the partner. This costs you nothing extra. Partners cannot pay to change your itinerary, our destination guides or community content. Other external links are ordinary links and earn TRIPLAN nothing. [List the affiliate programmes TRIPLAN actually participates in once approved.]"] },
      { heading: "Liability", body: ["To the extent permitted by law, TRIPLAN is not liable for losses arising from reliance on travel information, from third-party services, or from events outside our control. Nothing in these terms limits liability that cannot be limited by law, or your statutory consumer rights."] },
      { heading: "Governing law", body: ["These terms are governed by the laws of [jurisdiction]. Consumers may also benefit from the mandatory protections of their country of residence."] },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    updated: "2026-11-02",
    sections: [
      { heading: "Strictly necessary cookies", body: [
        "tp_session / __Host-tp_session — keeps you signed in (30 days, HttpOnly).",
        "NEXT_LOCALE — remembers your language (1 year).",
        "tp_consent — remembers your cookie choice (6 months).",
        "tp_oauth — protects Google sign-in against forgery (10 minutes, only if you use Google sign-in).",
      ] },
      { heading: "Local storage", body: ["Trip-planner drafts are kept in your browser's session storage so that switching language or signing in doesn't lose your input. They are removed when your trip is created or when you close the tab."] },
      { heading: "Analytics", body: ["TRIPLAN does not include analytics or advertising cookies by default. If they are added in future, they will only load after you consent in the cookie banner."] },
      { heading: "Third parties", body: ["Map tiles are loaded from [map tile provider]; destination photographs from Unsplash and Wikimedia Commons; member photos from our storage provider (Vercel Blob). These providers receive your IP address as part of normal web requests and don't set cookies on TRIPLAN. Payment pages are hosted by Stripe, which sets its own cookies for fraud prevention."] },
      { heading: "Managing cookies", body: ["Use \"Cookie settings\" in the footer to change your choice at any time, or block cookies in your browser (you will not be able to sign in without the session cookie)."] },
    ],
  },
  subscriptions: {
    title: "Subscription & Payment Policy",
    updated: "2026-11-02",
    sections: [
      { heading: "Free plan", body: ["Every account includes one free trip plan with the essential planning features and a saved itinerary."] },
      { heading: "Additional trip", body: ["You can buy a single additional trip plan for the price shown on the Pricing page. Each purchase adds one trip credit to your account, used when you create your next trip. Credits do not expire while your account is open."] },
      { heading: "Monthly plan", body: [
        "The Monthly plan includes the number of trip plans per billing month shown on the Pricing page and renews automatically every month at the price shown at the time of renewal, unless you cancel.",
        "Unused trips do not carry over to the next billing month. The count resets when Stripe confirms the renewal. Trips you created stay available after the plan ends.",
        "You can cancel at any time from Account → Billing; access continues until the end of the paid month.",
      ] },
      { heading: "Annual plan", body: [
        "The Annual plan gives you unlimited trip plans (subject to fair use) for 12 months from purchase and renews automatically each year at the price shown at the time of renewal, unless you cancel.",
        "We will email you before renewal if required by law. You can cancel at any time from Account → Billing; access continues until the end of the paid period.",
        "Only one Monthly or Annual subscription can be active at a time. To change plan, cancel the current one at the end of its period (Account → Billing) and choose the new plan when it ends.",
      ] },
      { heading: "Payment processing", body: ["Payments are processed securely by Stripe. TRIPLAN never sees or stores your full card details. Paid access is granted only after Stripe confirms payment to our servers."] },
      { heading: "Failed payments", body: ["If a renewal payment fails, Stripe will retry. If it cannot be collected, the subscription ends and your account returns to the Free plan; your saved trips remain available."] },
      { heading: "Refunds & withdrawal", body: ["If you are a consumer in the EU/UK you may have a 14-day right of withdrawal for digital services; by starting to use a paid trip plan immediately you acknowledge that this right may be lost once the service has been fully performed. [Confirm with counsel.] For refund requests contact us through the Contact page."] },
      { heading: "Price changes", body: ["We may change prices for future purchases and renewals with advance notice. Changes never affect a period you have already paid for."] },
    ],
  },
};
