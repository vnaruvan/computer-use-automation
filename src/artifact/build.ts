import type { AgentDecision } from "../agent/decide.js";
import type {
    ArtifactStep,
    CapabilityArtifact,
} from "./types.js";

export function buildMemberBalanceArtifact(
    executedActions: AgentDecision[],
): CapabilityArtifact {
    const steps: ArtifactStep[] = [];

    for (const [index, action] of executedActions.entries()) {
        if (!action.target) {
            throw new Error(`Executed action ${index + 1} has no target`);
        }

        if (action.type === "fill") {
            steps.push({
                id: `step-${index + 1}`,
                action: "fill",

                target: {
                    method: "role",
                    role: action.target.role,
                    name: action.target.name,
                    exact: true,
                },

                value: {
                    source: "input",
                    inputName: "memberId",
                },

                timeoutMs: 5000,
            });

            continue;
        }

        if (action.type === "click") {
            steps.push({
                id: `step-${index + 1}`,
                action: "click",

                target: {
                    method: "role",
                    role: action.target.role,
                    name: action.target.name,
                    exact: true,
                },

                timeoutMs: 5000,
            });

            continue;
        }

        throw new Error(
            `Unexpected executed action type: ${action.type}`,
        );
    }

    return {
        schemaVersion: "1.0",
        capabilityVersion: "1.0.0",
        id: "member.lookup-savings-balance",
        name: "Look up member savings balance",
        description:
            "Search for a member and return their current savings balance.",
        status: "draft",

        application: {
            productId: "northstar-core",
            supportedVersions: ["training-v1"],
            entryPath: "/",
            tenantScope: "shared",
        },

        inputs: [
            {
                name: "memberId",
                dataType: "string",
                required: true,
                sensitive: true,
                validationPattern: "^\\d{5}$",
            },
        ],

        outputs: [
            {
                name: "current_savings_balance",
                dataType: "string",
                sensitive: true,

                extraction: {
                    method: "text_after_label",
                    label: "Current savings balance",
                },
            },
        ],

        steps,

        successCheckpoint: {
            method: "text_present",
            text: "Member Details",
        },

        knownOutcomes: [
            {
                code: "MEMBER_NOT_FOUND",
                message: "The requested member does not exist.",

                detection: {
                    method: "text_present",
                    text: "Member not found.",
                },
            },
        ],

        policy: {
            risk: "read-only",
            allowedActions: ["fill", "click"],
        },
    };
}