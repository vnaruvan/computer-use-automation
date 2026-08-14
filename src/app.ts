import express from "express";
import {
    memberDetailsPage,
    memberSearchPage,
    subAccountConfirmationPage,
} from "./pages.js";
import { findMember } from "./data.js";



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

        const member = findMember(memberId);

        if (!member) {
            response.status(404).send("Member not found.");
            return;
        }

        response.status(200).type("html").send(memberDetailsPage(member));
    });

    app.get(
        "/members/:memberId/subaccounts/new",
        (request, response) => {
            const memberId = String(
                request.params.memberId ?? "",
            ).trim();

            if (!/^\d{5}$/.test(memberId)) {
                response
                    .status(400)
                    .send(
                        "Member ID must contain exactly five digits.",
                    );
                return;
            }

            const member = findMember(memberId);

            if (!member) {
                response.status(404).send("Member not found.");
                return;
            }

            response
                .status(200)
                .type("html")
                .send(subAccountConfirmationPage(member));
        },
    );



    app.get("/", (_request, response) => {
        response.status(200).type("html").send(memberSearchPage());
    });

    return app;
}