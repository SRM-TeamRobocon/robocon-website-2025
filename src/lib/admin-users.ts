export const ADMIN_USERNAME_MAP: Record<string, string> = {
  spacedlead: "Siddhant Jain",
  roboconlead: "Anushree Datta",
  siesedlead: "Ashutosh",
  mcsocdlead: "Agamjot Kaur",
  sambedlead: "Nithya Guru",
};

export function displayNameForUsername(username: string | undefined | null) {
  if (!username) return "Member";
  return ADMIN_USERNAME_MAP[username] || username;
}
