import type { Member } from "./data.js";

export function memberSearchPage(): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Member Search - Northstar Core</title>
</head>
<body>
  <header>
    <strong>Northstar Core Banking</strong>
    <span>Training environment</span>
  </header>

  <main>
    <h1>Member Search</h1>

    <form action="/members/search" method="post">
      <label for="member-id">Member ID</label>
      <input
        id="member-id"
        name="memberId"
        type="text"
        inputmode="numeric"
        pattern="[0-9]{5}"
        maxlength="5"
        autocomplete="off"
        required
      >
      <button type="submit">Search</button>
    </form>

    <p>Synthetic records only. Never enter real member information.</p>
  </main>
</body>
</html>`;
}

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

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(amount);
}

export function memberDetailsPage(member: Member): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Member Details - Northstar Core</title>
</head>
<body>
  <header>
    <strong>Northstar Core Banking</strong>
    <span>Training environment</span>
  </header>

  <main>
    <h1>Member Details</h1>

    <dl>
      <dt>Member ID</dt>
      <dd>•••${escapeHtml(member.id.slice(-4))}</dd>

      <dt>Member name</dt>
      <dd>${escapeHtml(member.name)}</dd>

      <dt>Current savings balance</dt>
      <dd>
        <output aria-label="Current savings balance">
          ${formatCurrency(member.savingsBalance)}
        </output>
      </dd>
    </dl>

    <a href="/members/${encodeURIComponent(member.id)}/subaccounts/new">
      Open new sub-account
    </a>
  </main>
</body>
</html>`;
}