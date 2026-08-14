export type ReplaySuccess = {
    status: "success";
    capabilityId: string;
    outputs: Record<string, string>;
};

export type ReplayBusinessOutcome = {
    status: "business_outcome";
    capabilityId: string;
    code: string;
    message: string;
};

export type ReplayFailure = {
    status: "failure";
    capabilityId: string;
    failureType: "recoverable" | "hard";
    code:
    | "INVALID_INPUT"
    | "POLICY_BLOCKED"
    | "TARGET_NOT_FOUND"
    | "EXECUTION_FAILED"
    | "CHECKPOINT_FAILED"
    | "OUTPUT_EXTRACTION_FAILED";
    stepId: string | null;
    message: string;
};

export type ReplayResult =
    | ReplaySuccess
    | ReplayBusinessOutcome
    | ReplayFailure;