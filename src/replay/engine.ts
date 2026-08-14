import type { Page } from "playwright";
import type {
    ArtifactStep,
    CapabilityArtifact,
} from "../artifact/types.js";
import type {
    ReplayBusinessOutcome,
    ReplayFailure,
    ReplayResult,
} from "./types.js";

export type ReplayInputs = Record<string, string>;

export type ReplayRequest = {
    artifact: CapabilityArtifact;
    inputs: ReplayInputs;
    baseUrl: string;
    page: Page;
};

function createFailure(
    artifact: CapabilityArtifact,
    code: ReplayFailure["code"],
    stepId: string | null,
    message: string,
    failureType: ReplayFailure["failureType"] = "hard",
): ReplayFailure {
    return {
        status: "failure",
        capabilityId: artifact.id,
        failureType,
        code,
        stepId,
        message,
    };
}

function validateInputs(
    artifact: CapabilityArtifact,
    inputs: ReplayInputs,
): ReplayFailure | null {
    for (const inputDefinition of artifact.inputs) {
        const suppliedValue = inputs[inputDefinition.name];

        if (
            inputDefinition.required &&
            (suppliedValue === undefined || suppliedValue === "")
        ) {
            return createFailure(
                artifact,
                "INVALID_INPUT",
                null,
                `Required input is missing: ${inputDefinition.name}`,
            );
        }

        if (suppliedValue !== undefined) {
            const pattern = new RegExp(
                inputDefinition.validationPattern,
            );

            if (!pattern.test(suppliedValue)) {
                return createFailure(
                    artifact,
                    "INVALID_INPUT",
                    null,
                    `Input failed validation: ${inputDefinition.name}`,
                );
            }
        }
    }

    return null;
}

function resolveStepValue(
    step: Extract<ArtifactStep, { action: "fill" }>,
    inputs: ReplayInputs,
): string | undefined {
    if (step.value.source === "literal") {
        return step.value.value;
    }

    return inputs[step.value.inputName];
}

function detectKnownOutcome(
    artifact: CapabilityArtifact,
    visibleText: string,
): ReplayBusinessOutcome | null {
    for (const outcome of artifact.knownOutcomes) {
        if (visibleText.includes(outcome.detection.text)) {
            return {
                status: "business_outcome",
                capabilityId: artifact.id,
                code: outcome.code,
                message: outcome.message,
            };
        }
    }

    return null;
}

async function executeStep(
    page: Page,
    artifact: CapabilityArtifact,
    step: ArtifactStep,
    inputs: ReplayInputs,
): Promise<ReplayFailure | null> {
    if (!artifact.policy.allowedActions.includes(step.action)) {
        return createFailure(
            artifact,
            "POLICY_BLOCKED",
            step.id,
            `Action is not allowed by policy: ${step.action}`,
        );
    }

    if (
        step.action === "fill" &&
        step.target.role !== "textbox"
    ) {
        return createFailure(
            artifact,
            "POLICY_BLOCKED",
            step.id,
            "Fill is permitted only on a textbox",
        );
    }

    if (
        step.action === "click" &&
        step.target.role !== "button" &&
        step.target.role !== "link"
    ) {
        return createFailure(
            artifact,
            "POLICY_BLOCKED",
            step.id,
            "Click is permitted only on a button or link",
        );
    }

    const locator = page.getByRole(step.target.role, {
        name: step.target.name,
        exact: step.target.exact,
    });

    try {
        await locator.waitFor({
            state: "visible",
            timeout: step.timeoutMs,
        });
    } catch {
        return createFailure(
            artifact,
            "TARGET_NOT_FOUND",
            step.id,
            `Could not find ${step.target.role}: ${step.target.name}`,
        );
    }

    try {
        if (step.action === "fill") {
            const value = resolveStepValue(step, inputs);

            if (value === undefined) {
                return createFailure(
                    artifact,
                    "INVALID_INPUT",
                    step.id,
                    `No value was supplied for ${step.value.source}`,
                );
            }

            await locator.fill(value, {
                timeout: step.timeoutMs,
            });
        } else {
            await locator.click({
                timeout: step.timeoutMs,
            });
        }
    } catch {
        return createFailure(
            artifact,
            "EXECUTION_FAILED",
            step.id,
            `Could not execute step: ${step.id}`,
            "recoverable",
        );
    }

    return null;
}

function extractOutputs(
    artifact: CapabilityArtifact,
    visibleText: string,
): ReplayResult {
    const lines = visibleText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const outputs: Record<string, string> = {};

    for (const outputDefinition of artifact.outputs) {
        const labelIndex = lines.indexOf(
            outputDefinition.extraction.label,
        );

        const extractedValue = lines[labelIndex + 1];

        if (labelIndex === -1 || !extractedValue) {
            return createFailure(
                artifact,
                "OUTPUT_EXTRACTION_FAILED",
                null,
                `Could not extract output: ${outputDefinition.name}`,
            );
        }

        outputs[outputDefinition.name] = extractedValue;
    }

    return {
        status: "success",
        capabilityId: artifact.id,
        outputs,
    };
}

export async function replayCapability(
    request: ReplayRequest,
): Promise<ReplayResult> {
    const { artifact, inputs, baseUrl, page } = request;

    const inputFailure = validateInputs(artifact, inputs);

    if (inputFailure) {
        return inputFailure;
    }

    let allowedOrigin: string;
    let startUrl: URL;

    try {
        allowedOrigin = new URL(baseUrl).origin;
        startUrl = new URL(
            artifact.application.entryPath,
            baseUrl,
        );
    } catch {
        return createFailure(
            artifact,
            "POLICY_BLOCKED",
            null,
            "The configured application URL is invalid",
        );
    }

    if (startUrl.origin !== allowedOrigin) {
        return createFailure(
            artifact,
            "POLICY_BLOCKED",
            null,
            "The artifact entry path leaves the allowed application",
        );
    }

    await page.route("**/*", async (route) => {
        const requestedUrl = new URL(route.request().url());

        if (
            (requestedUrl.protocol === "http:" ||
                requestedUrl.protocol === "https:") &&
            requestedUrl.origin !== allowedOrigin
        ) {
            await route.abort("blockedbyclient");
            return;
        }

        await route.continue();
    });

    try {
        await page.goto(startUrl.toString(), {
            waitUntil: "domcontentloaded",
            timeout: 10_000,
        });
    } catch {
        return createFailure(
            artifact,
            "EXECUTION_FAILED",
            null,
            "Could not open the application",
            "recoverable",
        );
    }

    for (const step of artifact.steps) {
        const stepFailure = await executeStep(
            page,
            artifact,
            step,
            inputs,
        );

        if (stepFailure) {
            return stepFailure;
        }

        const visibleText =
            await page.locator("body").innerText();

        const knownOutcome = detectKnownOutcome(
            artifact,
            visibleText,
        );

        if (knownOutcome) {
            return knownOutcome;
        }
    }

    const finalText = await page.locator("body").innerText();

    if (
        !finalText.includes(
            artifact.successCheckpoint.text,
        )
    ) {
        return createFailure(
            artifact,
            "CHECKPOINT_FAILED",
            null,
            `Success text was not found: ${artifact.successCheckpoint.text}`,
        );
    }

    return extractOutputs(artifact, finalText);
}