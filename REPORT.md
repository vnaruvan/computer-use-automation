# Design Report

## 1. Architecture

I separated discovery from replay because they do different jobs. During discovery, the workflow is still unknown. The runner gives the model the goal, visible page text, available controls, and earlier actions. The model returns one decision in JSON. The system checks that decision before Playwright carries it out. This continues until the goal is complete, the model asks for human help, or the run reaches its step limit. After a successful run, the actions that happened are saved as a capability artifact. Replay loads that artifact and follows the saved steps without asking the model what to do. It validates the input, opens the application, performs each action, checks the final page, and returns the requested output.

Northstar Core is a local Express application with synthetic member data. I added invalid input, a member-not-found result, a successful balance lookup, and a restricted path toward account creation. Discovery, replay, evidence, and handoff are kept in separate files. Everything runs locally, so a reviewer can test the full flow without setting up other services.

## 2. Artifact schema

The artifact is the saved recipe used by replay. It describes the capability, required input, returned output, browser steps, and success condition. The JSON also records versions, application information, tenant scope, timeouts, known outcomes, and policy rules.

The member ID entered during discovery is not copied into the artifact. The fill step points to an input named `memberId`, which must be a five-digit string. This lets replay use a different member ID each time. The balance is marked as sensitive, and its extraction rule tells replay to read the value following the `Current savings balance` label.

Controls are recorded using their accessibility role and visible name. For example, the first step looks for a `textbox` named `Member ID`. These targets are easier to read and usually more stable than long generated CSS selectors. Exact matching also helps avoid clicking another control with a similar name. This works well for the included application because its HTML is accessible. Applications without useful roles would need another way to identify controls. The artifact has a `method` field so other target types can be added later.

The artifact is saved with `draft` status. A discovered workflow should be tested and reviewed before it is approved for repeated use. The current builder creates the member-balance capability only. Another builder could create a different capability while keeping the same replay result format.

## 3. Determinism & error handling

Replay checks the artifact with Zod after loading the JSON file. A file with the wrong structure is rejected before the browser opens. Caller input is checked next. The engine also limits browser requests to the configured application address. Before each action, replay confirms that the artifact allows it and that the control type makes sense. A fill action must use a textbox. A click must use a button or link.

Replay waits for the exact recorded control before acting. After every step, it checks the page for a known business outcome. When all steps are finished, it looks for the `Member Details` checkpoint. It then reads the balance after its label. A click by itself is not treated as proof that the task worked.

The result can be a success, a known business outcome, or a failure. A member who does not exist returns `MEMBER_NOT_FOUND`. That is a valid result for the caller, so it is kept separate from a system error. Other codes cover invalid input, blocked actions, missing controls, browser errors, failed checkpoints, and output-reading problems. When possible, the failure also includes the step where it happened.

An error can be marked as recoverable, but automatic retries are not included yet. Retry behavior would need a limit and a record of each attempt. For the failure demonstration, I changed the Search button name in a temporary copy of the artifact. Replay stopped at `step-2` with `TARGET_NOT_FOUND`, while the saved artifact remained unchanged. I also ran the normal replay ten times with a new browser page for each run. All ten runs completed successfully.

## 4. Heterogeneity & multi-tenant

This project controls a web browser with Playwright. Older websites and desktop applications would need another layer between the saved artifact and the application. That layer would read the current screen, find a recorded control, perform an action, and capture a screenshot.

A modern website could continue using accessibility roles. An older website may require frame locations, visible text, table positions, or image matching. A desktop application could use accessibility information from the operating system. Coordinates would be a fallback when no useful control information is available. The target `method` in the artifact could be expanded to cover these options.

Many institutions may use the same banking product with different labels, branding, routes, or versions. I would keep one base artifact for each product and supported version. The existing `productId`, `supportedVersions`, and `tenantScope` fields are included for this reason. Changes needed by one institution could be stored separately and reviewed before use. Replay would choose the matching product version and apply those changes when needed.

Repeated missing-control or checkpoint failures would show that an artifact no longer matches an institution’s application. The system should stop using that artifact for the affected institution until someone reviews it. I did not build tenant-specific changes because this project has only one local application. Adding configuration without a second version to test would not show whether the approach works.

## 5. Escalation & handoff

`HandoffSession` records whether automation or a person currently controls the browser. When automation pauses, it creates an intervention request with the capability, goal, current step, page address, reason for stopping, and screenshot path. Control moves to the operator, and automation waits.

The operator page uses the Playwright page that automation already opened. It does not start another browser session. In the demo, automation stops before opening the sub-account confirmation page because that action moves toward account creation. The operator reviews the screenshot and performs the approved navigation. After the operator returns control, automation checks the resulting page and confirms that final account creation is still disabled.

The evidence records when automation paused, what the operator did, when automation resumed, and who performed each action. After control returns, the operator page stops showing the live screenshot. The handoff works for the risky action shown in the demo. Discovery and replay do not start it automatically yet.

## 6. Safety

Replay is limited to the configured application address. Every action must appear in the artifact’s allowed-action list. The system also checks which controls can be used for fill and click actions.

Balance lookup is treated as read-only. Automated discovery cannot open the sub-account path. That step requires human control, and the final account-creation button stays disabled in the training application.

The artifact marks the member ID and balance as sensitive. Replay evidence replaces both with `[REDACTED]`. Discovery evidence also removes the member ID, member name, and balance from saved model output. The failure screenshot covers the Member ID textbox with a black mask. Member IDs are removed from saved handoff URLs.

The local operator page uses a temporary token and does not save it. Member pages use `Cache-Control: no-store`. If this were deployed, I would replace the token with company login and short-lived access, enforce permissions for each institution, and set rules for deleting old evidence.

## 7. Cuts

The demo covers one browser workflow. The artifact builder handles member-balance lookup, and the operator page provides one approved manual action.

I did not build desktop control, institution-specific changes, stored run state, production login, or automatic retries.

My next step would be to connect risky actions and replay failures directly to `HandoffSession`. I would then test the design against another version of Northstar Core with different labels or page structure. Replay history could later help decide whether an artifact is reliable enough to run without someone watching.
