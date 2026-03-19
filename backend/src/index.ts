import express from "express";
import cors from "cors";
import { defaultContactsStore } from "./store/contactsStore";
import { contactsRoutes } from "./routes/contactsRoutes";
import { recommendationsRoutes } from "./routes/recommendationsRoutes";
import { generateMessageRoutes } from "./routes/generateMessageRoutes";

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const store = defaultContactsStore();
  await store.init();

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/", contactsRoutes(store));
  app.use("/", recommendationsRoutes(store));
  app.use("/", generateMessageRoutes(store));

  app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Contact Reminder API listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

