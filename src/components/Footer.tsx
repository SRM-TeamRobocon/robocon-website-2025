import Image from "next/image"
import FacebookBoxFillIcon from "remixicon-react/FacebookBoxFillIcon"
import InstagramFillIcon from "remixicon-react/InstagramFillIcon"
import LinkedinBoxFillIcon from "remixicon-react/LinkedinBoxFillIcon"
import YoutubeFillIcon from "remixicon-react/YoutubeFillIcon"

export default function Footer(){
    return (
        <footer id="contact" className="py-15 bg-black/10 backdrop-blur-sm text-white">
        {/* <img src="/footerDivider.svg" className="w-full" /> */}
        <div className="flex justify-around flex-wrap py-7">
          <div className="mt-10 flex flex-col gap-5">
            <div className="md:ml-10">
              <Image
                src={"/textLogo.svg"}
                alt="SRM Team Robocon"
                width={210}
                height={200}
                unoptimized
              ></Image>
            </div>
            <div className="md:m-10 w-64 md:w-[400px]">
              SRM Team ROBOCON Lab, Aarush Building, Main Campus, SRMIST, Kattankulathur, Chennai 603203
            </div>
          </div>
          <div className="mt-10">
            <div className="text-xl border-b-0 border-red pl-4 pb-3">
              Social Media
            </div>
            <div className="flex gap-5 m-4">
              <a href="https://www.facebook.com/roboconindia/" target="_blank" rel="noopener noreferrer" aria-label="SRM Team Robocon on Facebook">
                <FacebookBoxFillIcon size={50} className="hover:fill-red hover:cursor-pointer" aria-hidden="true" />
              </a>
              <a href="https://in.linkedin.com/company/srmteamrobocon/" target="_blank" rel="noopener noreferrer" aria-label="SRM Team Robocon on LinkedIn">
                <LinkedinBoxFillIcon size={50} className="hover:fill-red hover:cursor-pointer" aria-hidden="true" />
              </a>
              <a href="https://www.instagram.com/srmteamrobocon/" target="_blank" rel="noopener noreferrer" aria-label="SRM Team Robocon on Instagram">
                <InstagramFillIcon size={50} className="hover:fill-red hover:cursor-pointer" aria-hidden="true" />
              </a>
              <a href="https://www.youtube.com/channel/UCDPES1-ulIEMp-mEpOsdaoA/" target="_blank" rel="noopener noreferrer" aria-label="SRM Team Robocon on YouTube">
                <YoutubeFillIcon size={50} className="hover:fill-red hover:cursor-pointer" aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="flex gap-2">
            <Image
              src={"/LOGO.png"}
              alt="SRM Team Robocon"
              width={150}
              height={150}
              className="md:w-44 md:h-44"
              unoptimized
            ></Image>
            <Image
              src={"/collegelogo.png"}
              alt="SRM Institute of Science and Technology"
              width={150}
              height={150}
              className="md:w-44 md:h-44"
              unoptimized
            ></Image>
          </div>
        </div>
      </footer>
    )
}