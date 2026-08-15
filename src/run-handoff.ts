import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import { chromium } from "playwright";
import { createOperatorApp } from "./handoff/operator-app.js";
import { HandoffSession } from "./handoff/session.js";

const targetUrl = "http://127.0.0.1:4173";
const operatorHost = "127.0.0.1";
const operatorPort = 4274;

function redactSensitiveUrl(value: string): string {
    const url = new URL(value);

    const safePath = url.pathname.replace(
        /\/members\/\d{5}(?=\/|$)/g,
        "/members/[REDACTED]",
    );

    return `${url.origin}${safePath}`;
}

async function closeServer(server: Server): Promise<void> {
    if (!server.listening) {
        return;
    }

    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

async function run(): Promise<void> {
    await mkdir("evidence", {
        recursive: true,
    });

    const browser = await chromium.launch({
        headless: true,
    });

    const page = await browser.newPage();
    const session = new HandoffSession();

    const operatorToken = randomBytes(24).toString("hex");

    let operatorServer: Server | null = null;

    try {
        await page.goto(targetUrl, {
            waitUntil: "domcontentloaded",
        });

        await page
            .getByRole("textbox", {
                name: "Member ID",
                exact: true,
            })
            .fill("12345");

        await page
            .getByRole("button", {
                name: "Search",
                exact: true,
            })
            .click();

        await page
            .getByRole("heading", {
                name: "Member Details",
                exact: true,
            })
            .waitFor();

        const pageUrlBeforeHandoff = page.url();

        const screenshotPath =
            "evidence/handoff-request.png";

        const sensitiveDetails =
            page.locator("dd");

        await page.screenshot({
            path: screenshotPath,
            fullPage: true,
            mask: [sensitiveDetails],
            maskColor: "#000000",
        });

        const waitForResume = session.pause({
            capabilityId:
                "member.open-sub-account-review",
            goal:
                "Review the member and open the sub-account confirmation screen.",
            currentStep:
                'Click "Open new sub-account"',
            pageUrl: redactSensitiveUrl(
                pageUrlBeforeHandoff,
            ),
            reason:
                "Navigation toward account creation requires human approval.",
            screenshotPath,
        });

        const operatorApp = createOperatorApp({
            session,
            page,
            operatorToken,
        });

        operatorServer = operatorApp.listen(
            operatorPort,
            operatorHost,
        );

        await once(operatorServer, "listening");

        const operatorUrl =
            `http://${operatorHost}:${operatorPort}` +
            `/?token=${encodeURIComponent(operatorToken)}`;

        console.log("");
        console.log("Automation has paused.");
        console.log("Open this operator page:");
        console.log(operatorUrl);
        console.log("");
        console.log(
            "Perform the approved navigation, then return control.",
        );

        await waitForResume;

        const confirmationButton = page.getByRole(
            "button",
            {
                name: "Confirm account creation",
                exact: true,
            },
        );

        await confirmationButton.waitFor();

        const confirmationIsDisabled =
            await confirmationButton.isDisabled();

        if (!confirmationIsDisabled) {
            throw new Error(
                "The final account-creation control must remain disabled.",
            );
        }

        const pageUrlAfterHandoff = page.url();

        if (
            !pageUrlAfterHandoff.endsWith(
                "/subaccounts/new",
            )
        ) {
            throw new Error(
                "The operator did not reach the expected confirmation page.",
            );
        }

        const evidence = {
            recordedAt: new Date().toISOString(),
            runType: "human-handoff",
            modelUsed: false,
            capabilityId:
                "member.open-sub-account-review",
            sameBrowserPageUsed: true,
            pageUrlBeforeHandoff: redactSensitiveUrl(
                pageUrlBeforeHandoff,
            ),
            pageUrlAfterHandoff: redactSensitiveUrl(
                pageUrlAfterHandoff,
            ),
            finalAccountCreationDisabled:
                confirmationIsDisabled,
            handoff: session.getSnapshot(),
        };

        await writeFile(
            "evidence/handoff.json",
            `${JSON.stringify(evidence, null, 2)}\n`,
            "utf8",
        );

        console.log("");
        console.log("Handoff completed successfully.");
        console.log(
            "Evidence saved to evidence/handoff.json",
        );
    } finally {
        if (operatorServer) {
            await closeServer(operatorServer);
        }

        await browser.close();
    }
}

run().catch((error: unknown) => {
    const message =
        error instanceof Error
            ? error.message
            : "Unknown handoff error";

    console.error(`Handoff failed: ${message}`);
    process.exitCode = 1;
});