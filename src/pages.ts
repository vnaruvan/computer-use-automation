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