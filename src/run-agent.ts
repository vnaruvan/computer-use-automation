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
import { recordDiscoveryEvidence } from "./evidence/discovery.js";

loadEnvFile();

const defaultGoal =
    "Look up member 12345 and read their current savings balance.";

const suppliedGoal = process.argv
    .slice(2)
    .join(" ")
    .trim();

const goal = suppliedGoal || defaultGoal;

const targetUrl =
    process.env.TARGET_URL ??
    "http://127.0.0.1:4173";

const allowedOrigin = new URL(targetUrl).origin;
const maximumSteps = 6;

const previousActions: AgentDecision[] = [];
const discoveryDecisions: AgentDecision[] = [];

const browser = await chromium.launch({
    headless: true,
});

const page = await browser.newPage();

let completed = false;

try {
    await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
    });

    for (
        let step = 1;
        step <= maximumSteps;
        step += 1
    ) {
        const observation = await observePage(page);

        const decision = await decideNextAction(
            goal,
            observation,
            previousActions,
        );

        discoveryDecisions.push(decision);

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
            console.log(
                JSON.stringify(
                    decision.outputs,
                    null,
                    2,
                ),
            );

            const artifact =
                buildMemberBalanceArtifact(
                    previousActions,
                );

            const artifactPath =
                "artifacts/member-balance.v1.json";

            const evidenceArtifactPath =
                "evidence/member-balance.v1.json";

            await saveArtifact(
                artifact,
                artifactPath,
            );

            await saveArtifact(
                artifact,
                evidenceArtifactPath,
            );

            await recordDiscoveryEvidence({
                goal,
                decisions: discoveryDecisions,
                capabilityId: artifact.id,
                artifactPath: evidenceArtifactPath,
                filePath:
                    "evidence/discovery.json",
            });

            console.log(
                `Artifact saved to ${artifactPath}`,
            );

            console.log(
                `Evidence artifact saved to ${evidenceArtifactPath}`,
            );

            console.log(
                "Discovery evidence saved to evidence/discovery.json",
            );

            completed = true;
            break;
        }

        if (decision.type === "escalate") {
            console.log(
                "Human intervention required.",
            );
            break;
        }

        await executeDecision(page, decision, allowedOrigin);
        previousActions.push(decision);
    }

    if (!completed) {
        console.log(
            "The agent stopped without completing the goal.",
        );
    }
} finally {
    await browser.close();
}