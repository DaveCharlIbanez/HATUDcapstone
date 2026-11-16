/**
 * The Terms and Conditions.
 *
 * The terms are data rather than markup, so they can be rendered in the
 * acceptance dialog, read again later from the profile page, versioned, and
 * tested. The version is recorded on the user when they accept, so the day
 * it matters, it is known which version was agreed to.
 *
 * NOTE: this is a draft written for the project. It should be read by
 * someone qualified before the app is used in anger.
 */

export interface TermsSection {
  /** The duties, when the section is a list rather than prose. */
  bullets?: string[];
  heading: string;
  paragraphs: string[];
}

export interface TermsDocument {
  /** The sentence the tick box agrees to. */
  agreement: string;
  /** The label on the tick box. The box itself is drawn by the browser. */
  checklist: string;
  introduction: string;
  sections: TermsSection[];
  title: string;
}

/** The version in force. Recorded on the user when the terms are accepted. */
export const TERMS_VERSION = "1.0";

/** When the current version came into force. */
export const TERMS_EFFECTIVE_DATE = "28 October 2026";

export const TERMS: TermsDocument = {
  agreement:
    "By creating an account or continuing to use HATUD: A Kinaray-a Ride-Booking Hub, you confirm that you have read, understood, and agreed to these Terms and Conditions.",
  checklist: "I have read and agree to the Terms and Conditions.",
  introduction:
    "Welcome to HATUD: A Kinaray-A Ride-Booking Hub. By creating an account and using our application, you agree to follow these Terms and Conditions. These guidelines are designed to help provide a safe, convenient, and reliable ride-booking experience for passengers and drivers.",
  sections: [
    {
      heading: "Use of the Application",
      paragraphs: [
        "HATUD is a ride-booking hub designed to connect passengers with available drivers within the designated service area. Users are expected to use the application responsibly and only for legitimate transportation purposes.",
      ],
    },
    {
      heading: "User Accounts",
      paragraphs: [
        "Users must provide accurate and complete information when creating an account. You are responsible for keeping your account secure and for any activity made using your account.",
        "Providing false information or misusing an account may result in suspension or termination of access to the application.",
      ],
    },
    {
      heading: "Booking a Ride",
      paragraphs: [
        "Passengers may request or schedule a ride through the HATUD application, depending on driver availability. To ensure a smooth and efficient service, passengers should provide accurate pickup and destination locations.",
        "Please note that submitting a booking request does not guarantee the immediate availability of a driver.",
      ],
    },
    {
      heading: "Passenger Responsibilities",
      paragraphs: ["Passengers are expected to:"],
      bullets: [
        "Provide accurate booking information.",
        "Treat drivers with respect and courtesy.",
        "Use the application responsibly.",
        "Avoid false or unnecessary booking requests.",
        "Follow applicable transportation and community regulations.",
        "Pay the appropriate fare for completed rides.",
      ],
    },
    {
      heading: "Driver Responsibilities",
      paragraphs: ["Drivers using the HATUD platform are expected to:"],
      bullets: [
        "Provide accurate and updated information.",
        "Treat passengers with professionalism and respect.",
        "Follow traffic laws and transportation regulations.",
        "Handle ride requests responsibly.",
        "Help maintain a safe and comfortable ride experience.",
      ],
    },
    {
      heading: "Payments",
      paragraphs: [
        "Passengers choose how they will pay for a ride when they book it, and the choice stays with that ride. HATUD supports cash and electronic wallet services, including GCash and Maya.",
        "Passengers are responsible for paying the correct fare for completed rides. A ride paid in cash is settled with the driver when the trip ends.",
        "Any applicable platform fees or charges will be handled according to the policies of the HATUD system.",
      ],
    },
    {
      heading: "Cancellations",
      paragraphs: [
        "We understand that unexpected situations may happen. Passengers and drivers may cancel a booking when necessary. However, repeated cancellations, false bookings, or intentional misuse of the system may result in account restrictions or suspension.",
      ],
    },
    {
      heading: "Location Services",
      paragraphs: [
        "HATUD may use location information to support features such as ride booking, driver-passenger matching, pickup and destination identification, ride tracking, and estimated arrival times.",
        "By using these features, you allow the application to process the necessary location information to provide its services.",
      ],
    },
    {
      heading: "Privacy and Data Protection",
      paragraphs: [
        "HATUD respects the privacy of its users. Information collected through the application will only be used for purposes related to providing, managing, securing, and improving the ride-booking service.",
        "Personal information will be handled responsibly in accordance with the application's Privacy Policy and applicable data protection requirements.",
      ],
    },
    {
      heading: "Safety and Proper Conduct",
      paragraphs: [
        "All users are expected to behave respectfully and responsibly while using HATUD. Harassment, fraudulent activities, abusive behavior, or any action that may compromise the safety of passengers, drivers, or the system is strictly prohibited.",
      ],
    },
    {
      heading: "Service Availability",
      paragraphs: [
        "While we aim to provide a reliable service, HATUD may occasionally experience temporary interruptions due to maintenance, technical issues, internet connectivity, or other unforeseen circumstances.",
      ],
    },
    {
      heading: "Account Suspension or Termination",
      paragraphs: [
        "HATUD reserves the right to suspend, restrict, or terminate an account if a user violates these Terms and Conditions, provides false information, misuses the application, or engages in harmful or fraudulent activities.",
      ],
    },
    {
      heading: "Changes to These Terms",
      paragraphs: [
        "HATUD may update these Terms and Conditions when necessary. Users will be informed of significant changes through the application or other appropriate communication channels.",
        "Continued use of the application after the updated terms take effect means that you accept the revised Terms and Conditions.",
      ],
    },
    {
      heading: "Contact Us",
      paragraphs: [
        "For questions, concerns, or feedback regarding these Terms and Conditions, users may contact the HATUD Development Team or System Administrator through the available support channels.",
      ],
    },
    {
      heading: "Limitation of Liability",
      paragraphs: [
        "HATUD provides the platform and the technology that connect passengers with drivers within the designated service area. HATUD is not a party to the transportation arrangement between any passenger and any driver, and HATUD is not liable and is not accountable for any outcome, loss, damage, injury, delay, inconvenience, or event of any kind that occurs during the use of the application, whether arising from the acts or omissions of a passenger, a driver, or any third party, or from the operation of the platform itself.",
        "To the fullest extent permitted by applicable law, HATUD shall not be liable for any direct, indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profit, revenue, data, or goodwill, arising out of or in connection with the use of, or the inability to use, the application. This includes, without limitation, the availability or non-availability of a driver, a delay in matching a passenger with a driver, a cancellation by either party, a dispute between a passenger and a driver, the conduct of any user of the platform, and any inaccuracy or unavailability of the information, maps, or location data the platform provides.",
        "Users acknowledge that the availability of drivers, the safety of any journey, and the fulfilment of any booking request are matters outside HATUD's control, and agree to hold HATUD harmless to the fullest extent permitted by applicable law.",
      ],
    },
  ],
  title: "Terms and Conditions",
};
