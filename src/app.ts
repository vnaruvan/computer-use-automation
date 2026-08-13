import express from "express";
import { memberSearchPage } from "./pages.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");

  app.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });

  app.get("/", (_request, response) => {
    response.status(200).type("html").send(memberSearchPage());
  });

  return app;
}