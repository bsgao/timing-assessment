import express from "express";
import { z } from "zod";
import type { ContactsStore } from "../store/contactsStore";
import { generateMessage } from "../messageGenerator";

function jsonError(res: express.Response, status: number, message: string) {
  res.status(status).json({ error: message });
}

const GenerateMessageSchema = z.object({
  contactName: z.string().min(1, "contactName is required"),
  relationshipContext: z.string().min(1, "relationshipContext is required"),
  lastConversation: z.string().min(1, "lastConversation is required"),
});

export function generateMessageRoutes(store: ContactsStore) {
  const router = express.Router();

  router.post("/generate-message", (req, res) => {
    const parsed = GenerateMessageSchema.safeParse(req.body);
    if (!parsed.success) return jsonError(res, 400, parsed.error.issues[0]?.message ?? "Invalid request body");

    const { contactName, relationshipContext, lastConversation } = parsed.data;
    store
      .findByName(contactName)
      .then((contact) => {
        if (!contact) return jsonError(res, 404, `No contact found with name ${contactName}`);
        const out = generateMessage({ contact, relationshipContext, lastConversation });
        res.json(out);
      })
      .catch((err) => jsonError(res, 500, err?.message ?? "Failed to generate message"));
  });

  return router;
}

