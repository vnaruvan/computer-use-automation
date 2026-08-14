export type ControlOwner = "automation" | "human";

export type HandoffEvent = {
    recordedAt: string;
    type:
    | "automation_paused"
    | "human_action"
    | "automation_resumed";
    actor: string;
    description: string;
};

export type InterventionRequest = {
    id: string;
    capabilityId: string;
    goal: string;
    currentStep: string;
    pageUrl: string;
    reason: string;
    screenshotPath: string;
    status: "pending" | "resumed";
    controlOwner: ControlOwner;
    requestedAt: string;
};

export type HandoffSnapshot = {
    request: InterventionRequest | null;
    events: HandoffEvent[];
};

export class HandoffSession {
    private request: InterventionRequest | null = null;

    private events: HandoffEvent[] = [];

    private resumeAutomation: (() => void) | null = null;

    pause(details: {
        capabilityId: string;
        goal: string;
        currentStep: string;
        pageUrl: string;
        reason: string;
        screenshotPath: string;
    }): Promise<void> {
        if (this.request?.status === "pending") {
            throw new Error(
                "An intervention request is already pending",
            );
        }

        const requestedAt = new Date().toISOString();

        this.request = {
            id: `intervention-${Date.now()}`,
            capabilityId: details.capabilityId,
            goal: details.goal,
            currentStep: details.currentStep,
            pageUrl: details.pageUrl,
            reason: details.reason,
            screenshotPath: details.screenshotPath,
            status: "pending",
            controlOwner: "human",
            requestedAt,
        };

        this.events.push({
            recordedAt: requestedAt,
            type: "automation_paused",
            actor: "automation",
            description:
                "Automation paused and transferred control to a human.",
        });

        return new Promise<void>((resolve) => {
            this.resumeAutomation = resolve;
        });
    }

    assertHumanControl(): void {
        if (
            !this.request ||
            this.request.status !== "pending" ||
            this.request.controlOwner !== "human"
        ) {
            throw new Error(
                "A human does not currently control this session",
            );
        }
    }

    recordHumanAction(
        operatorId: string,
        description: string,
    ): void {
        this.assertHumanControl();

        this.events.push({
            recordedAt: new Date().toISOString(),
            type: "human_action",
            actor: operatorId,
            description,
        });
    }

    resume(operatorId: string): void {
        this.assertHumanControl();

        if (!this.request) {
            throw new Error(
                "No intervention request is available",
            );
        }

        this.request.status = "resumed";
        this.request.controlOwner = "automation";

        this.events.push({
            recordedAt: new Date().toISOString(),
            type: "automation_resumed",
            actor: operatorId,
            description:
                "The human returned control to automation.",
        });

        const resume = this.resumeAutomation;
        this.resumeAutomation = null;

        if (resume) {
            resume();
        }
    }

    getSnapshot(): HandoffSnapshot {
        return {
            request: this.request
                ? { ...this.request }
                : null,
            events: [...this.events],
        };
    }
}