import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import type { MatchVideo } from "@/data/ddRobocon";

export default function MatchVideos({ videos }: { videos: MatchVideo[] }) {
  if (videos.length === 0) {
    return (
      <ScrollReveal>
        <p className="py-10 text-center text-white/50">Match videos coming soon.</p>
      </ScrollReveal>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {videos.map((video, index) => (
        <ScrollReveal key={video.id} transition={{ duration: 0.5, ease: "easeOut", delay: Math.min(index, 6) * 0.08 }}>
          <TiltCard>
          <div className="sharp-card overflow-hidden rounded-2xl">
            <div className="relative aspect-video w-full bg-white/5">
              <iframe
                src={`https://www.youtube.com/embed/${video.youtubeId}`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <div className="p-4">
              <h3 className="font-bold text-white">{video.title}</h3>
              {video.description && <p className="mt-1 text-sm text-white/60">{video.description}</p>}
            </div>
          </div>
          </TiltCard>
        </ScrollReveal>
      ))}
    </div>
  );
}
