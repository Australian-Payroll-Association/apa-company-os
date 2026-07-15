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

type DisplayItem =
  | { kind: "user"; text: string }
  | { kind: "bot"; text: string; streaming?: boolean }
  | { kind: "tool"; detail: string }
  | { kind: "error"; text: string };

type SseEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; detail: string }
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

export function AdminChatWidget() {
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

  const runTurn = useCallback(
    async (text: string) => {
      setPending(true);
      setItems((prev) => [...prev, { kind: "user", text }]);
      const nextMessages = [...messages, { role: "user", content: text }];

      try {
        const res = await fetch("/api/admin/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMessages }),
        });
        if (!res.ok || !res.body) {
          const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
          setItems((prev) => [
            ...prev,
            { kind: "error", text: errBody?.error ?? `Request failed (${res.status})` },
          ]);
          return;
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
              { kind: "tool", detail: event.detail },
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
      } catch {
        setItems((prev) => [
          ...prev,
          { kind: "error", text: "Could not reach the assistant. Try again." },
        ]);
      } finally {
        setItems((prev) => prev.map((it) => (it.kind === "bot" ? { ...it, streaming: false } : it)));
        setPending(false);
      }
    },
    [messages],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    void runTurn(text);
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
                  <p className="chatw-empty-note">Read-only. The assistant never changes data.</p>
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
                      Queried the database
                    </div>
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
                placeholder="Ask about the business…"
                disabled={pending}
                aria-label="Message the admin assistant"
              />
              <button type="submit" className="chatw-send" disabled={pending || !input.trim()}>
                Send
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
