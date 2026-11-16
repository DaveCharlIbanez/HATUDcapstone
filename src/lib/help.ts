/**
 * The help content.
 *
 * It lives in one place so the help page and anything that links to it agree,
 * and so it can be tested: a section that the drawer promises has to exist in
 * the document.
 */

export interface HelpEntry {
  body: string[];
  heading: string;
}

export interface HelpSection {
  entries: HelpEntry[];
  heading: string;
}

export interface Faq {
  answer: string;
  question: string;
}

export interface HelpDocument {
  faqs: Faq[];
  sections: HelpSection[];
}

export const HELP: HelpDocument = {
  faqs: [
    {
      answer:
        "Open the menu in the top-left corner, and choose Book a ride. Your pickup is set from where you are, or you can search for an address or pick one of the landmarks. Then choose your destination and tap Book.",
      question: "How do I book a ride?",
    },
    {
      answer:
        "You are sent to the screen that is waiting for you. If a trip has not been paid for or rated yet, the dashboard shows it with a button, and that button always leads to the right trip.",
      question: "Where do I pay for a ride, and rate the driver?",
    },
    {
      answer:
        "The fare is worked out from the road distance between your pickup and your destination, not from the straight line between them. It is a base fare of thirty pesos, which covers the first two kilometres, and twelve pesos for every started kilometre after that. The price is locked in when you book and never changes afterwards.",
      question: "How is the fare worked out?",
    },
    {
      answer:
        "While a driver is coming to collect you, the line on the map is green and runs to your pickup point. Once you are on the bike, it turns blue and runs to your destination. The same line is drawn on the driver's map.",
      question: "What do the coloured lines on the map mean?",
    },
    {
      answer:
        "Your position is only shared while you are on a trip, and only with the driver you are riding with. You can turn it off at any time in Settings, and you can check what the app has permission to use there too.",
      question: "Who can see where I am?",
    },
    {
      answer:
        "Only drivers who have been cleared by an administrator can take rides. When you sign up, upload your four credentials and wait for the review. You will be able to go on shift once it is approved, and you will find out here when it happens.",
      question: "How do I become a driver?",
    },
    {
      answer:
        "Open the menu and choose My profile. Your personal details are at the top, your ride history below them, and Change password is in the same screen.",
      question: "Where do I change my password?",
    },
    {
      answer:
        "In the menu, choose Settings. It shows whether the app has permission to use your location, your camera and notifications, and lets you ask for any of them. The location button raises the same dialog Android shows for any app that wants your position.",
      question: "How do I turn location on?",
    },
    {
      answer:
        "A request stays open for fifteen minutes. If no driver takes it, it is closed and you can book again. Open requests are shown to every driver on shift, and the first one to accept takes it.",
      question: "How long does a booking request last?",
    },
    {
      answer:
        "It happens when a driver accepts the request and, later, when they complete the trip. You can cancel a request yourself from the map while it is still waiting for a driver.",
      question: "Why did my ride change status?",
    },
  ],
  sections: [
    {
      entries: [
        {
          body: [
            "Open the menu in the top-left corner and choose Book a ride. The map opens with your pickup set from where you are, or you can search for an address or pick a landmark from the list.",
            "Choose your destination, pick a vehicle, and tap Book. The fare is shown before you commit, and it does not change once the ride is booked.",
            "When a driver accepts, your screen shows their name, their vehicle and their plate number, and the road they are taking to reach you is drawn in green.",
          ],
          heading: "Booking a ride",
        },
        {
          body: [
            "The dashboard tells you what needs you. A trip that has not been paid for has a Pay button, and a trip whose driver has not been rated has a Rate button. Each of them leads to the right trip.",
            "A trip can only be paid for once and rated once. If you have more than one trip waiting, the dashboard walks you through them one at a time.",
          ],
          heading: "Paying and rating",
        },
      ],
      heading: "Getting started",
    },
    {
      entries: [
        {
          body: [
            "While a driver is on the way to you, the road is drawn in green and runs from them to your pickup point.",
            "When you are on the bike, the road turns blue and runs to your destination. The driver sees exactly the same line.",
            "A driver whose position has not been updated for a while is drawn in grey, so you can tell that they may have stopped.",
          ],
          heading: "The map",
        },
        {
          body: [
            "Your pickup marker is where you are, and the destination marker is where you are going. Tap either one to see the address.",
            "Your position is only shared while you are on a trip. If the driver cannot see you, the app says so on their screen and on yours.",
          ],
          heading: "Your markers",
        },
      ],
      heading: "On the map",
    },
    {
      entries: [
        {
          body: [
            "Your name, phone number, the rides you have taken and what you have spent are all on your profile.",
            "Change password asks for your current password before it takes a new one, so nobody else can lock you out.",
            "Your saved places are the addresses you have saved for quick pickup.",
          ],
          heading: "Your profile",
        },
        {
          body: [
            "The terms cover how the app is used, what is expected of passengers and drivers, and what happens if an account is misused.",
            "You accepted the terms when you created your account, and you can read them again at any time from Settings.",
          ],
          heading: "The terms",
        },
      ],
      heading: "Your account",
    },
    {
      entries: [
        {
          body: [
            "The fare is a base of thirty pesos, which covers the first two kilometres, and twelve pesos for every started kilometre after that.",
            "There is one kind of ride, so there is one fare.",
            "The distance charged is the road distance, the same one the map draws, so the price and the journey agree.",
            "The price is fixed when you book. A driver cannot change it afterwards.",
          ],
          heading: "What a fare is made of",
        },
        {
          body: [
            "You choose how you pay when you book: GCash, Maya, or cash to your driver. While the sandbox is in use, no real money moves and any number will be accepted; one particular number is always declined, so you can see what a refusal looks like.",
            "Your payment history is on your profile.",
          ],
          heading: "Paying",
        },
      ],
      heading: "Payments",
    },
    {
      entries: [
        {
          body: [
            "Open the menu and choose See available rides. Every open request in the service area is listed, with the pickup point, the destination and the fare.",
            "Accept one to take it. Your name and plate number are shown to the passenger, and your position is shared with them for the trip.",
            "When you reach the passenger, tap Picked Up. When the trip is over, tap Complete.",
          ],
          heading: "Taking a ride",
        },
        {
          body: [
            "Your application needs four credentials: your licence, your registration, your official receipt and your insurance.",
            "An administrator reviews them. You will not be able to go on shift until the application is approved.",
          ],
          heading: "Becoming a driver",
        },
      ],
      heading: "For drivers",
    },
  ],
};
