import React, { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { Contact, Recommendation } from "./types";
import {
  createContact,
  deleteContact,
  fetchContacts,
  fetchRecommendations,
  generateMessage,
  updateContact,
} from "./api";

const KEYWORDS = ["mentor", "investor", "advisor", "friend"] as const;

function safeLower(s: string | undefined | null): string {
  return (s ?? "").toString().toLowerCase();
}

function defaultContextFromNotes(notes: string): string {
  const lower = safeLower(notes);
  const match = KEYWORDS.find((k) => lower.includes(k));
  return match ? match : "friend";
}

function parseDateMaybe(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function dateSortAsc(a: string, b: string): number {
  const da = parseDateMaybe(a);
  const db = parseDateMaybe(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da.getTime() - db.getTime();
}

type SortOption = "priority" | "lastContactedAsc" | "nameAsc";

export default function App() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string>("");

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("priority");

  const [loading, setLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string>("");

  // Add form
  const [addForm, setAddForm] = useState<Omit<Contact, "notes"> & { notes: string }>({
    name: "",
    email: "",
    company: "",
    lastContactedDate: "",
    notes: "",
  });

  // Update form (driven by selection)
  const selected = useMemo(
    () => contacts.find((c) => c.email.toLowerCase() === selectedEmail.toLowerCase()),
    [contacts, selectedEmail],
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<Contact | null>(null);

  // Message generator
  const [relationshipContext, setRelationshipContext] = useState("");
  const [lastConversation, setLastConversation] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [messageLoading, setMessageLoading] = useState(false);

  const recommendedRank = useMemo(() => {
    const map = new Map<string, number>();
    recommendations.forEach((r, idx) => map.set(r.name.toLowerCase(), idx));
    return map;
  }, [recommendations]);

  const recommendedReasonByName = useMemo(() => {
    const map = new Map<string, string>();
    recommendations.forEach((r) => map.set(r.name.toLowerCase(), r.reason));
    return map;
  }, [recommendations]);

  const recommendedNamesSet = useMemo(() => new Set(recommendations.map((r) => r.name.toLowerCase())), [recommendations]);

  async function loadAll() {
    setBannerError("");
    const [cs, rs] = await Promise.all([fetchContacts(), fetchRecommendations()]);
    setContacts(cs);
    setRecommendations(rs);

    // Keep selection if possible.
    if (selectedEmail) {
      const stillExists = cs.some((c) => c.email.toLowerCase() === selectedEmail.toLowerCase());
      if (!stillExists) setSelectedEmail("");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await loadAll();
      } catch (err: any) {
        setBannerError(err?.message ?? String(err));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // When selection changes, prime message generator defaults.
    if (!selected) return;
    setIsEditing(false);
    setEditDraft(null);
    setGeneratedMessage("");
    setRelationshipContext(defaultContextFromNotes(selected.notes));
    setLastConversation("");
  }, [selectedEmail]); // selected derived; OK for prototype

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = !q
      ? contacts
      : contacts.filter((c) => `${c.name} ${c.email} ${c.company}`.toLowerCase().includes(q));

    const ranked = [...filtered];
    if (sortOption === "priority") {
      ranked.sort((a, b) => {
        const aRec = recommendedRank.get(a.name.toLowerCase());
        const bRec = recommendedRank.get(b.name.toLowerCase());
        const aRank = aRec === undefined ? Number.POSITIVE_INFINITY : aRec;
        const bRank = bRec === undefined ? Number.POSITIVE_INFINITY : bRec;
        if (aRank !== bRank) return aRank - bRank;
        // Secondary: older contacts first.
        return dateSortAsc(a.lastContactedDate, b.lastContactedDate);
      });
    } else if (sortOption === "lastContactedAsc") {
      ranked.sort((a, b) => dateSortAsc(a.lastContactedDate, b.lastContactedDate));
    } else if (sortOption === "nameAsc") {
      ranked.sort((a, b) => a.name.localeCompare(b.name));
    }
    return ranked;
  }, [contacts, searchQuery, sortOption, recommendedRank]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBannerError("");
    try {
      const created = await createContact(addForm);
      await loadAll();
      setSelectedEmail(created.email);
      setAddForm({ name: "", email: "", company: "", lastContactedDate: "", notes: "" });
    } catch (err: any) {
      setBannerError(err?.message ?? String(err));
    }
  }

  async function handleUpdate() {
    if (!selected || !editDraft) return;
    setBannerError("");
    try {
      await updateContact(selected.email, editDraft);
      await loadAll();
      setIsEditing(false);
      setEditDraft(null);
    } catch (err: any) {
      setBannerError(err?.message ?? String(err));
    }
  }

  async function handleDelete(email: string) {
    setBannerError("");
    try {
      const ok = window.confirm(`Delete contact with email ${email}?`);
      if (!ok) return;
      await deleteContact(email);
      await loadAll();
      setSelectedEmail("");
    } catch (err: any) {
      setBannerError(err?.message ?? String(err));
    }
  }

  async function handleGenerateMessage() {
    if (!selected) return;
    setBannerError("");
    setMessageLoading(true);
    setGeneratedMessage("");
    try {
      const out = await generateMessage({
        contactName: selected.name,
        relationshipContext: relationshipContext.trim(),
        lastConversation: lastConversation.trim(),
      });
      setGeneratedMessage(out.message);
    } catch (err: any) {
      setBannerError(err?.message ?? String(err));
    } finally {
      setMessageLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>AI Contact Reminder</h1>
        <p className="subtitle">Decide who to reach out to, and generate a professional follow-up.</p>
      </header>

      {bannerError ? <div className="banner error">{bannerError}</div> : null}
      {loading ? <div className="muted">Loading...</div> : null}

      <div className="layout">
        <aside className="panel left">
          <section className="section">
            <h2>Recommendations</h2>
            {recommendations.length === 0 ? (
              <div className="muted">No one is recommended today.</div>
            ) : (
              <ul className="recList">
                {recommendations.map((r) => (
                  <li key={r.name}>
                    <div className="recName">{r.name}</div>
                    <div className="recReason">{r.reason}</div>
                    <button
                      className="linkButton"
                      onClick={() => {
                        const c = contacts.find((x) => x.name.toLowerCase() === r.name.toLowerCase());
                        if (c) setSelectedEmail(c.email);
                      }}
                      type="button"
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <main className="panel center">
          <section className="section">
            <div className="row">
              <h2>Contacts</h2>
              <div className="rowRight">
                <input
                  className="input"
                  placeholder="Search by name, email, company"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select className="select" value={sortOption} onChange={(e) => setSortOption(e.target.value as SortOption)}>
                  <option value="priority">Sort: Priority</option>
                  <option value="lastContactedAsc">Sort: Oldest contacted</option>
                  <option value="nameAsc">Sort: Name</option>
                </select>
              </div>
            </div>

            {filteredAndSorted.length === 0 ? (
              <div className="muted">No contacts match your search.</div>
            ) : (
              <ul className="contactList">
                {filteredAndSorted.map((c) => {
                  const isSelected = c.email.toLowerCase() === selectedEmail.toLowerCase();
                  const isRec = recommendedNamesSet.has(c.name.toLowerCase());
                  return (
                    <li
                      key={c.email}
                      className={isSelected ? "contactItem selected" : "contactItem"}
                    >
                      <button className="contactButton" type="button" onClick={() => setSelectedEmail(c.email)}>
                        <div className="contactTop">
                          <div className="contactName">{c.name}</div>
                          {isRec ? <span className="badge">Recommended</span> : null}
                        </div>
                        <div className="contactMeta">
                          {c.company} • {c.email}
                        </div>
                        {isRec ? <div className="contactRecReason">{recommendedReasonByName.get(c.name.toLowerCase())}</div> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="section">
            <h2>Add contact</h2>
            <form className="form" onSubmit={handleAdd}>
              <div className="grid2">
                <label>
                  Name
                  <input
                    className="input"
                    value={addForm.name}
                    onChange={(e) => setAddForm((s) => ({ ...s, name: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    className="input"
                    value={addForm.email}
                    onChange={(e) => setAddForm((s) => ({ ...s, email: e.target.value }))}
                    required
                    type="email"
                  />
                </label>
              </div>
              <div className="grid2">
                <label>
                  Company
                  <input
                    className="input"
                    value={addForm.company}
                    onChange={(e) => setAddForm((s) => ({ ...s, company: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Last contacted (YYYY-MM-DD)
                  <input
                    className="input"
                    value={addForm.lastContactedDate}
                    onChange={(e) => setAddForm((s) => ({ ...s, lastContactedDate: e.target.value }))}
                    required
                    placeholder="2024-01-10"
                  />
                </label>
              </div>
              <label>
                Notes (signals: mentor/investor/advisor/friend)
                <input
                  className="input"
                  value={addForm.notes}
                  onChange={(e) => setAddForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </label>
              <button className="button" type="submit">
                Add
              </button>
            </form>
          </section>
        </main>

        <aside className="panel right">
          <section className="section">
            <h2>Profile</h2>
            {!selected ? (
              <div className="muted">Select a contact to view their profile.</div>
            ) : (
              <>
                {!isEditing ? (
                  <>
                    <div className="profileBlock">
                      <div className="profileRow">
                        <span className="profileLabel">Name</span>
                        <span className="profileValue">{selected.name}</span>
                      </div>
                      <div className="profileRow">
                        <span className="profileLabel">Company</span>
                        <span className="profileValue">{selected.company}</span>
                      </div>
                      <div className="profileRow">
                        <span className="profileLabel">Email</span>
                        <span className="profileValue">{selected.email}</span>
                      </div>
                      <div className="profileRow">
                        <span className="profileLabel">Last contacted</span>
                        <span className="profileValue">{selected.lastContactedDate}</span>
                      </div>
                      <div className="profileRow">
                        <span className="profileLabel">Notes</span>
                        <span className="profileValue">{selected.notes || <span className="muted">—</span>}</span>
                      </div>
                    </div>

                    <div className="rowButtons">
                      <button
                        className="button"
                        type="button"
                        onClick={() => {
                          setEditDraft({ ...selected });
                          setIsEditing(true);
                        }}
                      >
                        Edit
                      </button>
                      <button className="button danger" type="button" onClick={() => handleDelete(selected.email)}>
                        Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form">
                      <div className="grid2">
                        <label>
                          Name
                          <input
                            className="input"
                            value={editDraft?.name ?? ""}
                            onChange={(e) => setEditDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                            required
                          />
                        </label>
                        <label>
                          Company
                          <input
                            className="input"
                            value={editDraft?.company ?? ""}
                            onChange={(e) => setEditDraft((d) => (d ? { ...d, company: e.target.value } : d))}
                            required
                          />
                        </label>
                      </div>
                      <label>
                        Last contacted (YYYY-MM-DD)
                        <input
                          className="input"
                          value={editDraft?.lastContactedDate ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => (d ? { ...d, lastContactedDate: e.target.value } : d))
                          }
                          required
                          placeholder="2024-01-10"
                        />
                      </label>
                      <label>
                        Notes
                        <input
                          className="input"
                          value={editDraft?.notes ?? ""}
                          onChange={(e) => setEditDraft((d) => (d ? { ...d, notes: e.target.value } : d))}
                        />
                      </label>

                      <div className="rowButtons">
                        <button className="button" type="button" onClick={handleUpdate}>
                          Save changes
                        </button>
                        <button
                          className="button"
                          type="button"
                          onClick={() => {
                            setIsEditing(false);
                            setEditDraft(null);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </section>

          <section className="section">
            <h2>Generate message</h2>
            {!selected ? (
              <div className="muted">Pick a contact first.</div>
            ) : (
              <>
                <label>
                  Relationship context (e.g. mentor, investor)
                  <input className="input" value={relationshipContext} onChange={(e) => setRelationshipContext(e.target.value)} required />
                </label>
                <label>
                  Last conversation / topic
                  <textarea
                    className="textarea"
                    value={lastConversation}
                    onChange={(e) => setLastConversation(e.target.value)}
                    placeholder="We discussed fundraising strategy"
                    required
                  />
                </label>
                <button
                  className="button"
                  type="button"
                  disabled={messageLoading || !relationshipContext.trim() || !lastConversation.trim()}
                  onClick={handleGenerateMessage}
                >
                  {messageLoading ? "Generating..." : "Generate message"}
                </button>
                {generatedMessage ? (
                  <div className="messageBox">
                    <div className="messageLabel">Message</div>
                    <div className="messageText">{generatedMessage}</div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

