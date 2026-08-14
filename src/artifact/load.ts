import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { CapabilityArtifact } from "./types.js";

const ControlRoleSchema = z.enum([
    "textbox",
    "button",
    "link",
]);

const ArtifactTargetSchema = z.object({
    method: z.literal("role"),
    role: ControlRoleSchema,
    name: z.string(),
    exact: z.boolean(),
});

const StepValueSchema = z.discriminatedUnion("source", [
    z.object({
        source: z.literal("input"),
        inputName: z.string(),
    }),

    z.object({
        source: z.literal("literal"),
        value: z.string(),
    }),
]);

const ArtifactStepSchema = z.discriminatedUnion("action", [
    z.object({
        id: z.string(),
        action: z.literal("fill"),
        target: ArtifactTargetSchema,
        value: StepValueSchema,
        timeoutMs: z.number().positive(),
    }),

    z.object({
        id: z.string(),
        action: z.literal("click"),
        target: ArtifactTargetSchema,
        timeoutMs: z.number().positive(),
    }),
]);

const CapabilityArtifactSchema = z.object({
    schemaVersion: z.literal("1.0"),
    capabilityVersion: z.string(),
    id: z.string(),
    name: z.string(),
    description: z.string(),
    status: z.enum(["draft", "approved"]),

    application: z.object({
        productId: z.string(),
        supportedVersions: z.array(z.string()),
        entryPath: z.string(),
        tenantScope: z.enum([
            "shared",
            "tenant-specific",
        ]),
    }),

    inputs: z.array(
        z.object({
            name: z.string(),
            dataType: z.literal("string"),
            required: z.boolean(),
            sensitive: z.boolean(),
            validationPattern: z.string(),
        }),
    ),

    outputs: z.array(
        z.object({
            name: z.string(),
            dataType: z.literal("string"),
            sensitive: z.boolean(),

            extraction: z.object({
                method: z.literal("text_after_label"),
                label: z.string(),
            }),
        }),
    ),

    steps: z.array(ArtifactStepSchema),

    successCheckpoint: z.object({
        method: z.literal("text_present"),
        text: z.string(),
    }),

    knownOutcomes: z.array(
        z.object({
            code: z.string(),
            message: z.string(),

            detection: z.object({
                method: z.literal("text_present"),
                text: z.string(),
            }),
        }),
    ),

    policy: z.object({
        risk: z.enum([
            "read-only",
            "reversible",
            "irreversible",
        ]),

        allowedActions: z.array(
            z.enum(["fill", "click"]),
        ),
    }),
});

export async function loadArtifact(
    filePath: string,
): Promise<CapabilityArtifact> {
    const fileContents = await readFile(filePath, "utf8");

    let untrustedData: unknown;

    try {
        untrustedData = JSON.parse(fileContents);
    } catch {
        throw new Error("Artifact file is not valid JSON");
    }

    const result =
        CapabilityArtifactSchema.safeParse(untrustedData);

    if (!result.success) {
        throw new Error(
            `Artifact validation failed: ${result.error.message}`,
        );
    }

    return result.data;
}