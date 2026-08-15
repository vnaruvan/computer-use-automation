import type { Page } from "playwright";
import type { AgentDecision } from "./decide.js";

export async function executeDecision(
    page: Page,
    decision: AgentDecision,
    allowedOrigin: string,
): Promise<void> {
    const currentOrigin = new URL(page.url()).origin;

    if (currentOrigin !== allowedOrigin) {
        throw new Error(
            `Blocked page outside allowlist: ${currentOrigin}`,
        );
    }

    if (
        decision.type === "finish" ||
        decision.type === "escalate"
    ) {
        return;
    }

    if (!decision.target) {
        throw new Error(
            `${decision.type} requires a target`,
        );
    }

    if (decision.type === "fill") {
        if (decision.target.role !== "textbox") {
            throw new Error(
                "Fill is allowed only on textboxes",
            );
        }

        if (decision.value === null) {
            throw new Error("Fill requires a value");
        }

        await page
            .getByRole("textbox", {
                name: decision.target.name,
                exact: true,
            })
            .fill(decision.value);

        return;
    }

    if (
        decision.target.role !== "button" &&
        decision.target.role !== "link"
    ) {
        throw new Error(
            "Click is allowed only on buttons and links",
        );
    }

    if (
        decision.target.name ===
        "Open new sub-account"
    ) {
        throw new Error(
            "Blocked risky action: human approval required",
        );
    }

    await page
        .getByRole(decision.target.role, {
            name: decision.target.name,
            exact: true,
        })
        .click();
}