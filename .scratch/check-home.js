const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  const consoleMsgs = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  await page.goto("http://localhost:3001/", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Ask a Doubt", { timeout: 15000 }).catch(() => {});

  await page.screenshot({ path: "C:\\Users\\daksh\\Desktop\\srm\\robocon-website-2025\\.scratch\\home-full.png", fullPage: true });

  const widget = await page.locator("text=Ask a Doubt").locator("xpath=ancestor::div[contains(@class,'bg-white')][1]").first();
  if (await widget.count() > 0) {
    await widget.screenshot({ path: "C:\\Users\\daksh\\Desktop\\srm\\robocon-website-2025\\.scratch\\chat-widget.png" }).catch((e) => console.log("widget screenshot failed:", e.message));
  }

  console.log("=== PAGE ERRORS ===");
  console.log(errors.length ? errors.join("\n---\n") : "(none)");
  console.log("=== CONSOLE WARN/ERROR ===");
  console.log(consoleMsgs.length ? consoleMsgs.join("\n") : "(none)");

  await browser.close();
})();
