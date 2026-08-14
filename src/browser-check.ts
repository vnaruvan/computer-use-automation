import { chromium } from "playwright";
import { observePage } from "./agent/observe.js";

const browser = await chromium.launch({
    headless: true,
});

const page = await browser.newPage();

try {
    await page.goto("http://127.0.0.1:4173", {
        waitUntil: "domcontentloaded",
    });

    await page.getByLabel("Member ID").fill("12345");

    await page.getByRole("button", { name: "Search" }).click();

    await page.getByText("Jordan Lee").waitFor();

    const observation = await observePage(page);

    console.log("Browser observed:");
    console.log(JSON.stringify(observation, null, 2));
} finally {
    await browser.close();
}