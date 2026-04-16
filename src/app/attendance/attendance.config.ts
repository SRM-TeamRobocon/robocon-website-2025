export interface AttendanceMember {
  uid: string;
  name: string;
  domain: string;
}

export const ATTENDANCE_CONFIG = {
  GOOGLE_SCRIPT_URL: process.env.GOOGLE_SCRIPT_URL || "",

  // Session logic
  MAX_SESSION_HOURS: 12,
  CAPPED_SESSION_HOURS: 4,
  DUPLICATE_IN_HOURS: 4,

  // Fallbacks when UID is not in map
  DEFAULT_NAME_PREFIX: "Member",
  DEFAULT_DOMAIN: "GENERAL",
};

export const ATTENDANCE_UID_ALIASES: Record<string, string> = {
  // Historical sheet formatting issue for Nithya (scientific notation)
  "955E57": "9548E54",
};

export const ATTENDANCE_MEMBERS: AttendanceMember[] = [
  { uid: "A9DC6F63", name: "Anubhav", domain: "SPACED" },
  { uid: "493FEAB", name: "Abraham", domain: "MCSOD" },
  { uid: "895D8654", name: "Rayyah", domain: "SPACED" },
  { uid: "99ECB9D", name: "K Manish", domain: "SAMBED" },
  { uid: "F9A537AC", name: "Rijul", domain: "SAMBED" },
  { uid: "F968AB94", name: "Syed Misbahul", domain: "MCSOD" },
  { uid: "F94A9894", name: "Vrashni", domain: "SIESED" },
  { uid: "9EE14AB", name: "Niranjana", domain: "SIESED" },
  { uid: "A918A994", name: "Sangamithraa", domain: "SAMBED" },
  { uid: "29A6C09D", name: "Shaziya", domain: "SIESED" },
  { uid: "9DE18AB", name: "Deepa", domain: "MCSOD" },
  { uid: "79859A94", name: "Shresth", domain: "SAMBED" },
  { uid: "A95D8654", name: "Smriti Dubey", domain: "MCSOD" },
  { uid: "B9C62E6C", name: "TEAM LEAD", domain: "TEAM" },
  { uid: "E9818E54", name: "Ashwin", domain: "MCSOD" },
  { uid: "39999D94", name: "Arshia Gupta", domain: "SPACED" },
  { uid: "89EA17AB", name: "Krish Parekh", domain: "SPACED" },
  { uid: "4946AA94", name: "Aman Chouhan", domain: "SPACED" },
  { uid: "E9ECA894", name: "Adarsh Mittal", domain: "SPACED" },
  { uid: "49EAA994", name: "Swastika", domain: "MCSOD" },
  { uid: "79A24AB", name: "Soham", domain: "MCSOD" },
  { uid: "697713AB", name: "Bhaskar", domain: "SIESED" },
  { uid: "29EBC39D", name: "Karthik", domain: "SIESED" },
  { uid: "C98E23AB", name: "Rajat", domain: "SPACED" },
  { uid: "29781BAB", name: "Nitiraj", domain: "MCSOD" },
  { uid: "29908754", name: "Nilesh", domain: "SIESED" },
  { uid: "E9689054", name: "Mohamed Abdullah", domain: "SIESED" },
  { uid: "4929BD9D", name: "Daksh", domain: "SPACED" },
  { uid: "29D35E61", name: "Tanisha", domain: "SAMBED" },
  { uid: "D92E9994", name: "Vineet", domain: "SIESED" },
  { uid: "D9CCBB9D", name: "Keerthana", domain: "SAMBED" },
  { uid: "79F28654", name: "Samparna", domain: "SAMBED" },
  { uid: "D94419AB", name: "Bhargave", domain: "SIESED" },
  { uid: "8949D162", name: "Dominic", domain: "SPACED" },
  { uid: "4920A594", name: "Pranav", domain: "MCSOD" },
  { uid: "19979B94", name: "Nimish", domain: "SAMBED" },
  { uid: "C975A294", name: "Swarnava", domain: "SPACED" },
  { uid: "2965A994", name: "Ananya", domain: "MCSOD" },
  { uid: "C9C89F94", name: "Devdath", domain: "SIESED" },
  { uid: "B9C79594", name: "Swapneel", domain: "SPACED" },
  { uid: "9118D54", name: "Rohan", domain: "MCSOD" },
  { uid: "698F9D94", name: "Mireya", domain: "SAMBED" },
  { uid: "298A194", name: "Yashodhara", domain: "MCSOD" },
  { uid: "9548E54", name: "Nithya Guru", domain: "SAMBED" },
  { uid: "59F2A794", name: "Sana", domain: "SAMBED" },
  { uid: "99A06661", name: "Agamjot Kaur", domain: "MCSOCD" },
];

