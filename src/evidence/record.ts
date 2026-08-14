import { mkdir, writeFile } from "node:fs/promises";
import type { CapabilityArtifact } from "../artifact/types.js";
import type { ReplayInputs } from "../replay/engine.js";
import type { ReplayResult } from "../replay/types.js";

type ReplayEvidenceOptions = {
    fileLabel?: string;
    context?: Record<string, unknown>;
};

function redactInputs(
    artifact: CapabilityArtifact,
    inputs: ReplayInputs,
): Record<string, string> {
    const safeInputs: Record<string, string> = {};

    for (const inputDefinition of artifact.inputs) {
        const value = inputs[inputDefinition.name];

        if (value === undefined) {
            safeInputs[inputDefinition.name] = "[MISSING]";
        } else if (inputDefinition.sensitive) {
            safeInputs[inputDefinition.name] = "[REDACTED]";
        } else {
            safeInputs[inputDefinition.name] = value;
        }
    }

    return safeInputs;
}

function summarizeResult(
    artifact: CapabilityArtifact,
    result: ReplayResult,
): object {
    if (result.status !== "success") {
        return result;
    }

    const safeOutputs: Record<string, string> = {};

    for (const outputDefinition of artifact.outputs) {
        const value =
            result.outputs[outputDefinition.name];

        if (value === undefined) {
            safeOutputs[outputDefinition.name] =
                "[MISSING]";
        } else if (outputDefinition.sensitive) {
            safeOutputs[outputDefinition.name] =
                "[REDACTED]";
        } else {
            safeOutputs[outputDefinition.name] = value;
        }
    }

    return {
        status: result.status,
        capabilityId: result.capabilityId,
        outputs: safeOutputs,
    };
}

export async function recordReplayEvidence(
    artifact: CapabilityArtifact,
    inputs: ReplayInputs,
    result: ReplayResult,
    options?: ReplayEvidenceOptions,
): Promise<void> {
    await mkdir("evidence", {
        recursive: true,
    });

    const defaultFileLabel =
        result.status === "business_outcome"
            ? "business-outcome"
            : result.status;

    const fileLabel =
        options?.fileLabel ?? defaultFileLabel;

    const evidence = {
        recordedAt: new Date().toISOString(),
        runType: "deterministic-replay",
        modelUsed: false,
        capabilityId: artifact.id,
        capabilityVersion:
            artifact.capabilityVersion,
        inputs: redactInputs(artifact, inputs),
        result: summarizeResult(artifact, result),

        ...(options?.context
            ? {
                context: options.context,
            }
            : {}),
    };

    const filePath =
        `evidence/replay-${fileLabel}.json`;

    await writeFile(
        filePath,
        `${JSON.stringify(evidence, null, 2)}\n`,
        "utf8",
    );
}