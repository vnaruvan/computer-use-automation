import express from "express";

const app = express();
const port = 4173;

app.get("/", (_request, response) => {
  response.send("Northstar Core training application");
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Application running at http://127.0.0.1:${port}`);
});