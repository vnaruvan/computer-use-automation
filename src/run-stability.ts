import {
    mkdir,
    writeFile,
} from "node:fs/promises";
import { chromium } from "playwright";
import { loadArtifact } from "./artifact/load.js";
import { replayCapability } from "./replay/engine.js";

type StabilityRun = {
    runNumber: number;
    status:
    | "success"
    | "business_outcome"
    | "failure"
    | "runner_error";
    code: string | null;
    durationMs: number;
};

const requestedRuns = Number.parseInt(
    process.argv[2] ?? "10",
    10,
);

if (
    !Number.isInteger(requestedRuns) ||
    requestedRuns < 1 ||
    requestedRuns > 50
) {
    throw new Error(
        "Run count must be an integer from 1 through 50.",
    );
}

const artifact = await loadArtifact(
    "artifacts/member-balance.v1.json",
);

const browser = await chromium.launch({
    headless: true,
});

const runs: StabilityRun[] = [];

try {
    for (
        let runNumber = 1;
        runNumber <= requestedRuns;
        runNumber += 1
    ) {
        const page = await browser.newPage();
        const startedAt = Date.now();

        try {
            const result = await replayCapability({
                artifact,
                inputs: {
                    memberId: "12345",
                },
                baseUrl:
                    "http://127.0.0.1:4173",
                page,
            });

            const durationMs =
                Date.now() - startedAt;

            const code =
                result.status === "success"
                    ? null
                    : result.code;

            runs.push({
                runNumber,
                status: result.status,
                code,
                durationMs,
            });

            console.log(
                `Run ${runNumber}/${requestedRuns}: ` +
                `${result.status} (${durationMs} ms)`,
            );
        } catch (error) {
            const durationMs =
                Date.now() - startedAt;

            const message =
                error instanceof Error
                    ? error.message
                    : "Unknown runner error";

            runs.push({
                runNumber,
                status: "runner_error",
                code: message,
                durationMs,
            });

            console.log(
                `Run ${runNumber}/${requestedRuns}: ` +
                `runner_error (${durationMs} ms)`,
            );
        } finally {
            await page.close();
        }
    }
} finally {
    await browser.close();
}

const successCount = runs.filter(
    (run) => run.status === "success",
).length;

const successRate =
    successCount / requestedRuns;

const evidence = {
    recordedAt: new Date().toISOString(),
    runType:
        "deterministic-replay-stability",
    modelUsed: false,
    capabilityId: artifact.id,
    capabilityVersion:
        artifact.capabilityVersion,
    requestedRuns,
    successCount,
    successRate,
    inputsPersisted: false,
    outputsPersisted: false,
    runs,
};

await mkdir("evidence", {
    recursive: true,
});

await writeFile(
    "evidence/stability.json",
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
);

console.log("");
console.log(
    `Stability result: ${successCount}/${requestedRuns} successful`,
);

console.log(
    "Evidence saved to evidence/stability.json",
);

if (successCount !== requestedRuns) {
    process.exitCode = 1;
}