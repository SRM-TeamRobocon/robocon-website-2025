import Image from "next/image";

export default function HalloweenHero() {
  return <section className="haunt-hero" aria-labelledby="haunt-title">
    <Image className="haunt-scene" src="/halloween/haunted-lab.png" alt="A robot awakens in a violet-lit laboratory" fill priority sizes="100vw" />
    <div className="haunt-shade" />
    <div className="haunt-hero-copy">
      <h1 id="haunt-title">Happy<br />Halloween</h1>
    </div>
  </section>;
}
