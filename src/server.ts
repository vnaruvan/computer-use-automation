import { createApp } from "./app.js";

const app = createApp();
const port = 4173;

app.listen(port, "127.0.0.1", () => {
  console.log(`Application running at http://127.0.0.1:${port}`);
});