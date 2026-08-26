# Policy-Controlled Computer-Use Agent Harness: Computer-Use Automation System

I built this around a record-once, replay-many workflow for applications without a usable API.

An LLM handles the first run. It reads the current screen and chooses one action at a time. Once the goal is complete, the run is converted into a typed JSON artifact. Replay loads that artifact and follows the recorded steps directly.

Northstar Core is the local target application included in this repository. All member records are synthetic.

## Setup

Requirements:

- Node.js 24
- npm
- An OpenAI API key for discovery

Clone the repository and run setup:

```bash
git clone https://github.com/vnaruvan/computer-use-automation.git
cd computer-use-automation
npm run setup
```

The setup command installs the locked dependencies, installs Chromium through Playwright, compiles the project, and runs the tests.

To run discovery, create the environment file:

```bash
cp .env.example .env
```

Set the following values:

```dotenv
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-5-mini
TARGET_URL=http://127.0.0.1:4173
```

Replay and the other model-free commands do not require an API key. The `.env` file is ignored by Git.

## Run the target application

Start Northstar Core in one terminal:

```bash
npm run dev
```

It listens on `http://127.0.0.1:4173`. Leave it running for the remaining commands.

## Discover the workflow

Run:

```bash
npm run agent -- "Look up member 12345 and read their current savings balance."
```

The agent observes the page, requests one structured decision from the model, checks that decision against the policy, and executes it with Playwright. For the included goal, the model should fill the Member ID field, select Search, and finish after reading the balance.

A successful run writes:

```text
artifacts/member-balance.v1.json
evidence/member-balance.v1.json
evidence/discovery.json
```

The example ID is replaced with an input reference in the artifact:

```json
{
  "source": "input",
  "inputName": "memberId"
}
```

The discovery log retains the model’s actions and reasons. Member data is redacted before that log is written.

## Replay the artifact

Successful replay:

```bash
npm run replay -- 12345
```

Expected result:

```json
{
  "status": "success",
  "capabilityId": "member.lookup-savings-balance",
  "outputs": {
    "current_savings_balance": "$5,432.10"
  }
}
```

No model call is made during replay.

A missing member returns a business outcome:

```bash
npm run replay -- 99999
```

Expected code:

```text
MEMBER_NOT_FOUND
```

Invalid input is rejected before the browser opens:

```bash
npm run replay -- abc
```

Expected code:

```text
INVALID_INPUT
```

## Human handoff

Run:

```bash
npm run handoff
```

The command prints a temporary operator URL. Open the full URL in a browser.

The operator page shows the Playwright session paused by automation. Select **Perform approved navigation** to open the sub-account confirmation page. Then select **Return control to automation**.

Both sides act on the same Playwright `Page` object. After control returns, automation checks the resulting URL and verifies that the final account-creation button is disabled.

Evidence is written to:

```text
evidence/handoff.json
evidence/handoff-request.png
```

The operator token stays in memory and is not included in the evidence file. Once control returns to automation, the operator can no longer view the live screenshot.

## Simulate a broken locator

Run:

```bash
npm run failure-demo
```

This copies the artifact in memory and changes the Search button name to a control that does not exist. The artifact on disk is left unchanged.

Replay should stop at `step-2` with:

```text
TARGET_NOT_FOUND
```

The failure record and screenshot are saved as:

```text
evidence/replay-target-failure.json
evidence/replay-target-failure.png
```

The Member ID field is masked in the screenshot.

## Check replay stability

Run ten replays:

```bash
npm run stability -- 10
```

Each attempt uses a fresh browser page. The runner records status and duration in:

```text
evidence/stability.json
```

It does not save the input or extracted balance.

## Commands

| Command                        | What it runs                      |
| ------------------------------ | --------------------------------- |
| `npm run dev`                  | Local Northstar Core application  |
| `npm run build`                | TypeScript compiler               |
| `npm test`                     | Core tests                        |
| `npm run browser-check`        | Browser access check              |
| `npm run model-check`          | OpenAI connection check           |
| `npm run decision-check`       | One structured model decision     |
| `npm run agent -- "<goal>"`    | LLM-guided discovery              |
| `npm run replay -- <memberId>` | Replay without the model          |
| `npm run handoff`              | Human handoff demonstration       |
| `npm run failure-demo`         | Simulated missing-control failure |
| `npm run stability -- <count>` | Repeated replay check             |

## Artifact contents

`artifacts/member-balance.v1.json` defines the capability contract. It includes:

* Schema and capability versions
* Application identity and supported versions
* Tenant scope
* Input validation
* Output extraction
* Ordered browser actions
* Role-based locators
* Step timeouts
* The success checkpoint
* Known business outcomes
* Allowed action types

The raw model transcript is not used for replay.

## Safety choices

Replay stays within the configured application origin. Each action must be allowed by the artifact policy, and fill actions are limited to textboxes.

Balance lookup is treated as read-only. Navigation toward account creation requires human control. Actual account creation is disabled in the training application.

Sensitive input and output values are removed from JSON evidence. The failure screenshot masks the Member ID field. Pages containing member information are marked `no-store`.

## Evidence included

The `evidence` directory contains the discovery log, a copy of the generated artifact, replay results, failure records, screenshots, the handoff history, and the stability result.

All application data is synthetic.

## Scope

I implemented one complete browser workflow against a local application with synthetic data. Production operator authentication, desktop control, tenant-specific configuration, and automatic retries are outside this implementation. `REPORT.md` explains where those components would connect and what I would build next.
