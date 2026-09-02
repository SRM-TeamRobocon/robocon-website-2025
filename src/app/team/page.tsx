import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TeamClient, { type TeamData } from "./TeamClient";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

const PLACEHOLDER_PHOTO = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

// Set to `false` to make this page fully static (only updates on redeploy).
// Set to a number of seconds (e.g. 60) to auto-refresh after that many seconds - Next.js requires
// this to be a literal value here, it can't be imported from a shared config file.
export const revalidate = 60;

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

async function getTeamData(): Promise<TeamData> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("members")
    .select("name, role, domain, photo_url, linkedin_url, instagram_url, facebook_url, is_active")
    .order("display_order", { ascending: true });

  if (error || !data?.length) return {};
  return groupSupabaseMembers(data);
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
