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
  // const [imageMap, setImageMap] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // useEffect(() => {
  //   async function fetchData() {
  //     try {
  //       const response = await fetch(fetchDataUrl);
  //       const fetchedData = await response.json();
  //       setData(fetchedData);

  //       const newImageMap: { [key: string]: string } = {};
  //       for (const key of Object.keys(fetchedData)) {
  //         for (const member of fetchedData[key]) {
  //           if (member.Image) {
  //             const imgURL = await DriveImage(member.Image);
  //             newImageMap[member.Image] = imgURL || "";
  //           }
  //         }
  //         await delay(1500); // To avoid hitting rate limits
  //       }
  //       setImageMap(newImageMap);
  //       setLoading(false);
  //     } catch (err) {
  //       console.error("Error fetching data:", err);
  //       setError("Failed to fetch data.");
  //       setLoading(false);
  //     }
  //   }
  //   fetchData();
  // }, []);

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
        <h1 className="mb-10 text-4xl text-white text-center md:text-left w-full  whitespace-nowrap">
          Our Team
        </h1>
        <div>
          {loading ? (
            <div className="p-5">
              <div className="h-8 md:w-1/3 bg-gray-700 mb-6 animate-pulse rounded"></div>
              <div className="flex flex-wrap gap-10 justify-around md:justify-around">
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
            Object.keys(data!).map((key) => (
              <div key={key} className="text-gray-50 mb-20">
                <h2 className="text-4xl ml-10 md:ml-5">{key}</h2>
                <div className="flex gap-10 m-5 flex-wrap justify-center md:justify-start">
                  {(data as TeamData)[key].map((obj, i) => (
                    <MemberCard
                      key={i}
                      Name={obj["Name"]}
                      Designation={obj["Designation"]}
                      Facebook={obj["Facebook"]}
                      Linkedin={obj["Linkedin"]}
                      Instagram={obj["Instagram"]}
                      // ImageURL={imageMap[obj["Image"]] || "https://static.vecteezy.com/system/resources/previews/036/280/650/large_2x/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-illustration-vector.jpg"}
                      ImageUrl={(obj as any)["Image"] || "https://static.vecteezy.com/system/resources/previews/036/280/650/large_2x/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-illustration-vector.jpg"}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}
