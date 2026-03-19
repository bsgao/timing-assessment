import express from "express";
import { z } from "zod";
import type { Contact } from "../types";
import type { ContactsStore } from "../store/contactsStore";
import { parseYMDDateStrict } from "../validation/date";

function jsonError(res: express.Response, status: number, message: string) {
  res.status(status).json({ error: message });
}

const ContactCreateSchema = z.object({
  name: z.string().min(1, "name is required"),
  email: z.string().email("email must be valid"),
  company: z.string().min(1, "company is required"),
  lastContactedDate: z
    .string()
    .min(1, "lastContactedDate is required")
    .refine((s) => parseYMDDateStrict(s) !== null, "lastContactedDate must be a valid calendar date"),
  notes: z.string().optional().default(""),
});

type ContactCreateInput = z.infer<typeof ContactCreateSchema>;

export function contactsRoutes(store: ContactsStore) {
  const router = express.Router();

  router.get("/contacts", async (_req, res) => {
    try {
      const contacts = await store.getAll();
      res.json(contacts);
    } catch (err: any) {
      jsonError(res, 500, err?.message ?? "Failed to load contacts");
    }
  });

  router.post("/contacts", async (req, res) => {
    const parsed = ContactCreateSchema.safeParse(req.body);
    if (!parsed.success) return jsonError(res, 400, parsed.error.issues[0]?.message ?? "Invalid request body");

    const input: ContactCreateInput = parsed.data;
    const existing = await store.findByEmail(input.email);
    if (existing) return jsonError(res, 409, `Contact with email ${input.email} already exists`);

    const contact: Contact = {
      name: input.name,
      email: input.email,
      company: input.company,
      lastContactedDate: input.lastContactedDate,
      notes: input.notes ?? "",
    };

    await store.createOrUpdate(contact);
    res.status(201).json(contact);
  });

  router.put("/contacts/:email", async (req, res) => {
    const parsed = ContactCreateSchema.safeParse(req.body);
    if (!parsed.success) return jsonError(res, 400, parsed.error.issues[0]?.message ?? "Invalid request body");

    const emailParam = req.params.email;
    const input: ContactCreateInput = parsed.data;

    if (input.email.toLowerCase() !== emailParam.toLowerCase()) {
      return jsonError(res, 400, "Email in body must match email in URL");
    }

    const existing = await store.findByEmail(emailParam);
    if (!existing) return jsonError(res, 404, `No contact found for ${emailParam}`);

    const contact: Contact = {
      name: input.name,
      email: input.email,
      company: input.company,
      lastContactedDate: input.lastContactedDate,
      notes: input.notes ?? "",
    };

    await store.createOrUpdate(contact);
    res.json(contact);
  });

  router.delete("/contacts/:email", async (req, res) => {
    const emailParam = req.params.email;
    const ok = await store.delete(emailParam);
    if (!ok) return jsonError(res, 404, `No contact found for ${emailParam}`);
    res.status(204).send();
  });

  return router;
}

