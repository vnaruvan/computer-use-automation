import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { loadArtifact } from "./artifact/load.js";
import { recordReplayEvidence } from "./evidence/record.js";
import { replayCapability } from "./replay/engine.js";

const artifact = await loadArtifact(
    "artifacts/member-balance.v1.json",
);

const simulatedArtifact = structuredClone(artifact);

const searchStep = simulatedArtifact.steps.find(
    (step) => step.id === "step-2",
);

if (!searchStep || searchStep.action !== "click") {
    throw new Error(
        "The expected Search step was not found.",
    );
}

const originalTargetName = searchStep.target.name;

searchStep.target.name =
    "Unavailable Search Control";

searchStep.timeoutMs = 1500;

const inputs = {
    memberId: "12345",
};

const browser = await chromium.launch({
    headless: true,
});

const page = await browser.newPage();

try {
    const result = await replayCapability({
        artifact: simulatedArtifact,
        inputs,
        baseUrl: "http://127.0.0.1:4173",
        page,
    });

    if (
        result.status !== "failure" ||
        result.code !== "TARGET_NOT_FOUND"
    ) {
        throw new Error(
            "The simulated locator failure was not detected correctly.",
        );
    }

    await recordReplayEvidence(
        simulatedArtifact,
        inputs,
        result,
        {
            fileLabel: "target-failure",

            context: {
                simulation: true,
                simulatedCondition:
                    "The recorded Search control could not be located.",
                originalTarget:
                    originalTargetName,
                injectedTarget:
                    searchStep.target.name,
            },
        },
    );

    await mkdir("evidence", {
        recursive: true,
    });

    const memberIdField = page.getByRole(
        "textbox",
        {
            name: "Member ID",
            exact: true,
        },
    );

    await page.screenshot({
        path:
            "evidence/replay-target-failure.png",
        fullPage: true,
        mask: [memberIdField],
        maskColor: "#000000",
    });

    console.log(
        JSON.stringify(result, null, 2),
    );

    console.log(
        "Expected locator failure captured.",
    );

    console.log(
        "Sensitive textbox masked in failure screenshot.",
    );
} finally {
    await browser.close();
}