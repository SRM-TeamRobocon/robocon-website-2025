import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Hero from "./Hero";
import AchievementSection from "./AchievementSection";
import BuildStory from "./BuildStory";
import Marquee from "@/components/ddrobocon/Marquee";
import CursorLights from "@/components/ddrobocon/CursorLights";
import SmoothScroll from "@/components/ddrobocon/SmoothScroll";
import ScrollProgressBar from "@/components/ddrobocon/ScrollProgressBar";
import ScrollReveal from "@/components/ddrobocon/ScrollReveal";
import MatchVideos from "@/components/ddrobocon/MatchVideos";
import PcbGallery from "@/components/ddrobocon/PcbGallery";
import CodeShowcase from "@/components/ddrobocon/CodeShowcase";
import { ddRoboconYear, ddRoboconTheme, achievement, matchVideos, bots, pcbItems, codeRepos } from "@/data/ddRobocon";

function SectionHeading({ index, title, center }: { index: string; title: string; center?: boolean }) {
  return (
    <ScrollReveal as="h2" className={`mb-8 text-3xl font-bold text-white md:text-4xl ${center ? "text-center" : ""}`}>
      <span className="mr-3 align-top text-sm font-medium tracking-widest text-red">{index}</span>
      {title}
    </ScrollReveal>
  );
}

export default function DDRoboconPage() {
  return (
    <div>
      <Header />
      <CursorLights />
      <SmoothScroll />
      <ScrollProgressBar />
      <Hero
        year={ddRoboconYear}
        theme={ddRoboconTheme}
        bots={bots}
        rank={achievement.rank}
      />

      <Marquee text={`SRM Team Robocon — DD Robocon ${ddRoboconYear} · ${ddRoboconTheme}`} />

      <AchievementSection
        rank={achievement.rank}
        label={achievement.label}
        year={ddRoboconYear}
        theme={ddRoboconTheme}
      />

      <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
        <SectionHeading index="01" title="Match Videos" />
        <MatchVideos videos={matchVideos} />
      </section>

      <Marquee text="Design — Build — Compete — Repeat" />

      <section className="mx-auto max-w-6xl px-4 py-20 md:px-8">
        <SectionHeading index="02" title="PCB Designs" />
        <PcbGallery items={pcbItems} />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:px-8">
        <SectionHeading index="03" title="Code" />
        <CodeShowcase repos={codeRepos} />
      </section>

      <Marquee text="Behind the Build" />

      <BuildStory modelUrl={bots[0]?.modelUrl} />

      <Footer />
    </div>
  );
}
