import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { loadArtifact } from "./artifact/load.js";
import { recordReplayEvidence } from "./evidence/record.js";
import { replayCapability } from "./replay/engine.js";

const memberId = process.argv[2];

if (!memberId) {
    throw new Error(
        "Usage: npm run replay -- <memberId>",
    );
}

const artifact = await loadArtifact(
    "artifacts/member-balance.v1.json",
);

const inputs = {
    memberId,
};

const browser = await chromium.launch({
    headless: true,
});

const page = await browser.newPage();

try {
    const result = await replayCapability({
        artifact,
        inputs,
        baseUrl: "http://127.0.0.1:4173",
        page,
    });

    console.log(JSON.stringify(result, null, 2));

    await recordReplayEvidence(
        artifact,
        inputs,
        result,
    );

    if (result.status === "failure") {
        await mkdir("evidence", {
            recursive: true,
        });

        await page.screenshot({
            path: "evidence/replay-failure.png",
            fullPage: true,
        });

        process.exitCode = 1;
    }
} finally {
    await browser.close();
}