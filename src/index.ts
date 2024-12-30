import { Hono } from "hono";
import { Env } from "./types";
import slack from "./routes/slack";

const app = new Hono<{ Bindings: Env }>();

// Slackルートをマウント
app.route("/slack", slack);

// 404ハンドラー
app.notFound((c) => {
  console.log("404 Not Found:", c.req.url);
  return c.json({ ok: false, error: "Not Found" }, { status: 404 });
});

// エラーハンドラー
app.onError((err, c) => {
  console.error("Application error:", err);
  return c.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
});

export default app;
