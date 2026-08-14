import express from "express";
import type { Request } from "express";
import type { Page } from "playwright";
import type { HandoffSession } from "./session.js";

type OperatorAppOptions = {
    session: HandoffSession;
    page: Page;
    operatorToken: string;
};

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
        const replacements: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };

        return replacements[character] ?? character;
    });
}

function isAuthorized(
    request: Request,
    operatorToken: string,
): boolean {
    const queryToken = String(request.query.token ?? "");
    const formToken = String(
        request.body?.operatorToken ?? "",
    );

    return (
        queryToken === operatorToken ||
        formToken === operatorToken
    );
}

function errorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return "Unknown operator error";
}

export function createOperatorApp(
    options: OperatorAppOptions,
) {
    const app = express();

    app.disable("x-powered-by");
    app.use(express.urlencoded({ extended: false }));

    app.use((_request, response, next) => {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader(
            "X-Content-Type-Options",
            "nosniff",
        );
        next();
    });

    app.get("/", (request, response) => {
        if (
            !isAuthorized(
                request,
                options.operatorToken,
            )
        ) {
            response
                .status(403)
                .send("Operator token is invalid.");
            return;
        }

        const snapshot = options.session.getSnapshot();
        const intervention = snapshot.request;

        if (!intervention) {
            response
                .status(404)
                .send("No intervention request exists.");
            return;
        }

        const token = encodeURIComponent(
            options.operatorToken,
        );

        const controls =
            intervention.status === "pending"
                ? `
<form action="/actions/open-sub-account" method="post">
  <input
    type="hidden"
    name="operatorToken"
    value="${escapeHtml(options.operatorToken)}"
  >
  <button type="submit">
    Perform approved navigation
  </button>
</form>

<form action="/resume" method="post">
  <input
    type="hidden"
    name="operatorToken"
    value="${escapeHtml(options.operatorToken)}"
  >
  <button type="submit">
    Return control to automation
  </button>
</form>`
                : `
<p>
  Control has been returned to automation.
</p>`;

        const browserView =
            intervention.status === "pending"
                ? `
<h2>Live browser session</h2>

<img
  src="/screenshot?token=${token}"
  alt="Current automation browser screenshot"
  style="max-width: 100%; border: 1px solid #555;"
>`
                : `
<h2>Live browser session</h2>

<p>
  The live browser view is closed because automation
  controls the session again.
</p>`;

        response.status(200).type("html").send(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >
  <title>Automation Intervention</title>
</head>
<body>
  <main>
    <h1>Automation Intervention</h1>

    <dl>
      <dt>Capability</dt>
      <dd>${escapeHtml(intervention.capabilityId)}</dd>

      <dt>Current step</dt>
      <dd>${escapeHtml(intervention.currentStep)}</dd>

      <dt>Reason</dt>
      <dd>${escapeHtml(intervention.reason)}</dd>

      <dt>Control owner</dt>
      <dd>${escapeHtml(intervention.controlOwner)}</dd>

      <dt>Status</dt>
      <dd>${escapeHtml(intervention.status)}</dd>
    </dl>

    ${browserView}

    <h2>Operator controls</h2>

    ${controls}
  </main>
</body>
</html>`);
    });

    app.get("/screenshot", async (request, response) => {
        if (
            !isAuthorized(
                request,
                options.operatorToken,
            )
        ) {
            response
                .status(403)
                .send("Operator token is invalid.");
            return;
        }

        try {
            options.session.assertHumanControl();

            const screenshot =
                await options.page.screenshot({
                    fullPage: true,
                });

            response
                .status(200)
                .type("png")
                .send(screenshot);
        } catch (error) {
            response
                .status(409)
                .send(errorMessage(error));
        }
    });

    app.post(
        "/actions/open-sub-account",
        async (request, response) => {
            if (
                !isAuthorized(
                    request,
                    options.operatorToken,
                )
            ) {
                response
                    .status(403)
                    .send("Operator token is invalid.");
                return;
            }

            try {
                options.session.assertHumanControl();

                await options.page
                    .getByRole("link", {
                        name: "Open new sub-account",
                        exact: true,
                    })
                    .click();

                options.session.recordHumanAction(
                    "operator-demo",
                    "Navigated to the sub-account confirmation screen.",
                );

                response.redirect(
                    `/?token=${encodeURIComponent(
                        options.operatorToken,
                    )}`,
                );
            } catch (error) {
                response
                    .status(409)
                    .send(errorMessage(error));
            }
        },
    );

    app.post("/resume", (request, response) => {
        if (
            !isAuthorized(
                request,
                options.operatorToken,
            )
        ) {
            response
                .status(403)
                .send("Operator token is invalid.");
            return;
        }

        try {
            options.session.resume("operator-demo");

            response.redirect(
                `/?token=${encodeURIComponent(
                    options.operatorToken,
                )}`,
            );
        } catch (error) {
            response
                .status(409)
                .send(errorMessage(error));
        }
    });

    return app;
}