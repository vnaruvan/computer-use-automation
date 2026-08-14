import { loadEnvFile } from "node:process";
import { chromium } from "playwright";
import {
    decideNextAction,
    type AgentDecision,
} from "./agent/decide.js";
import { executeDecision } from "./agent/execute.js";
import { observePage } from "./agent/observe.js";
import { buildMemberBalanceArtifact } from "./artifact/build.js";
import { saveArtifact } from "./artifact/save.js";



loadEnvFile();

const goal =
    "Look up member 12345 and read their current savings balance.";

const maximumSteps = 6;
const previousActions: AgentDecision[] = [];

const browser = await chromium.launch({
    headless: true,
});

const page = await browser.newPage();

let completed = false;

try {
    await page.goto("http://127.0.0.1:4173", {
        waitUntil: "domcontentloaded",
    });

    for (let step = 1; step <= maximumSteps; step += 1) {
        const observation = await observePage(page);

        const decision = await decideNextAction(
            goal,
            observation,
            previousActions,
        );

        console.log(`Step ${step}: ${decision.type}`);
        console.log(`Reason: ${decision.reason}`);

        if (decision.target) {
            console.log(
                `Target: ${decision.target.role} "${decision.target.name}"`,
            );
        }

        if (decision.type === "finish") {
            console.log("Goal completed.");
            console.log("Outputs returned to caller:");
            console.log(JSON.stringify(decision.outputs, null, 2));

            const artifact =
                buildMemberBalanceArtifact(previousActions);

            const artifactPath =
                "artifacts/member-balance.v1.json";

            await saveArtifact(artifact, artifactPath);

            console.log(`Artifact saved to ${artifactPath}`);

            completed = true;
            break;
        }

        if (decision.type === "escalate") {
            console.log("Human intervention required.");
            break;
        }

        await executeDecision(page, decision);
        previousActions.push(decision);
    }

    if (!completed) {
        console.log("The agent stopped without completing the goal.");
    }
} finally {
    await browser.close();
}