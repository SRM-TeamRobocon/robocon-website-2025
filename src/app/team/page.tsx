import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TeamClient, { type TeamData } from "./TeamClient";
import staticTeamData from "@/../public/team/data.json";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

const fetchDataUrl =
  "https://script.google.com/macros/s/AKfycbyxSIPqvt_RxMKvEjaHUUZLt5sV9Yc1UKxOKqGLXlyDX8oKPWgg8Ci_4DiDIctmkj-kOw/exec";

const PLACEHOLDER_PHOTO = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

interface SupabaseMember {
  name: string;
  role: string;
  domain: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  is_active: boolean;
}

function groupSupabaseMembers(members: SupabaseMember[]): TeamData {
  return members
    .filter((member) => member.is_active !== false)
    .reduce<TeamData>((groups, member) => {
      const domain = (member.domain || "MEMBERS").toUpperCase();
      groups[domain] = groups[domain] || [];
      groups[domain].push({
        Name: member.name,
        Designation: member.role,
        Linkedin: member.linkedin_url || undefined,
        Instagram: member.instagram_url || undefined,
        Facebook: member.facebook_url || undefined,
        ImageUrl: member.photo_url || PLACEHOLDER_PHOTO,
      });
      return groups;
    }, {});
}

function normalizeFallbackData(raw: TeamData): TeamData {
  const normalized: TeamData = {};
  for (const domain of Object.keys(raw)) {
    normalized[domain] = raw[domain].map((member) => ({
      ...member,
      ImageUrl: (member as any).Image || member.ImageUrl || PLACEHOLDER_PHOTO,
    }));
  }
  return normalized;
}

async function getTeamData(): Promise<TeamData> {
  const supabase = createPublicSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("members")
      .select("name, role, domain, photo_url, linkedin_url, instagram_url, facebook_url, is_active")
      .order("display_order", { ascending: true });

    if (!error && data?.length) return groupSupabaseMembers(data);
  }

  try {
    const res = await fetch(fetchDataUrl, { cache: "no-store" });
    const json = await res.json();
    if (json && Object.keys(json).length) return normalizeFallbackData(json);
  } catch (error) {
    console.error("Error fetching team data from Google Sheet:", error);
  }

  return normalizeFallbackData(staticTeamData as TeamData);
}

export default async function Team() {
  const data = await getTeamData();

  return (
    <div className=" overflow-x-hidden ">
      <Header />
      <section className="md:mx-28 mt-20">
        <h1 className="mb-10 text-4xl text-white text-center w-full whitespace-nowrap">
          Our Team
        </h1>
        <div>
          <div className="max-w-[1200px] mx-auto">
            <TeamClient initialData={data} />
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
