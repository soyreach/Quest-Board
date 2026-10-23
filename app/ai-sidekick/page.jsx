"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "ai/react";
import { useSession } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import { Bug, Lightbulb, MessageSquare, Plus, SendHorizontal, Sparkles, Trash2, Waypoints } from "lucide-react";

// Quick prompts shown under an empty chat and above the composer.
const STARTERS = [
  { label: "Explain this error", hint: "Paste the message and I'll help you read it", Icon: Bug },
  { label: "Give me a concept hint", hint: "A nudge toward the idea, not the answer", Icon: Lightbulb },
  { label: "Check my logic flow", hint: "Walk me through your plan step by step", Icon: Waypoints },
];

function timeAgo(date) {
  if (!date) return "";
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function SidekickPage() {
  const { status } = useSession();
  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);

  async function loadThreads() {
    const res = await fetch("/api/sidekick/threads");
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setThreads(list);
    return list;
  }

  async function selectThread(id) {
    setLoadingThread(true);
    const res = await fetch(`/api/sidekick/threads/${id}`);
    const thread = await res.json();
    setActiveId(id);
    setActiveMessages(
      (thread.messages || []).map((m, i) => ({ id: `${id}-${i}`, role: m.role, content: m.content }))
    );
    setLoadingThread(false);
  }

  async function newThread() {
    const res = await fetch("/api/sidekick/threads", { method: "POST" });
    const thread = await res.json();
    await loadThreads();
    setActiveId(thread._id);
    setActiveMessages([]);
  }

  async function deleteThread(id) {
    await fetch(`/api/sidekick/threads/${id}`, { method: "DELETE" });
    const list = await loadThreads();
    if (id === activeId) {
      if (list.length > 0) selectThread(list[0]._id);
      else newThread();
    }
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      const list = await loadThreads();
      if (list.length > 0) selectThread(list[0]._id);
      else newThread();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const activeThread = threads.find((t) => t._id === activeId);

  return (
    <div className="max-w-7xl mx-auto px-6 pt-10 pb-16 page-enter">
      <header className="mb-6">
        <div className="hub-eyebrow">Study help</div>
        <h1 className="font-display font-bold text-3xl leading-tight">AI sidekick</h1>
        <p className="meta mt-1">
          Socratic help only — it asks questions and points you in a direction, it never hands you the answer.
        </p>
      </header>

      {status === "unauthenticated" ? (
        <div className="hub-card max-w-md mx-auto text-center p-8 mt-10">
          <span className="sidekick-avatar w-12 h-12 mx-auto mb-4" aria-hidden="true"><Sparkles size={20} /></span>
          <h2 className="font-display font-semibold text-xl mb-1">Sign in to start a session</h2>
          <p className="meta mb-5">Your chats are saved to your account so you can pick up where you left off.</p>
          <Link href="/login" className="btn btn-primary">Sign in</Link>
        </div>
      ) : (
        <div className="hub-card sidekick-shell overflow-hidden grid md:grid-cols-[272px_minmax(0,1fr)]">
          <aside className="sidekick-rail flex flex-col min-h-0" aria-label="Chat history">
            <div className="p-3 border-b border-[color:var(--line)]">
              <button className="btn btn-primary btn-sm w-full" onClick={newThread} disabled={status !== "authenticated"}>
                <Plus size={16} aria-hidden="true" /> New chat
              </button>
            </div>
            <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
              <span className="hub-eyebrow">History</span>
              <span className="count-pill">{threads.length}</span>
            </div>
            <ul className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 space-y-0.5 max-h-48 md:max-h-none">
              {threads.map((t) => {
                const active = t._id === activeId;
                return (
                  <li key={t._id} className={`thread-row group ${active ? "active" : ""}`}>
                    <button
                      type="button"
                      onClick={() => selectThread(t._id)}
                      aria-current={active ? "true" : undefined}
                      className="flex-1 min-w-0 flex items-start gap-2.5 text-left px-2.5 py-2"
                    >
                      <MessageSquare size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--muted)]" />
                      <span className="min-w-0">
                        <span className="block text-sm truncate">{t.title || "New chat"}</span>
                        <span className="block text-[0.7rem] text-[var(--muted)]">{timeAgo(t.updatedAt)}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteThread(t._id)}
                      aria-label={`Delete "${t.title || "New chat"}"`}
                      className="thread-delete"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {status === "authenticated" && activeId && !loadingThread ? (
            <ChatPanel
              key={activeId}
              threadId={activeId}
              title={activeThread?.title}
              initialMessages={activeMessages}
              onSaved={loadThreads}
            />
          ) : (
            <div className="flex items-center justify-center gap-1 min-h-[420px] meta">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              <span className="sr-only">Loading chat</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChatPanel({ threadId, title, initialMessages, onSaved }) {
  const messagesRef = useRef(initialMessages);
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: "/api/ai/sidekick",
    id: threadId,
    initialMessages,
    body: { questId: null },
    onFinish: async (assistantMessage) => {
      const withoutDuplicate = messagesRef.current.filter((m) => m.id !== assistantMessage.id);
      const fullHistory = [...withoutDuplicate, assistantMessage];
      await fetch(`/api/sidekick/threads/${threadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: fullHistory }),
      });
      // The server titles a fresh thread from its first question; refresh the list to show it.
      onSaved?.();
    },
  });

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Keep the newest message in view by scrolling the message list itself,
  // so the page around it doesn't jump.
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const formRef = useRef(null);
  const inputRef = useRef(null);
  // Grow the composer with its content, up to a few lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  function chip(label) {
    append({ role: "user", content: label });
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (input.trim() && !isLoading) formRef.current?.requestSubmit();
    }
  }

  const empty = messages.length === 0;

  return (
    <section className="flex flex-col min-h-0 min-w-0" aria-label="Chat">
      <div className="hub-card-head">
        <h2 className="hub-card-title truncate">{title && title !== "New chat" ? title : "New chat"}</h2>
        <span className="badge badge-quiet shrink-0"><Sparkles size={12} aria-hidden="true" /> Socratic mode</span>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-6 space-y-5" aria-live="polite">
        {empty ? (
          <div className="max-w-lg mx-auto text-center pt-6">
            <span className="sidekick-avatar w-12 h-12 mx-auto mb-4" aria-hidden="true"><Sparkles size={20} /></span>
            <h3 className="font-display font-semibold text-xl mb-1">What are you stuck on?</h3>
            <p className="meta mb-6">
              Tell me where you are and I&apos;ll help you think it through. I won&apos;t just hand you the answer.
            </p>
            <div className="grid sm:grid-cols-3 gap-2.5 text-left">
              {STARTERS.map(({ label, hint, Icon }) => (
                <button key={label} type="button" className="starter-card" onClick={() => chip(label)}>
                  <Icon size={16} aria-hidden="true" className="text-[var(--wood)] mb-2" />
                  <span className="block text-sm font-semibold mb-0.5">{label}</span>
                  <span className="block text-xs text-[var(--muted)] leading-snug">{hint}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="msg-bubble flex justify-end">
                <div className="bubble-user max-w-[85%] sm:max-w-[75%]">
                  <span className="whitespace-pre-wrap">{m.content}</span>
                </div>
              </div>
            ) : (
              <div key={m.id} className="msg-bubble flex items-start gap-2.5">
                <span className="sidekick-avatar w-7 h-7 mt-0.5" aria-hidden="true"><Sparkles size={13} /></span>
                <div className="bubble-ai max-w-[85%] sm:max-w-[75%]">
                  <div className="markdown-body">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )
          )
        )}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="msg-bubble flex items-start gap-2.5">
            <span className="sidekick-avatar w-7 h-7 mt-0.5" aria-hidden="true"><Sparkles size={13} /></span>
            <div className="bubble-ai">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              <span className="sr-only">Sidekick is thinking</span>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 sm:px-6 pt-3 pb-4 border-t border-[color:var(--line)]">
        {!empty && (
          <div className="flex gap-2 mb-3 overflow-x-auto -mx-1 px-1 pb-0.5">
            {STARTERS.map(({ label, Icon }) => (
              <button
                key={label}
                type="button"
                disabled={isLoading}
                className="chip shrink-0 inline-flex items-center gap-1.5 text-xs font-medium border border-[color:var(--line)] rounded-full px-3 py-1.5 disabled:opacity-50 disabled:pointer-events-none"
                onClick={() => chip(label)}
              >
                <Icon size={13} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        )}
        <form ref={formRef} onSubmit={handleSubmit} className="composer">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={onKeyDown}
            placeholder="Ask a question about the quest…"
            aria-label="Message the sidekick"
            className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed focus:outline-none"
          />
          <button
            className="btn btn-primary btn-sm !px-3 shrink-0 self-end"
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="Send"
          >
            <SendHorizontal size={16} aria-hidden="true" />
          </button>
        </form>
        <p className="text-[0.7rem] text-[var(--muted)] mt-2 px-1 hidden sm:block">Enter to send · Shift + Enter for a new line</p>
      </div>
    </section>
  );
}
