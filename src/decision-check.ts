import { loadEnvFile } from "node:process";
import { chromium } from "playwright";
import { decideNextAction } from "./agent/decide.js";
import { observePage } from "./agent/observe.js";
import { executeDecision } from "./agent/execute.js";

loadEnvFile();

const browser = await chromium.launch({
    headless: true,
});

const page = await browser.newPage();

try {
    await page.goto("http://127.0.0.1:4173", {
        waitUntil: "domcontentloaded",
    });

    const observation = await observePage(page);

    const decision = await decideNextAction(
        "Look up member 12345 and read their current savings balance.",
        observation,
        [],
    );

    console.log("Model chose:");
    console.log(JSON.stringify(decision, null, 2));

    await executeDecision(page, decision);

    if (decision.type === "fill" && decision.target) {
        const enteredValue = await page
            .getByRole("textbox", {
                name: decision.target.name,
                exact: true,
            })
            .inputValue();

        console.log(
            `The browser textbox now contains ${enteredValue.length} characters.`,
        );
    }
} finally {
    await browser.close();
}