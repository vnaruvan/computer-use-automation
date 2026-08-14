import type { ControlRole } from "../agent/types.js";

export type ArtifactInput = {
    name: string;
    dataType: "string";
    required: boolean;
    sensitive: boolean;
    validationPattern: string;
};

export type ArtifactOutput = {
    name: string;
    dataType: "string";
    sensitive: boolean;
    extraction: {
        method: "text_after_label";
        label: string;
    };
};

export type ArtifactTarget = {
    method: "role";
    role: ControlRole;
    name: string;
    exact: boolean;
};

export type StepValue =
    | {
        source: "input";
        inputName: string;
    }
    | {
        source: "literal";
        value: string;
    };

export type ArtifactStep =
    | {
        id: string;
        action: "fill";
        target: ArtifactTarget;
        value: StepValue;
        timeoutMs: number;
    }
    | {
        id: string;
        action: "click";
        target: ArtifactTarget;
        timeoutMs: number;
    };

export type KnownOutcome = {
    code: string;
    message: string;
    detection: {
        method: "text_present";
        text: string;
    };
};

export type CapabilityArtifact = {
    schemaVersion: "1.0";
    capabilityVersion: string;
    id: string;
    name: string;
    description: string;
    status: "draft" | "approved";

    application: {
        productId: string;
        supportedVersions: string[];
        entryPath: string;
        tenantScope: "shared" | "tenant-specific";
    };

    inputs: ArtifactInput[];
    outputs: ArtifactOutput[];
    steps: ArtifactStep[];

    successCheckpoint: {
        method: "text_present";
        text: string;
    };

    knownOutcomes: KnownOutcome[];

    policy: {
        risk: "read-only" | "reversible" | "irreversible";
        allowedActions: Array<"fill" | "click">;
    };
};