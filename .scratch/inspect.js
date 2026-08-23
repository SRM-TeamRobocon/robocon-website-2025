const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto("http://localhost:3001/", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Ask a Doubt", { timeout: 15000 });

  const info = await page.evaluate(() => {
    const header = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === "Ask a Doubt");
    const card = header ? header.closest(".bg-white") : null;
    if (!card) return { error: "card not found" };

    const beforeStyle = getComputedStyle(card, "::before");
    const cardStyle = getComputedStyle(card);
    const rect = card.getBoundingClientRect();

    return {
      cardClassName: card.className,
      cardInlineStyle: card.getAttribute("style"),
      cardComputed: {
        backgroundColor: cardStyle.backgroundColor,
        clipPath: cardStyle.clipPath,
        position: cardStyle.position,
        isolation: cardStyle.isolation,
      },
      beforeComputed: {
        content: beforeStyle.content,
        position: beforeStyle.position,
        inset: beforeStyle.inset,
        zIndex: beforeStyle.zIndex,
        clipPath: beforeStyle.clipPath,
        backgroundColor: beforeStyle.backgroundColor,
      },
      cardRect: { width: rect.width, height: rect.height },
      cssVarClipOnCard: cardStyle.getPropertyValue("--clip"),
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
