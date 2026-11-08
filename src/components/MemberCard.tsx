"use client";

import { useState } from "react";
import Image from "next/image";
import InstagramFillIcon from "remixicon-react/InstagramFillIcon";
import LinkedinBoxFillIcon from "remixicon-react/LinkedinBoxFillIcon";
import MoreFillIcon from "remixicon-react/MoreFillIcon";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";

export interface OtherSocialLink {
  name: string;
  url: string;
}

export interface MemberCardPropsType {
  Name: string;
  Designation: string;
  Facebook?: string;
  Linkedin?: string;
  Instagram?: string;
  Others?: OtherSocialLink[];
  ImageUrl?: string;
}

export default function MemberCard({
  Name,
  Designation,
  Facebook,
  Linkedin,
  Instagram,
  Others,
  ImageUrl,
}: MemberCardPropsType) {
  const [showOthers, setShowOthers] = useState(false);

  const combinedOthers: OtherSocialLink[] = [
    ...(Others || []),
    ...(Facebook && !Others?.some((o) => o.name?.toLowerCase() === "facebook")
      ? [{ name: "Facebook", url: Facebook }]
      : []),
  ].filter((item) => item && item.name && item.url);

  const hasOthers = combinedOthers.length > 0;

  return (
    <article onMouseLeave={() => setShowOthers(false)}>
      <div className="group w-[300px] h-[300px] [perspective:1000px] overflow-hidden">
        <div
          className={`relative h-full w-full shadow-xl transition-all duration-500 [transform-style:preserve-3d] group-focus:[transform:rotateY(180deg)] group-hover:[transform:rotateY(180deg)] ${
            showOthers ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          <div className="absolute inset-0 bg-slate-100 flex">
            <Image
              src={`${ImageUrl}`}
              alt={`${Name} profile image`}
              width={500}
              height={500}
              className="object-cover"
              unoptimized
            />
            <h1 className="text-xl absolute bottom-2 z-10 w-full bg-black/50 text-white group-hover:hidden text-center">
              {Name} <br /> <p className="text-lg">{Designation}</p>{" "}
            </h1>
          </div>
          <div className="absolute inset-0 h-full w-full bg-red/80 text-center text-slate-200 [transform:rotateY(180deg)] [backface-visibility:hidden] flex flex-col items-center justify-center gap-3 py-5 px-3">
            {!showOthers ? (
              <div className="flex gap-5 m-4 items-center justify-center">
                {Linkedin ? (
                  <Link
                    href={Linkedin.startsWith("http") ? Linkedin : `https://${Linkedin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <LinkedinBoxFillIcon
                      size={50}
                      className="hover:fill-white hover:scale-105 hover:cursor-pointer transition-transform"
                    />
                  </Link>
                ) : null}
                {Instagram ? (
                  <Link
                    href={Instagram.startsWith("http") ? Instagram : `https://${Instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <InstagramFillIcon
                      size={50}
                      className="hover:fill-white hover:scale-105 hover:cursor-pointer transition-transform"
                    />
                  </Link>
                ) : null}
                {hasOthers ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowOthers(true);
                    }}
                    title="Other social media"
                    aria-label="Other social media"
                    className="hover:scale-105 hover:cursor-pointer transition-transform p-0 bg-transparent border-0 text-slate-200 hover:text-white"
                  >
                    <MoreFillIcon size={50} className="hover:fill-white" />
                  </button>
                ) : null}
              </div>
            ) : (
              <div
                className="w-full h-full bg-black/90 backdrop-blur-md flex flex-col p-3 border border-white/20 text-left rounded-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2 shrink-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red">
                    Other Links
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowOthers(false)}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                    title="Back to social icons"
                    aria-label="Close other links"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto pr-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-white/10 text-[10px] uppercase">
                        <th className="py-1 px-1.5 text-left font-semibold">Social Media</th>
                        <th className="py-1 px-1.5 text-right font-semibold">Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {combinedOthers.map((item, idx) => {
                        const href = item.url.startsWith("http")
                          ? item.url
                          : `https://${item.url}`;
                        return (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td
                              className="py-1.5 px-1.5 font-medium text-white truncate max-w-[120px]"
                              title={item.name}
                            >
                              {item.name}
                            </td>
                            <td className="py-1.5 px-1.5 text-right">
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-red hover:text-white font-semibold transition-colors"
                              >
                                <span>Open</span>
                                <ExternalLink size={11} />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
