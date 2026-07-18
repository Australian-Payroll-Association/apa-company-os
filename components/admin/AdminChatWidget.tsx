"use client";

// Admin database assistant: floating button + right slide-in panel, mounted in
// app/admin/(dashboard)/layout.tsx so it is available on every admin page.
// Reuses the admin drawer's backdrop/slide conventions (Escape/backdrop close,
// body scroll lock).
//
// The server is stateless: we hold the Anthropic messages array (opaque JSON
// echoed from the route's `done` event) plus render-friendly display items,
// both persisted to sessionStorage so a full page reload keeps the chat.

import { useCallback, useEffect, useRef, useState } from "react";

type ApprovalStatus = "pending" | "approved" | "declined";

type DisplayItem =
  | { kind: "user"; text: string }
  | { kind: "bot"; text: string; streaming?: boolean }
  | { kind: "tool"; detail: string; name?: string }
  | {
      kind: "approval";
      id: string;
      name: string;
      input: Record<string, unknown>;
      status: ApprovalStatus;
    }
  | { kind: "error"; text: string };

type SseEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; detail: string }
  | { type: "approval"; id: string; name: string; input: Record<string, unknown> }
  | { type: "error"; error: string }
  | { type: "done"; messages: unknown[] };

const STORAGE_KEY = "edge8-admin-chat";

// Restore persisted chat from sessionStorage. Runs as a lazy useState
// initializer (client-only via the window guard). Safe against hydration
// mismatch because the panel is closed on first render, so restored content is
// never in the server-rendered HTML.
function loadSaved(): { items: DisplayItem[]; messages: unknown[] } {
  if (typeof window === "undefined") return { items: [], messages: [] };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [], messages: [] };
    const saved = JSON.parse(raw) as { items?: DisplayItem[]; messages?: unknown[] };
    const items = (saved.items ?? []).map((it) =>
      it.kind === "bot" ? { ...it, streaming: false } : it,
    );
    return { items, messages: saved.messages ?? [] };
  } catch {
    return { items: [], messages: [] };
  }
}

// Minimal markdown: **bold**, `code`, "- " bullet lists, line breaks.
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={`${keyBase}-${i}`}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

function BotText({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  const flush = (key: string) => {
    if (list.length) {
      out.push(<ul key={key}>{list}</ul>);
      list = [];
    }
  };
  lines.forEach((line, i) => {
    if (/^\s*[-*] /.test(line)) {
      list.push(<li key={`li-${i}`}>{renderInline(line.replace(/^\s*[-*] /, ""), `l${i}`)}</li>);
    } else {
      flush(`ul-${i}`);
      if (line.trim()) out.push(<p key={`p-${i}`}>{renderInline(line, `t${i}`)}</p>);
    }
  });
  flush("ul-end");
  return <>{out}</>;
}

const CHIP_LABELS: Record<string, string> = {
  execute_write: "Changed the database",
  send_email: "Sent the email",
};

// Approval card for a pending execute_write / send_email tool call. Nothing
// runs server-side until Approve is clicked.
function ApprovalCard({
  item,
  disabled,
  onDecide,
}: {
  item: Extract<DisplayItem, { kind: "approval" }>;
  disabled: boolean;
  onDecide: (id: string, approved: boolean) => void;
}) {
  const isEmail = item.name === "send_email";
  const statusLabel =
    item.status === "approved" ? "Approved" : item.status === "declined" ? "Cancelled" : null;
  return (
    <div className="chatw-approval">
      <div className="chatw-approval-title">
        {isEmail ? "Send this email?" : "Run this change?"}
      </div>
      {isEmail ? (
        <div className="chatw-approval-email">
          <div>
            <span className="chatw-approval-label">To</span> {String(item.input.to ?? "")}
          </div>
          <div>
            <span className="chatw-approval-label">Subject</span>{" "}
            {String(item.input.subject ?? "")}
          </div>
          <pre>{String(item.input.body ?? "")}</pre>
        </div>
      ) : (
        <pre className="chatw-approval-sql">{String(item.input.sql ?? "")}</pre>
      )}
      {statusLabel ? (
        <div
          className={`chatw-approval-status chatw-approval-status--${item.status}`}
        >
          {statusLabel}
        </div>
      ) : (
        <div className="chatw-approval-actions">
          <button
            type="button"
            className="chatw-approve"
            disabled={disabled}
            onClick={() => onDecide(item.id, true)}
          >
            {isEmail ? "Approve & send" : "Approve & run"}
          </button>
          <button
            type="button"
            className="chatw-decline"
            disabled={disabled}
            onClick={() => onDecide(item.id, false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminChatWidget({ canWrite = false }: { canWrite?: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DisplayItem[]>(() => loadSaved().items);
  const [messages, setMessages] = useState<unknown[]>(() => loadSaved().messages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist chat so it survives full page reloads (in-layout state already
  // survives client navigations between admin pages).
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ items, messages }));
    } catch {
      // storage full: chat still works, just won't survive a reload
    }
  }, [items, messages]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [items, open]);

  // Shared POST + SSE pump for both new user turns and approval decisions.
  // Returns whether the stream completed (reached `done`).
  const runRequest = useCallback(
    async (payload: {
      messages: unknown[];
      decision?: { toolUseId: string; approved: boolean };
    }): Promise<boolean> => {
      setPending(true);
      try {
        const res = await fetch("/api/admin/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok || !res.body) {
          const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
          setItems((prev) => [
            ...prev,
            { kind: "error", text: errBody?.error ?? `Request failed (${res.status})` },
          ]);
          return false;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let gotDone = false;

        const handle = (event: SseEvent) => {
          if (event.type === "text") {
            setItems((prev) => {
              const last = prev[prev.length - 1];
              if (last?.kind === "bot" && last.streaming) {
                return [...prev.slice(0, -1), { ...last, text: last.text + event.text }];
              }
              return [...prev, { kind: "bot", text: event.text, streaming: true }];
            });
          } else if (event.type === "tool") {
            setItems((prev) => [
              ...prev.map((it) => (it.kind === "bot" ? { ...it, streaming: false } : it)),
              { kind: "tool", detail: event.detail, name: event.name },
            ]);
          } else if (event.type === "approval") {
            setItems((prev) => [
              ...prev.map((it) => (it.kind === "bot" ? { ...it, streaming: false } : it)),
              {
                kind: "approval",
                id: event.id,
                name: event.name,
                input: event.input,
                status: "pending",
              },
            ]);
          } else if (event.type === "error") {
            setItems((prev) => [...prev, { kind: "error", text: event.error }]);
          } else if (event.type === "done") {
            gotDone = true;
            setMessages(event.messages);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ")) {
                try {
                  handle(JSON.parse(line.slice(6)) as SseEvent);
                } catch {
                  // skip malformed frame
                }
              }
            }
          }
        }
        if (!gotDone) {
          setItems((prev) => [...prev, { kind: "error", text: "Response interrupted. Try again." }]);
        }
        return gotDone;
      } catch {
        setItems((prev) => [
          ...prev,
          { kind: "error", text: "Could not reach the assistant. Try again." },
        ]);
        return false;
      } finally {
        setItems((prev) => prev.map((it) => (it.kind === "bot" ? { ...it, streaming: false } : it)));
        setPending(false);
      }
    },
    [],
  );

  const runTurn = useCallback(
    (text: string) => {
      setItems((prev) => [...prev, { kind: "user", text }]);
      void runRequest({ messages: [...messages, { role: "user", content: text }] });
    },
    [messages, runRequest],
  );

  // Approve/Cancel a pending write or email. Optimistically resolve the card;
  // if the request never completes, put it back so the action can be retried.
  const decide = useCallback(
    async (id: string, approved: boolean) => {
      const status = approved ? ("approved" as const) : ("declined" as const);
      setItems((prev) =>
        prev.map((it) => (it.kind === "approval" && it.id === id ? { ...it, status } : it)),
      );
      const ok = await runRequest({ messages, decision: { toolUseId: id, approved } });
      if (!ok) {
        setItems((prev) =>
          prev.map((it) =>
            it.kind === "approval" && it.id === id ? { ...it, status: "pending" } : it,
          ),
        );
      }
    },
    [messages, runRequest],
  );

  const hasPendingApproval = items.some(
    (it) => it.kind === "approval" && it.status === "pending",
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending || hasPendingApproval) return;
    setInput("");
    runTurn(text);
  }

  function newChat() {
    setItems([]);
    setMessages([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <button
        type="button"
        className="chatw-fab"
        aria-label="Open admin assistant"
        onClick={() => setOpen(true)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 12c0 4.418-4.03 8-9 8-1.02 0-2-.15-2.91-.43L4 21l1.02-3.4C3.77 16.2 3 14.19 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 12h.01M12 12h.01M15.5 12h.01"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div className="chatw-portal">
          <button
            type="button"
            aria-label="Close"
            className="admin-drawer-backdrop"
            onClick={() => setOpen(false)}
          />
          <aside className="admin-drawer chatw-panel" role="dialog" aria-label="Admin assistant">
            <div className="admin-drawer-head">
              <div>
                <div className="admin-drawer-eyebrow">Edge8 OS</div>
                <h2 className="admin-drawer-title">Assistant</h2>
              </div>
              <div className="chatw-head-actions">
                {items.length > 0 && (
                  <button type="button" className="chatw-newchat" onClick={newChat}>
                    New chat
                  </button>
                )}
                <button
                  type="button"
                  className="admin-drawer-close"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="chatw-msgs" ref={scrollRef}>
              {items.length === 0 && (
                <div className="chatw-empty">
                  <p>Ask anything about the Company OS data:</p>
                  <ul>
                    <li>How many open deals do we have, and what is their total USD value?</li>
                    <li>Which job requisitions are open and how many applicants each?</li>
                    <li>Who is on vacation next week?</li>
                    <li>Top 5 unpaid invoices by balance.</li>
                  </ul>
                  <p className="chatw-empty-note">
                    {canWrite
                      ? "It can also update records and send emails — every change and every email needs your approval first."
                      : "Read-only. The assistant never changes data."}
                  </p>
                </div>
              )}

              {items.map((item, i) => {
                if (item.kind === "user") {
                  return (
                    <div key={i} className="chatw-msg chatw-msg--user">
                      {item.text}
                    </div>
                  );
                }
                if (item.kind === "bot") {
                  return (
                    <div key={i} className="chatw-msg chatw-msg--bot">
                      <BotText text={item.text} />
                    </div>
                  );
                }
                if (item.kind === "tool") {
                  return (
                    <div key={i} className="chatw-toolchip" title={item.detail}>
                      {CHIP_LABELS[item.name ?? ""] ?? "Queried the database"}
                    </div>
                  );
                }
                if (item.kind === "approval") {
                  return (
                    <ApprovalCard key={i} item={item} disabled={pending} onDecide={decide} />
                  );
                }
                return (
                  <div key={i} className="chatw-msg chatw-msg--error">
                    {item.text}
                  </div>
                );
              })}

              {pending && <div className="chatw-typing">Thinking…</div>}
            </div>

            <form className="chatw-composer" onSubmit={onSubmit}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  hasPendingApproval
                    ? "Approve or cancel the pending action first…"
                    : "Ask about the business…"
                }
                disabled={pending || hasPendingApproval}
                aria-label="Message the admin assistant"
              />
              <button
                type="submit"
                className="chatw-send"
                disabled={pending || hasPendingApproval || !input.trim()}
              >
                Send
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
