import type { Page } from "playwright";
import type {
    ControlRole,
    SurfaceControl,
    SurfaceObservation,
} from "./types.js";

export async function observePage(
    page: Page,
): Promise<SurfaceObservation> {
    const controls = await page
        .locator("input:not([type='hidden']), button, a[href]")
        .evaluateAll((elements): SurfaceControl[] => {
            return elements
                .filter((element) => {
                    const box = element.getBoundingClientRect();

                    return box.width > 0 && box.height > 0;
                })
                .map((element) => {
                    let role: ControlRole;

                    if (element instanceof HTMLAnchorElement) {
                        role = "link";
                    } else if (element instanceof HTMLButtonElement) {
                        role = "button";
                    } else {
                        role = "textbox";
                    }

                    let name =
                        element.getAttribute("aria-label")?.trim() ?? "";

                    if (!name && element instanceof HTMLInputElement) {
                        name = Array.from(element.labels ?? [])
                            .map((label) => label.textContent?.trim() ?? "")
                            .filter(Boolean)
                            .join(" ");
                    }

                    if (!name) {
                        name = element.textContent?.trim() ?? "";
                    }

                    return {
                        role,
                        name,
                        disabled: element.hasAttribute("disabled"),
                    };
                });
        });

    return {
        url: page.url(),
        title: await page.title(),
        visibleText: await page.locator("body").innerText(),
        controls,
    };
}