import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentDecision } from "../agent/decide.js";

type DiscoveryEvidenceOptions = {
    goal: string;
    decisions: AgentDecision[];
    capabilityId: string;
    artifactPath: string;
    filePath: string;
};

function collectSensitiveValues(
    decisions: AgentDecision[],
): string[] {
    const values: string[] = [];

    for (const decision of decisions) {
        if (decision.value) {
            values.push(decision.value);
        }

        for (const output of decision.outputs) {
            if (output.value) {
                values.push(output.value);
            }
        }
    }

    return values;
}

function redactText(
    value: string,
    sensitiveValues: string[],
): string {
    let redacted = value;

    for (const sensitiveValue of sensitiveValues) {
        redacted = redacted
            .split(sensitiveValue)
            .join("[REDACTED]");
    }

    return redacted
        .replace(/\b\d{5}\b/g, "[REDACTED]")
        .replace(
            /\$\d[\d,]*(?:\.\d{2})?/g,
            "[REDACTED]",
        );
}

export async function recordDiscoveryEvidence(
    options: DiscoveryEvidenceOptions,
): Promise<void> {
    const sensitiveValues = collectSensitiveValues(
        options.decisions,
    );

    const steps = options.decisions.map(
        (decision, index) => ({
            stepNumber: index + 1,
            action: decision.type,

            reason: redactText(
                decision.reason,
                sensitiveValues,
            ),

            target: decision.target
                ? {
                    role: decision.target.role,
                    name: decision.target.name,
                }
                : null,

            value:
                decision.type === "fill"
                    ? "[REDACTED]"
                    : null,

            outputs: decision.outputs.map((output) => ({
                name: output.name,
                value: "[REDACTED]",
            })),
        }),
    );

    const evidence = {
        recordedAt: new Date().toISOString(),
        runType: "llm-discovery",
        modelUsed: true,
        capabilityId: options.capabilityId,

        goal: redactText(
            options.goal,
            sensitiveValues,
        ),

        result: "success",
        artifactPath: options.artifactPath,
        steps,
    };

    await mkdir(dirname(options.filePath), {
        recursive: true,
    });

    await writeFile(
        options.filePath,
        `${JSON.stringify(evidence, null, 2)}\n`,
        "utf8",
    );
}