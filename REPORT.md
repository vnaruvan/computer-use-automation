# Design Report

## 1. Architecture

I separated discovery from replay because they do different jobs. During discovery, the workflow is still unknown. The runner gives the model the goal, visible page text, available controls, and earlier actions. The model returns one decision in JSON. The system checks that decision before Playwright carries it out. This continues until the goal is complete, the model asks for human help, or the run reaches its step limit. After a successful run, the actions that actually happened are saved as a capability artifact. Replay loads that artifact and follows the saved steps without asking the model what to do. It validates the input, opens the application, performs each action, checks the final page, and returns the requested output.

Northstar Core is a local Express application created for this project. It uses synthetic member data and includes the page states needed to test the workflow. These include invalid input, a member who does not exist, a successful balance lookup, and a restricted path toward account creation. I kept discovery, replay, evidence, and handoff in separate files so each part has one clear purpose. The project runs locally because adding deployed services would make it harder to review without improving the main workflow.

## 2. Artifact schema

The artifact is the saved recipe that connects discovery to replay. It explains what the capability does, what input it needs, what output it returns, which actions to perform, and how to confirm that the task succeeded. It also includes a schema version, capability version, application name, supported application versions, tenant scope, timeouts, known outcomes, risk level, and allowed actions.

The member ID entered during discovery is not copied into the artifact. The fill step points to an input named `memberId`, which must be a five-digit string. This allows replay to use a different member ID each time. The balance is marked as sensitive, and its extraction rule tells replay to read the value following the `Current savings balance` label.

Controls are recorded using their accessibility role and visible name. For example, the first step looks for a `textbox` named `Member ID`. These targets are easier to read and usually more stable than long generated CSS selectors. Exact matching also helps avoid clicking a different control with a similar name. This approach works well for the included application because its HTML is accessible. Applications without useful roles would need another way to identify controls. The artifact has a `method` field so more target types can be added later.

The artifact is saved with `draft` status. A discovered workflow should be tested and reviewed before it is approved for repeated use. The current builder creates the member-balance capability only. A new builder could create another kind of capability while keeping the same replay result format.

## 3. Determinism & error handling

Replay checks the artifact with Zod after loading the JSON file. A file with the wrong structure is rejected before the browser opens. Caller input is checked next. The engine also limits browser requests to the configured application address. Before each action, replay confirms that the artifact allows it and that the control type makes sense. A fill action must use a textbox. A click must use a button or link.

Replay waits for the exact recorded control before acting. After every step, it checks the page for a known business outcome. When all steps are finished, it looks for the `Member Details` checkpoint. It then reads the balance after its label. A click alone is never treated as proof that the task worked.

The result can be a success, a known business outcome, or a failure. A member who does not exist returns `MEMBER_NOT_FOUND`. That is a valid result for the caller, so it is kept separate from a system error. Other codes cover invalid input, blocked actions, missing controls, browser errors, failed checkpoints, and output-reading problems. When possible, the failure also includes the step where it happened.

The result type can mark an error as recoverable, but automatic retries are not included yet. Retry behavior would need limits and a record of every attempt. For the failure demonstration, I changed the Search button name in a temporary copy of the artifact. Replay stopped at `step-2` with `TARGET_NOT_FOUND`. The saved artifact was not changed. I also ran the normal replay ten times with a new browser page for each run. All ten completed successfully.

## 4. Heterogeneity & multi-tenant

This project controls a web browser with Playwright. Support for older websites or desktop applications would require a separate layer between the saved artifact and the application being controlled. That layer would read the current screen, find a recorded control, perform an action, and capture a screenshot.

A modern website could continue using accessibility roles. An older website may require frame locations, visible text, table positions, or image matching. A desktop application could use the accessibility information provided by the operating system. Coordinates would be a fallback when no useful control information is available. The artifact’s target `method` could be expanded to describe these options.

Many institutions may use the same banking product with different labels, branding, routes, or versions. I would keep one base artifact for each product and supported version. The existing `productId`, `supportedVersions`, and `tenantScope` fields are included for this reason. Differences for one institution could be stored as reviewed changes to the base artifact. Before replay, the system would choose the matching product version and apply those changes if needed.

Repeated missing-control or checkpoint failures would show that an artifact no longer matches a particular institution’s application. The system should stop using that combination until someone reviews it. I did not build tenant-specific changes because there is only one local application in this project. Adding configuration files without a second real version to test against would not prove that the design works.

## 5. Escalation & handoff

`HandoffSession` records whether automation or a person currently controls the browser. When automation pauses, it creates an intervention request with the capability, goal, current step, page address, reason for stopping, and screenshot path. Control changes to the human operator, and automation waits.

The operator page uses the same Playwright page that automation was already using. It does not start a new browser session. In the demonstration, automation stops before opening the sub-account confirmation page because that action moves toward account creation. The operator reviews the screenshot and performs the approved navigation. After the operator returns control, automation checks the resulting page and confirms that final account creation is still disabled.

The evidence records when automation paused, what the operator did, and when automation resumed. It also records who performed each action. After control returns, the operator page stops showing the live screenshot. Handoff currently has its own demonstration command. A larger version would start the same handoff process when discovery asks for help or replay reaches a condition that requires a person.

## 6. Safety

Replay is limited to the configured application address. Every action must appear in the artifact’s allowed-action list. The system also checks which controls can be used for fill and click actions.

Balance lookup is treated as read-only. Automated discovery cannot open the sub-account path. That step requires human control, and the final account-creation button stays disabled in the training application.

The artifact marks the member ID and balance as sensitive. Replay evidence replaces both with `[REDACTED]`. Discovery evidence also removes the member ID, member name, and balance from saved model output. The failure screenshot covers the Member ID textbox with a black mask. Member IDs are removed from saved handoff URLs.

The API key remains in `.env`, which Git ignores. The operator token is created for one local run and is not saved in evidence. Pages containing member information use `Cache-Control: no-store`. A deployed operator page would need company login, encrypted connections, short-lived access, permissions based on the institution, and shared rules for deleting old evidence.

## 7. Cuts

I limited the implementation to one complete browser workflow. The artifact builder handles member-balance lookup, and the operator page provides one approved manual action. Handoff runs through a separate command instead of starting automatically from replay.

Desktop control, institution-specific artifact changes, a database for run state, production operator login, and automatic retries are not included. The report explains how those parts would connect, but the repository does not present them as completed work.

My first next step would connect risky actions and replay failures directly to `HandoffSession`. I would then add a common interface for different application types and test it against another version of Northstar Core with changed labels or page structure. After enough replay history exists, artifact approval could depend on recent results and the detected application version.
