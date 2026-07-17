import { Code2, ExternalLink } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import type { CodeRepo } from "@/data/ddRobocon";

export default function CodeShowcase({ repos }: { repos: CodeRepo[] }) {
  if (repos.length === 0) {
    return (
      <ScrollReveal>
        <p className="py-10 text-center text-white/50">Code repositories coming soon.</p>
      </ScrollReveal>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {repos.map((repo, index) => (
        <ScrollReveal key={repo.id} transition={{ duration: 0.5, ease: "easeOut", delay: Math.min(index, 6) * 0.08 }}>
          <TiltCard>
            <a
              href={repo.url}
              target="_blank"
              rel="noreferrer noopener"
              className="sharp-card group flex flex-col gap-2 rounded-2xl p-5"
            >
              <div className="flex items-center justify-between">
                <Code2 size={18} className="text-red" />
                <ExternalLink size={14} className="text-white/40 transition group-hover:text-white" />
              </div>
              <h3 className="font-bold text-white">{repo.title}</h3>
              {repo.description && <p className="text-sm text-white/60">{repo.description}</p>}
              {repo.language && (
                <span className="mt-auto w-fit rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70">
                  {repo.language}
                </span>
              )}
            </a>
          </TiltCard>
        </ScrollReveal>
      ))}
    </div>
  );
}
