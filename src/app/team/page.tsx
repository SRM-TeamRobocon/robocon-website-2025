"use client";
import Header from "@/components/Header";
// import data from "@/../public/team/data.json";
import MemberCard from "@/components/MemberCard";
import Footer from "@/components/Footer";
import { MemberCardPropsType } from "@/components/MemberCard";
import { useEffect, useState } from "react";
// import { delay } from "framer-motion";
// import {DriveImage} from "./driveImage"

const fetchDataUrl =
  "https://script.google.com/macros/s/AKfycbyxSIPqvt_RxMKvEjaHUUZLt5sV9Yc1UKxOKqGLXlyDX8oKPWgg8Ci_4DiDIctmkj-kOw/exec";
interface TeamData {
  [key: string]: MemberCardPropsType[];
}

// const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// function extractIdFromUrl(url: string) {
//   let match = url.match(/id=([a-zA-Z0-9_-]+)/);
//   if (match) { return match[1]; }
//   match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
//   if (match) { return match[1]; }
//   console.log("NO extractidfromurl");
//   return null;
// }

// async function DriveImage(url: string) {
//   if (!url) return null;
//   const id = extractIdFromUrl(url);
//   if (!id) return null;

//   try {
//     const res = await fetch(
//       `https://image-retrieval-from-googledrive.onrender.com/api/search?q=${encodeURIComponent(id)}`
//     );
//     const data = await res.json();
//     if (Array.isArray(data) && data.length > 0) {
//       const img = data[0];
//       console.log("img id : ", img.id)
//       const isImage = (img.mimeType || "").startsWith("image/");
//       let imgSrc = img.thumbnailLink
//         ? img.thumbnailLink.replace(/=s\d+/, "=s220")
//         : "";
//       if (!imgSrc && isImage && img.id) {
//         imgSrc =
//           `https://lh3.googleusercontent.com/d/${img.id}=s220`;
//       }
//       if (!imgSrc && img.webContentLink && isImage) {
//         imgSrc = img.webContentLink;
//       }
//       console.log("imgSrc : ", imgSrc)
//       return imgSrc;
//     }
//   } catch (err) {
//     console.error("Image fetch error:", err);
//   }
//   return "https://monsterspost.com/wp-content/uploads/2019/03/Images.jpg"; // fallback
// }

export default function Team() {
  const [data, setData] = useState<TeamData | null>(null);
  const [selectedDomain, setSelectedDomain] = useState("ALL");
  const [isFading, setIsFading] = useState(false);
  // const [imageMap, setImageMap] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const domainOptions = (() => {
    if (!data) return ["ALL"];
    const desiredOrder = ["ALL", "LEADS", "SAMBED", "SIESED", "SPACED", "MCSOCD", "MENTORS"];
    const keys = Object.keys(data);
    const ordered: string[] = [];
    // add desired in order if present
    for (const d of desiredOrder) {
      if (d === "ALL") continue; // ALL is synthetic
      if (keys.includes(d)) ordered.push(d);
    }
    // append any remaining domains (alphabetical)
    const remaining = keys.filter(k => !ordered.includes(k)).sort((a,b)=>a.localeCompare(b));
    return ["ALL", ...ordered, ...remaining];
  })();

  const activeDomains =
    !data || selectedDomain === "ALL"
      ? data
        ? Object.keys(data)
        : []
      : [selectedDomain];

  const handleTabClick = (domain: string) => {
    if (domain === selectedDomain) return;
    setIsFading(true);
    window.setTimeout(() => {
      setSelectedDomain(domain);
      setIsFading(false);
    }, 150);
  };

  useEffect(() => {
    fetch(fetchDataUrl)
      .then((response) => response.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        setError("Failed to fetch data.");
        setLoading(false);
      });
  }, []);

  // console.log("Hello : ",imageMap["https://drive.google.com/file/d/1bCZPXY6t06noJMRZZSu_B9ZWF4mOB_Fj/view"]);

  if (error) {
    return <div>{error}</div>;
  }
  return (
    <div className=" overflow-x-hidden ">
      <Header />
      <section className="md:mx-28 mt-20">
        <h1 className="mb-10 text-4xl text-white text-center w-full whitespace-nowrap">
          Our Team
        </h1>
        <div>
          <div className="max-w-[1200px] mx-auto">
          {loading ? (
            <div className="p-5">
              <div className="h-8 md:w-1/3 bg-gray-700 mb-6 animate-pulse rounded mx-auto"></div>
              <div className="flex flex-wrap gap-10 justify-center">
                {[...Array(20)].map((_, index) => (
                  <div key={index} className="w-[300px] h-[300px] bg-gray-700 animate-pulse rounded-md p-4 flex flex-col gap-4">
                    <div className="w-12 h-12 bg-gray-900 rounded-full"></div>
                    <div className="h-4 bg-gray-900 rounded"></div>
                    <div className="h-4 bg-gray-900 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
          <>
            <div className="mb-6 px-4 md:px-0 pb-6">
              <div className="flex gap-3 overflow-x-auto no-scrollbar py-3 px-1 md:px-0 snap-x justify-center flex-wrap mx-auto">
                {domainOptions.map((domain) => {
                  const isSelected = domain === selectedDomain;
                  return (
                    <button
                      key={domain}
                      type="button"
                      onClick={() => handleTabClick(domain)}
                      className={`whitespace-nowrap rounded-md border px-5 py-3 text-base font-medium transition-all duration-200 flex-shrink-0 ${
                        isSelected
                          ? "bg-red text-white shadow-sm shadow-red/30"
                          : "border-white/10 bg-white/5 text-gray-100 hover:bg-white/15"
                      }`}
                    >
                      {domain}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`transition-opacity duration-150 ${isFading ? "opacity-0" : "opacity-100"}`}>
              {activeDomains.map((key) => (
                <div key={key} className="text-gray-50 mb-20">
                  <h2 className="text-4xl text-center">{key}</h2>
                  <div className="flex gap-10 m-5 flex-wrap justify-center">
                    {(data as TeamData)[key].map((obj, i) => (
                      <MemberCard
                        key={i}
                        Name={obj["Name"]}
                        Designation={obj["Designation"]}
                        Facebook={obj["Facebook"]}
                        Linkedin={obj["Linkedin"]}
                        Instagram={obj["Instagram"]}
                        ImageUrl={(obj as any)["Image"] || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
