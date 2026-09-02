// Draws a portrait ID-badge image (logo + name + QR) onto an offscreen canvas and
// returns a PNG data URL, for use as the Lanyard component's `frontImage` prop.
// Client-only - uses document/Image, must be called inside a browser context.

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

export async function generateBadgeImage(params: { name: string; regNo: string; qrDataUrl: string; logoSrc: string }): Promise<string> {
    const { name, regNo, qrDataUrl, logoSrc } = params;

    const W = 640;
    const H = 964; // matches the card model's front-face aspect ratio (~0.5 / 0.755 of the atlas)
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return qrDataUrl;

    // Background
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#151521");
    grad.addColorStop(1, "#0a0a0f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Top accent bar
    ctx.fillStyle = "#C20000";
    ctx.fillRect(0, 0, W, 14);

    const [logo, qr] = await Promise.all([loadImage(logoSrc), loadImage(qrDataUrl)]);

    // Logo + title share one row, centered together as a group. The whole content
    // block (this row down through the reg no) is vertically centered between the
    // top/bottom accent bars rather than pinned to the top, so it doesn't leave a
    // big dead gap under the reg no on this tall a canvas.
    const logoSize = 68;
    const gap = 16;
    ctx.font = "bold 34px Arial, sans-serif";
    const titleText = "SRM TEAM ROBOCON";
    const titleWidth = ctx.measureText(titleText).width;
    const groupWidth = logoSize + gap + titleWidth;
    const groupX = W / 2 - groupWidth / 2;
    const rowY = 141;

    ctx.drawImage(logo, groupX, rowY, logoSize, logoSize);

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(titleText, groupX + logoSize + gap, rowY + logoSize / 2);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#C20000";
    ctx.font = "bold 20px Arial, sans-serif";
    ctx.fillText("RECRUITMENT PASS", W / 2, rowY + logoSize + 36);

    // QR code panel
    const qrSize = 380;
    const qrX = W / 2 - qrSize / 2;
    const qrY = 307;
    ctx.fillStyle = "#ffffff";
    const pad = 18;
    ctx.beginPath();
    const r = 16;
    const rx = qrX - pad, ry = qrY - pad, rw = qrSize + pad * 2, rh = qrSize + pad * 2;
    ctx.moveTo(rx + r, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
    ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
    ctx.arcTo(rx, ry + rh, rx, ry, r);
    ctx.arcTo(rx, ry, rx + rw, ry, r);
    ctx.closePath();
    ctx.fill();
    ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

    // Name + reg no
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px Arial, sans-serif";
    const displayName = name.length > 22 ? name.slice(0, 21) + "…" : name;
    ctx.fillText(displayName, W / 2, qrY + qrSize + 90);

    ctx.fillStyle = "#9ca3af";
    ctx.font = "26px Arial, sans-serif";
    ctx.fillText(regNo, W / 2, qrY + qrSize + 130);

    // Bottom accent bar
    ctx.fillStyle = "#C20000";
    ctx.fillRect(0, H - 10, W, 10);

    return canvas.toDataURL("image/png");
}
