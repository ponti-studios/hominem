import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  ENV: string;
  API_ORIGIN: string;
  OPENAI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("api/*", async (c, next) => {
  cors({
    origin: c.env.API_ORIGIN,
    allowMethods: ["GET", "POST"],
    allowHeaders: ["Content-Type"],
    maxAge: 600,
  });
});

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

export default app;
