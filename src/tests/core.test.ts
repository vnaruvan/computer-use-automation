import assert from "node:assert/strict";
import {
    mkdtemp,
    rm,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { Page } from "playwright";
import type { AgentDecision } from "../agent/decide.js";
import { buildMemberBalanceArtifact } from "../artifact/build.js";
import { loadArtifact } from "../artifact/load.js";
import { HandoffSession } from "../handoff/session.js";
import { replayCapability } from "../replay/engine.js";

function createTestArtifact() {
    const actions: AgentDecision[] = [
        {
            type: "fill",
            target: {
                role: "textbox",
                name: "Member ID",
            },
            value: "12345",
            outputs: [],
            reason: "Enter the member ID.",
        },
        {
            type: "click",
            target: {
                role: "button",
                name: "Search",
            },
            value: "",
            outputs: [],
            reason: "Submit the search.",
        },
    ];

    return buildMemberBalanceArtifact(actions);
}

test(
    "artifact replaces the discovered member ID with an input parameter",
    () => {
        const artifact = createTestArtifact();
        const serializedArtifact =
            JSON.stringify(artifact);

        assert.doesNotMatch(
            serializedArtifact,
            /12345/,
        );

        const firstStep = artifact.steps[0];

        assert.ok(firstStep);
        assert.equal(firstStep.action, "fill");

        if (firstStep.action === "fill") {
            assert.deepEqual(firstStep.value, {
                source: "input",
                inputName: "memberId",
            });
        }
    },
);

test(
    "artifact loader rejects an unsupported schema",
    async () => {
        const temporaryDirectory = await mkdtemp(
            join(
                tmpdir(),
                "northstar-artifact-test-",
            ),
        );

        const invalidArtifactPath = join(
            temporaryDirectory,
            "invalid-artifact.json",
        );

        try {
            await writeFile(
                invalidArtifactPath,
                JSON.stringify({
                    schemaVersion: "2.0",
                }),
                "utf8",
            );

            await assert.rejects(
                loadArtifact(invalidArtifactPath),
                /Artifact validation failed/,
            );
        } finally {
            await rm(temporaryDirectory, {
                recursive: true,
                force: true,
            });
        }
    },
);

test(
    "replay rejects invalid input before using the browser",
    async () => {
        const artifact = createTestArtifact();

        const result = await replayCapability({
            artifact,
            inputs: {
                memberId: "abc",
            },
            baseUrl:
                "http://127.0.0.1:4173",
            page: {} as Page,
        });

        assert.equal(result.status, "failure");

        if (result.status === "failure") {
            assert.equal(
                result.code,
                "INVALID_INPUT",
            );

            assert.equal(result.stepId, null);
        }
    },
);

test(
    "handoff transfers control to a human and back",
    async () => {
        const session = new HandoffSession();

        const waitForResume = session.pause({
            capabilityId:
                "member.lookup-savings-balance",
            goal: "Test the handoff.",
            currentStep:
                "Open the confirmation screen.",
            pageUrl:
                "http://127.0.0.1:4173/members/search",
            reason:
                "Human approval is required.",
            screenshotPath:
                "evidence/test-handoff.png",
        });

        const pausedSnapshot =
            session.getSnapshot();

        assert.equal(
            pausedSnapshot.request?.status,
            "pending",
        );

        assert.equal(
            pausedSnapshot.request?.controlOwner,
            "human",
        );

        session.recordHumanAction(
            "test-operator",
            "Reviewed the confirmation.",
        );

        session.resume("test-operator");

        await waitForResume;

        const resumedSnapshot =
            session.getSnapshot();

        assert.equal(
            resumedSnapshot.request?.status,
            "resumed",
        );

        assert.equal(
            resumedSnapshot.request?.controlOwner,
            "automation",
        );

        assert.deepEqual(
            resumedSnapshot.events.map(
                (event) => event.type,
            ),
            [
                "automation_paused",
                "human_action",
                "automation_resumed",
            ],
        );
    },
);