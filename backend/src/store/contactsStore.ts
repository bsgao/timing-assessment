import { promises as fs } from "node:fs";
import path from "node:path";
import type { Contact } from "../types";

export class ContactsStore {
  private readonly dataFilePath: string;
  private contacts: Contact[] = [];
  private writeInFlight: Promise<void> = Promise.resolve();

  constructor(dataFilePath: string) {
    this.dataFilePath = dataFilePath;
  }

  async init(): Promise<void> {
    const contacts = await this.readFromDisk();
    this.contacts = contacts;
  }

  async getAll(): Promise<Contact[]> {
    // Prototype safety: return a copy so callers don't mutate internal state.
    return this.contacts.map((c) => ({ ...c }));
  }

  upsert(contact: Contact): { action: "created" | "updated" } {
    const idx = this.contacts.findIndex((c) => c.email.toLowerCase() === contact.email.toLowerCase());
    if (idx === -1) {
      this.contacts.push({ ...contact });
      return { action: "created" };
    }
    this.contacts[idx] = { ...contact };
    return { action: "updated" };
  }

  async findByName(name: string): Promise<Contact | undefined> {
    const n = name.trim().toLowerCase();
    return this.contacts.find((c) => c.name.trim().toLowerCase() === n);
  }

  async findByEmail(email: string): Promise<Contact | undefined> {
    const e = email.trim().toLowerCase();
    return this.contacts.find((c) => c.email.trim().toLowerCase() === e);
  }

  deleteByEmail(email: string): boolean {
    const e = email.trim().toLowerCase();
    const before = this.contacts.length;
    this.contacts = this.contacts.filter((c) => c.email.trim().toLowerCase() !== e);
    return this.contacts.length !== before;
  }

  private async readFromDisk(): Promise<Contact[]> {
    try {
      const raw = await fs.readFile(this.dataFilePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Trust shape; validation happens at the API boundary.
      return parsed as Contact[];
    } catch (err: any) {
      // Missing file => empty dataset.
      if (err?.code === "ENOENT") return [];
      return [];
    }
  }

  private async persistToDisk(): Promise<void> {
    // Serialize write operations to avoid clobbering.
    this.writeInFlight = this.writeInFlight.then(async () => {
      const tmpPath = `${this.dataFilePath}.tmp`;
      const data = JSON.stringify(this.contacts, null, 2);
      await fs.writeFile(tmpPath, data, "utf-8");
      await fs.rename(tmpPath, this.dataFilePath);
    });
    await this.writeInFlight;
  }

  async createOrUpdate(contact: Contact): Promise<{ action: "created" | "updated" }> {
    const result = this.upsert(contact);
    await this.persistToDisk();
    return result;
  }

  async delete(email: string): Promise<boolean> {
    const removed = this.deleteByEmail(email);
    if (!removed) return false;
    await this.persistToDisk();
    return true;
  }
}

export function defaultContactsStore(): ContactsStore {
  // contacts.json lives in `backend/data/`, while this file is in `backend/src/store/`.
  const dataPath = path.resolve(__dirname, "../../data/contacts.json");
  return new ContactsStore(dataPath);
}

