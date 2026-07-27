import Header from "@/components/Header";
import alumniData from "@/../public/alumni/alumniData.json";
import Footer from "@/components/Footer";
import AlumniCard from "@/components/AlumniCard";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

interface Alumni {
  Name: string;
  Domain: string,
  About: string,
  Designation: string;
  Facebook?: string;
  Linkedin?: string;
  Instagram?: string;
  Description: string
  Profession: string;
  PhotoUrl?: string;
}

interface AlumniData {
  [key: string]: Alumni[];
}

interface SupabaseAlumnus {
  name: string;
  domain: string | null;
  designation: string | null;
  about: string | null;
  description: string | null;
  profession: string | null;
  batch: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
}

function groupSupabaseAlumni(rows: SupabaseAlumnus[]): AlumniData {
  return rows.reduce<AlumniData>((groups, row) => {
    const batch = row.batch || "Alumni";
    groups[batch] = groups[batch] || [];
    groups[batch].push({
      Name: row.name,
      Domain: row.domain || "",
      Designation: row.designation || "",
      About: row.about || "",
      Description: row.description || "",
      Profession: row.profession || "",
      Facebook: row.facebook_url || undefined,
      Linkedin: row.linkedin_url || undefined,
      Instagram: row.instagram_url || undefined,
      PhotoUrl: row.photo_url || undefined,
    });
    return groups;
  }, {});
}

async function getAlumni(): Promise<AlumniData> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return alumniData as AlumniData;

  const { data, error } = await supabase
    .from("alumni")
    .select("name, domain, designation, about, description, profession, batch, photo_url, linkedin_url, instagram_url, facebook_url")
    .order("batch", { ascending: false, nullsFirst: false });

  if (error || !data?.length) return alumniData as AlumniData;
  return groupSupabaseAlumni(data);
}

export default async function Alumni() {
  const data = await getAlumni();

  return (
    <div className=" overflow-x-hidden ">
      <Header  />
      <section className="md:mx-28 mt-20">
        <h1 className="mb-10 text-4xl text-center md:text-left text-white">Alumni</h1>
        <div>
          {Object.keys(data).map((key) => (
            <div key={key} className="text-gray-50 mb-20">
              <h2 className="text-4xl ml-10 md:ml-5">{key.toString().replace(/"/g, '')}</h2>
              <div className="flex gap-10 m-5 flex-wrap justify-center md:justify-start">
                {data[key].map((obj, i) => (
                  <AlumniCard
                    key={i}
                    Name={obj["Name"]}
                    Domain={obj["Domain"]}
                    Designation={obj["Designation"]}
                    About={obj["About"]}
                    Facebook={obj["Facebook"]}
                    Linkedin={obj["Linkedin"]}
                    Instagram={obj["Instagram"]}
                    Description={obj["Description"]}
                    Profession={obj["Profession"]}
                    PhotoUrl={obj["PhotoUrl"]}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <Footer/>
    </div>
  );
}
