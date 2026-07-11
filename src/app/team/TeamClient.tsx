"use client";

import { useState } from "react";
import MemberCard from "@/components/MemberCard";
import type { MemberCardPropsType } from "@/components/MemberCard";

export interface TeamData {
  [key: string]: MemberCardPropsType[];
}

const PLACEHOLDER_PHOTO = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

export default function TeamClient({ initialData }: { initialData: TeamData }) {
  const [selectedDomain, setSelectedDomain] = useState("ALL");
  const [isFading, setIsFading] = useState(false);

  const domainOptions = (() => {
    const desiredOrder = ["ALL", "LEADS", "SAMBED", "SIESED", "SPACED", "MCSOCD", "MENTORS"];
    const keys = Object.keys(initialData);
    const ordered: string[] = [];
    for (const d of desiredOrder) {
      if (d === "ALL") continue;
      if (keys.includes(d)) ordered.push(d);
    }
    const remaining = keys.filter((k) => !ordered.includes(k)).sort((a, b) => a.localeCompare(b));
    return ["ALL", ...ordered, ...remaining];
  })();

  const activeDomains =
    selectedDomain === "ALL" ? domainOptions.filter((d) => d !== "ALL") : [selectedDomain];

  const handleTabClick = (domain: string) => {
    if (domain === selectedDomain) return;
    setIsFading(true);
    window.setTimeout(() => {
      setSelectedDomain(domain);
      setIsFading(false);
    }, 150);
  };

  return (
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
              {initialData[key].map((obj, i) => (
                <MemberCard
                  key={i}
                  Name={obj["Name"]}
                  Designation={obj["Designation"]}
                  Facebook={obj["Facebook"]}
                  Linkedin={obj["Linkedin"]}
                  Instagram={obj["Instagram"]}
                  ImageUrl={obj["ImageUrl"] || PLACEHOLDER_PHOTO}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
