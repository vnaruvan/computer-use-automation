export type ControlRole = "textbox" | "button" | "link";

export type ControlTarget = {
    role: ControlRole;
    name: string;
}

export type SurfaceControl = {
    role: ControlRole;
    name: string;
    disabled: boolean;
};

export type SurfaceObservation = {
    url: string;
    title: string;
    visibleText: string;
    controls: SurfaceControl[];
};

export type AgentAction =
    | {
        type: "fill";
        target: ControlTarget;
        value: string;
    }
    | {
        type: "click";
        target: ControlTarget;
    }
    | {
        type: "finish";
        outputs: Record<string, string>;
        reason: string;
    }
    | {
        type: "escalate";
        reason: string;
    };