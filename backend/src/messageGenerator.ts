import type { Contact } from "./types";

export function generateMessage(args: {
  contact: Contact;
  relationshipContext: string;
  lastConversation: string;
}): { message: string } {
  const { contact, relationshipContext, lastConversation } = args;

  const firstName = contact.name.trim().split(/\s+/)[0] || contact.name.trim();
  const company = contact.company.trim();
  const context = relationshipContext.trim();
  const lastConv = lastConversation.trim();

  // Template-based generator: deterministic, "AI-like" tone without calling external LLMs.
  const sentence2 =
    lastConv.length > 0
      ? `I’ve been thinking about our last conversation (${lastConv}).`
      : `I hope things are going well on your end.`;

  const message =
    `Hey ${firstName} — it’s been a while since we last spoke. I hope things are going well at ${company}! ` +
    `As a ${context}, I’d love to catch up and learn what you’ve been focused on lately. ` +
    `${sentence2} ` +
    `If you’re open to it, would you have 15–20 minutes in the next couple of weeks for a quick update?`;

  return { message };
}

