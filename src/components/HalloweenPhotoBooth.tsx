"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Upload, X, ArrowLeft, Download, Ghost, Aperture, Check } from "lucide-react";

type Frame = { name: string; image: string; color: string; count: number; corners?: number[][] };
const frames: Frame[] = [
  { name: "Ghost archive", image: "/halloween/gothic-frame.jpg", color: "#151515", count: 3 },
  { name: "Electric haunt", image: "/halloween/electric-frame.png", color: "#152646", count: 3 },
  { name: "Midnight print", image: "", color: "#251633", count: 3 },
];
frames.push(
 {name:"Purple moon",image:"/halloween/purple-moon.jpg",color:"#271d32",count:2,corners:[[90,178,468,175,94,575],[314,694,717,726,275,1108]]},
 {name:"Red television",image:"/halloween/red-tv.jpg",color:"#230707",count:3,corners:[[100,170,342,169,100,344],[61,620,303,618,62,793],[219,1021,461,1020,220,1194]]},
 {name:"Lace",image:"/halloween/lace.jpg",color:"#201c1c",count:3,corners:[[254,94,678,94,254,367],[254,480,678,480,254,753],[254,908,677,908,254,1176]]},
 {name:"Noir",image:"/halloween/noir.jpg",color:"#111111",count:3,corners:[[371,196,562,229,323,486],[23,462,229,401,109,770],[425,608,605,713,259,894]]},
 {name:"Vampire",image:"/halloween/vampire.jpg",color:"#2b0c12",count:3,corners:[[55,44,383,44,55,379],[339,429,631,429,339,727],[44,770,353,770,44,1087]]},
 {name:"Goth television",image:"/halloween/goth-tv.jpg",color:"#151714",count:2,corners:[[191,137,574,209,139,407],[152,637,522,597,185,908]]},
 {name:"Stars",image:"/halloween/stars.png",color:"#190c22",count:3,corners:[[64,41,727,41,64,704],[515,798,1130,798,515,1413],[98,1461,568,1461,98,1930]]}
);
const filters = [
  { name: "Original", value: "none" },
  { name: "Silver screen", value: "grayscale(1) contrast(1.12)" },
  { name: "Old film", value: "sepia(.65) saturate(.7)" },
];
const captions = [
  { group: "Swarnava", items: ["Swarnava's SPACED. No cap, she's delulu.", "Swarnava's lab has immaculate ghost aura.", "Swarnava's SPACED and the bots are in their flop era."] },
  { group: "Karthik", items: ["Karthik's SIESED. His aura? Dead.", "Karthik's build got ghosted.", "Karthik's SIESED. Lowkey haunted, highkey cooking."] },
  { group: "Ashwin", items: ["Ashwin's MCSOCD. Main character energy, 3 AM.", "Ashwin's side quest became the whole plot."] },
  { group: "Nithya", items: ["Nithya's SAMBED. Brainrot is the bot.", "Nithya's code is coded, fr."] },
  { group: "Nilesh", items: ["Nilesh said 'ship it.' It's giving haunted.", "Nilesh shipped it. The ghost approved."] },
  { group: "Joselin", items: ["Joselin: 'Fix the bug.' Us: 'No shot it's haunted, fr.'", "Joselin's vibe check: failed. The PCBs are sus.", "Joselin said debug. The ghost said bet."] },
  { group: "SRM Team Robocon", items: ["Deadass, the robots out-rizz our costumes.", "Team aura: unmatched. Sleep schedule: cooked.", "The bot understood the assignment. We didn't.", "Built different. Possibly possessed.", "SRM Potheri. Canon event: October 31st.", "Potheri's goatiest lab. Ngl, it's haunted."] },
];
const allCaptions = captions.flatMap(group => group.items);
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This image could not be opened. Try a JPEG or PNG."));
    image.src = src;
  });
}
function crop(ctx: CanvasRenderingContext2D, image: CanvasImageSource, iw: number, ih: number, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / iw, h / ih);
  ctx.drawImage(image, (iw-w/scale)/2, (ih-h/scale)/2, w/scale, h/scale, x, y, w, h);
}
export default function HalloweenPhotoBooth() {
  const [photoCount, setPhotoCount] = useState(3);
  const [photos, setPhotos] = useState<string[]>([]);
  const [stage, setStage] = useState("capture");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shot, setShot] = useState(0);
  const [frame, setFrame] = useState(0);
  const [filter, setFilter] = useState(0);
  const [captionMode, setCaptionMode] = useState("random");
  const [caption, setCaption] = useState(() => allCaptions[Math.floor(Math.random() * allCaptions.length)]);
  const [error, setError] = useState("");
  const [rendered, setRendered] = useState(false);
  const [saved, setSaved] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<MediaStream | null>(null);
  const run = useRef(0);
  const mounted = useRef(true);
  function stopCamera() {
    camera.current?.getTracks().forEach(track => track.stop());
    camera.current = null; setStream(null); setReady(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; run.current++; camera.current?.getTracks().forEach(track => track.stop()); };
  }, []);
  useEffect(() => { if (video.current && stream) video.current.srcObject = stream; }, [stream]);
  async function startCamera() {
    const request = ++run.current; setError(""); setBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera requires HTTPS or localhost. Upload photos instead.");
      const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false });
      if (!mounted.current || request !== run.current) { next.getTracks().forEach(track => track.stop()); return; }
      camera.current = next; setStream(next);
    } catch (e) { if (mounted.current) setError(e instanceof DOMException ? "Camera unavailable. Allow camera access or upload your photos." : (e as Error).message); }
    finally { if (mounted.current && request === run.current) setBusy(false); }
  }
  function cancel() { run.current++; stopCamera(); setCountdown(null); setBusy(false); }
  async function capture() {
    if (!ready || busy) return;
    const request = ++run.current; setBusy(true); setError("");
    const result = [...photos];
    try {
      for (let i = result.length; i < photoCount; i++) {
        setShot(i + 1);
        for (let tick = 3; tick > 0; tick--) {
          setCountdown(tick); await new Promise(resolve => setTimeout(resolve, 1000));
          if (!mounted.current || request !== run.current) return;
        }
        const source = video.current;
        if (!source?.videoWidth || source.readyState < 2) throw new Error("Camera stopped. Reopen it or upload your photos.");
        const target = document.createElement("canvas"); target.width = 1000; target.height = 1000;
        const ctx = target.getContext("2d"); if (!ctx) throw new Error("Capture is unavailable in this browser.");
        // Store raw mirrored photos; apply the selected finish once during final rendering.
        ctx.translate(1000, 0); ctx.scale(-1, 1);
        crop(ctx, source, source.videoWidth, source.videoHeight, 0, 0, 1000, 1000);
        result.push(target.toDataURL("image/jpeg", .93)); setPhotos([...result]); setCountdown(0);
        await new Promise(resolve => setTimeout(resolve, 350));
        if (!mounted.current || request !== run.current) return;
      }
      stopCamera(); setStage("decorate");
    } catch (e) { setError((e as Error).message); stopCamera(); }
    finally { if (mounted.current && request === run.current) { setBusy(false); setCountdown(null); } }
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (files.length > photoCount - photos.length) { setError("Choose up to " + (photoCount-photos.length) + " more photos."); return; }
    const selected = Array.from(files);
    if (selected.some(f => !["image/jpeg","image/png","image/webp","image/gif"].includes(f.type) || f.size > 12*1024*1024)) {
      setError("Use JPEG, PNG, WebP or GIF images under 12 MB each."); return;
    }
    cancel(); setBusy(true); setError("");
    try {
      const result = [...photos];
      for (const file of selected) {
        const url = URL.createObjectURL(file);
        try {
          const image = await loadImage(url);
          if (image.width*image.height > 50000000) throw new Error("Resize this photo below 50 megapixels.");
          const target = document.createElement("canvas");
          const scale = Math.min(1, 1800/Math.max(image.width, image.height));
          target.width = Math.round(image.width*scale); target.height = Math.round(image.height*scale);
          const ctx = target.getContext("2d"); if (!ctx) throw new Error("Image processing is unavailable.");
          ctx.drawImage(image, 0, 0, target.width, target.height);
          result.push(target.toDataURL("image/jpeg", .93));
        } finally { URL.revokeObjectURL(url); }
      }
      if (mounted.current) { setPhotos(result); if (result.length === photoCount) setStage("decorate"); }
    } catch (e) { if (mounted.current) setError((e as Error).message); }
    finally { if (mounted.current) setBusy(false); }
  }
  useEffect(() => {
    if (stage !== "decorate" || photos.length !== photoCount) return;
    let cancelled = false; setRendered(false); setSaved(false); setError("");
    async function render() {
      try {
        const images = await Promise.all(photos.map(loadImage));
        const background = frames[frame].image ? await loadImage(frames[frame].image) : null;
        const logo = await loadImage("/logo_nb.png");
        const font = getComputedStyle(document.body).getPropertyValue("--font-robocon").trim();
        await document.fonts.load("34px " + font);
        if (cancelled || !canvas.current) return;
        const target = canvas.current; target.width = 1080; target.height = 2080;
        const ctx = target.getContext("2d"); if (!ctx) throw new Error("Image export unavailable.");
        ctx.fillStyle = frames[frame].color; ctx.fillRect(0, 0, 1080, 2080);
        if (background) ctx.drawImage(background, 0, 0, 1080, 1920);
        const slots = frame === 0 ? [[65,60,375,490,0],[550,675,480,580,0],[60,1410,380,460,0]]
          : frame === 1 ? [[205,353,400,445,-10],[572,745,400,445,12],[235,1375,415,445,-12]]
          : [[85,90,910,490,-2],[85,700,910,490,2],[85,1310,910,490,-2]];
        images.forEach((image, i) => {
          if (frame === 1 || frames[frame].corners) {
            // Match the inner corners of each photographed, rotated Polaroid.
            const corners = frames[frame].corners?.[i] ?? [[166,358,579,286,249,845],[624,697,1012,792,521,1116],[240,1366,660,1273,342,1826]][i];
            const [ax,ay,bx,by,cx,cy] = corners;
            const width = Math.hypot(bx-ax,by-ay), height = Math.hypot(cx-ax,cy-ay);
            ctx.save();
            if (frames[frame].corners && background) ctx.scale(1080/background.width,1920/background.height);
            ctx.transform((bx-ax)/width,(by-ay)/width,(cx-ax)/height,(cy-ay)/height,ax,ay);
            ctx.filter = filters[filter].value;
            crop(ctx,image,image.width,image.height,0,0,width,height);
            ctx.restore();
            return;
          }
          const [x,y,w,h,angle] = slots[i]; ctx.save(); ctx.translate(x+w/2,y+h/2); ctx.rotate(angle*Math.PI/180);
          if (frame === 2) { ctx.fillStyle = "#efe8db"; ctx.fillRect(-w/2-18,-h/2-18,w+36,h+90); }
          ctx.filter = filters[filter].value;
          crop(ctx,image,image.width,image.height,-w/2,-h/2,w,h); ctx.restore();
        });
        ctx.fillStyle = "#eee5d6"; ctx.font = "34px " + font; ctx.fillText(caption,45,2005,800);
        ctx.drawImage(logo,940,1945,95,95); setRendered(true);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
    }
    void render(); return () => { cancelled = true; };
  }, [photos,stage,frame,filter,caption,photoCount]);
  function download() {
    if (!rendered || !canvas.current) return;
    canvas.current.toBlob(blob => {
      if (!blob) { setError("Could not save the strip. Try again."); return; }
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = "robocon-after-dark.png"; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url),60000); setSaved(true);
    }, "image/png");
  }
  return <section id="halloween-booth" className="haunt-booth" aria-labelledby="booth-title">
    <div className="haunt-booth-heading"><h2 id="booth-title">Halloween photo booth</h2></div>
    <div className="haunt-machine">
      <div className="haunt-machine-top"><span><Aperture size={20} /> Robocon after dark</span><span className="haunt-status"><i />{stage === "decorate" ? "In the darkroom" : stream ? "Camera online" : "Booth available"}</span></div>
      {stage === "capture" ? <>
        <div className="haunt-camera-stage">
          <div className="haunt-curtain" aria-hidden="true" /><div className="haunt-curtain haunt-curtain-right" aria-hidden="true" />
          <div className="haunt-viewfinder">
            {stream ? <video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} aria-label="Live camera preview" /> : <div className="haunt-camera-empty"><Ghost size={66} strokeWidth={1} /><h3>Camera preview</h3></div>}
            {countdown !== null && <div className={"haunt-countdown " + (countdown === 0 ? "haunt-flash" : "")} aria-live="polite">{countdown || ""}</div>}
            {stream && <button className="haunt-close" onClick={cancel} aria-label="Stop camera and cancel capture"><X size={20} /></button>}
            <div className="haunt-camera-caption">{countdown !== null ? `Shot ${shot} of ${photoCount}` : `${photoCount} photos · 3-second countdown`}</div>
          </div>
        </div>
        <div className="haunt-console">
          <div className="haunt-filter-options" role="group" aria-label="Photo count">{[2,3].map(count => <button key={count} disabled={busy || photos.length > 0} aria-pressed={photoCount === count} onClick={() => { setPhotoCount(count); setFrame(frames.findIndex(item => item.count === count)); }}>{count} photos</button>)}</div>
          <div className="haunt-shot-list" aria-label={photos.length + " of " + photoCount + " photos ready"}>{Array.from({length:photoCount},(_,i) => i).map(i => <div key={i}>{photos[i] ? <><img src={photos[i]} alt={"Shot " + (i+1)} /><button disabled={busy} onClick={() => setPhotos(current => current.filter((_,n) => n !== i))} aria-label={"Remove shot " + (i+1)}><X size={13} /></button></> : <span>{i+1}</span>}</div>)}</div>
          <div className="haunt-capture-actions"><button className="haunt-primary" disabled={busy || (!!stream && !ready)} onClick={() => void (stream ? capture() : startCamera())}><Camera size={20} />{busy ? countdown !== null ? "Hold that pose…" : "One moment…" : stream ? "Take " + (photoCount-photos.length) + " photos" : "Turn on camera"}</button><button className="haunt-secondary" disabled={busy} onClick={() => input.current?.click()}><Upload size={17} /> Upload photos</button><input ref={input} hidden type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => { void upload(e.target.files); e.target.value = ""; }} /></div>
          <p className="haunt-privacy">Photos stay on your device.</p>
        </div>
      </> : <div className="haunt-develop">
        <div className="haunt-print-preview"><canvas ref={canvas} aria-label="Your finished photo strip, exactly as downloaded" /></div>
        <div className="haunt-editor"><button className="haunt-back" onClick={() => { setStage("capture"); setPhotos([]); setError(""); }}><ArrowLeft size={16} /> Take another set</button><h3>Your photo strip</h3>
          <fieldset><legend>Choose your frame</legend><div className="haunt-frame-options">{frames.map((option,i) => option.count === photoCount && <button key={option.name} aria-pressed={frame === i} onClick={() => setFrame(i)}><span style={{ backgroundColor: option.color, backgroundImage: option.image ? 'url("' + option.image + '")' : undefined }} />{option.name}{frame === i && <Check size={15} />}</button>)}</div></fieldset>
          <fieldset><legend>The finish</legend><div className="haunt-filter-options">{filters.map((option,i) => <button key={option.name} aria-pressed={filter === i} onClick={() => setFilter(i)}>{option.name}</button>)}</div></fieldset>
          <label className="haunt-caption-label">Photo caption<select value={captionMode} onChange={event => { const value = event.target.value; setCaptionMode(value); if (value === "random") setCaption(allCaptions[Math.floor(Math.random() * allCaptions.length)]); else if (value !== "custom") setCaption(value); }}><option value="random">Random caption</option>{captions.map(group => <optgroup key={group.group} label={group.group}>{group.items.map(item => <option key={item} value={item}>{item}</option>)}</optgroup>)}<option value="custom">Enter your own</option></select>{captionMode === "custom" && <input maxLength={100} value={caption} placeholder="Write a caption" onChange={event => setCaption(event.target.value)} />}</label>
          <button className="haunt-primary" disabled={!rendered} onClick={download}><Download size={19} />{saved ? "Download again" : rendered ? "Download photo strip" : "Developing…"}</button><p className="haunt-save-note" role="status">{saved ? "Download started. Check your browser’s downloads." : "Full-resolution PNG · Robocon logo in the corner"}</p>
        </div>
      </div>}
      {error && <p role="alert" className="haunt-error">{error}</p>}
    </div>
  </section>;
}

