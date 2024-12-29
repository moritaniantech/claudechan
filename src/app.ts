import { Hono } from "hono";
import { slackEventsHandler } from "./routes/slackEvents";
import { CloudflareBindings } from "./types";

export const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => c.text("Hello Hono!"));
app.post("/slack/events", slackEventsHandler);
