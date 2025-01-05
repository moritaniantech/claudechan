import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { Env } from "./types";
import { createSlackEventHandler } from "./routes/slack";
import { initializeRequestContext } from "./utils/context";
import { updateLoggerContext } from "./utils/logger";

const app = new Hono<{ Bindings: Env }>();

// リクエストIDの生成ミドルウェア
app.use("*", requestId());

// リクエストコンテキストの初期化ミドルウェア
app.use("*", async (c, next) => {
  initializeRequestContext(c);
  updateLoggerContext(c);
  await next();
});

// Slackルートをマウント
app.post("/slack", (c) => createSlackEventHandler(c.env)(c));

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
