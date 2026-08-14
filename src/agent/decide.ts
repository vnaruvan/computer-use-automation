import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { SurfaceObservation } from "./types.js";

const DecisionSchema = z.object({
    type: z.enum(["fill", "click", "finish", "escalate"]),

    target: z
        .object({
            role: z.enum(["textbox", "button", "link"]),
            name: z.string(),
        })
        .nullable(),

    value: z.string().nullable(),

    outputs: z.array(
        z.object({
            name: z.string(),
            value: z.string(),
        }),
    ),

    reason: z.string(),
});

export type AgentDecision = z.infer<typeof DecisionSchema>;

export async function decideNextAction(
    goal: string,
    observation: SurfaceObservation,
    previousActions: AgentDecision[],
): Promise<AgentDecision> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";

    if (!apiKey) {
        throw new Error("OPENAI_API_KEY is missing");
    }

    const client = new OpenAI({
        apiKey,
    });

    const response = await client.responses.parse({
        model,

        input: [
            {
                role: "system",
                content: [
                    "You control a browser through a limited set of actions.",
                    "Choose exactly one next action.",
                    "Use only controls present in the observation.",
                    "Do not invent controls.",
                    "Use finish only when the requested answer is visible.",
                    "Use escalate when you cannot proceed safely.",
                    "For fill or click, provide a target.",
                    "For fill, provide a value.",
                    "For unused fields, use null or an empty array.",
                    "Use previous actions to avoid repeating completed work.",
                ].join(" "),
            },
            {
                role: "user",
                content: JSON.stringify({
                    goal,
                    observation,
                    previousActions,
                }),
            },
        ],

        text: {
            format: zodTextFormat(DecisionSchema, "agent_decision"),
        },
    });

    const decision = response.output_parsed;

    if (!decision) {
        throw new Error("The model did not return a decision");
    }

    return decision;
}