import express from "express";
import type { ContactsStore } from "../store/contactsStore";
import { buildRecommendations } from "../recommendations";

export function recommendationsRoutes(store: ContactsStore) {
  const router = express.Router();

  router.get("/recommendations", async (_req, res) => {
    try {
      const contacts = await store.getAll();
      const recommendations = buildRecommendations(contacts);
      res.json(recommendations);
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "Failed to build recommendations" });
    }
  });

  return router;
}

