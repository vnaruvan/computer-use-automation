import express from "express";
import { memberSearchPage } from "./pages.js";

export function createApp() {
    const app = express();

    app.use(express.urlencoded({ extended: false }));

    app.disable("x-powered-by");

    app.use((_request, response, next) => {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        next();
    });

    app.post("/members/search", (request, response) => {
        const memberId = String(request.body.memberId ?? "").trim();

        if (!/^\d{5}$/.test(memberId)) {
            response.status(400).send("Member ID must contain exactly five digits.");
            return;
        }

        response.status(200).send(`Received member ID: ${memberId}`);
    });

    app.get("/", (_request, response) => {
        response.status(200).type("html").send(memberSearchPage());
    });

    return app;
}