"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "ai/react";
import { useSession } from "next-auth/react";
import ReactMarkdown from "react-markdown";

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

  async function deleteThread(id, e) {
    e.stopPropagation();
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

  return (
    <div className="max-w-7xl mx-auto px-6 pt-10 pb-16 page-enter">
      <h1 className="font-display font-bold text-3xl mb-1">AI sidekick</h1>
      <p className="text-[var(--ink)]/55 text-sm mb-6">
        Socratic help only — it asks questions and points you in a direction, it never hands you the answer.
      </p>

      {status !== "authenticated" && (
        <p className="text-sm mb-6 text-[var(--ink)]/60">Sign in to start a session with the sidekick.</p>
      )}

      <div
        className="grid md:grid-cols-[260px_1fr] gap-6 bg-white rounded-3xl shadow-[0_10px_40px_-20px_rgba(20,18,43,0.4)] overflow-hidden"
        style={{ minHeight: 560 }}
      >
        <div className="border-r border-black/5 p-4 bg-[var(--lavender)] flex flex-col">
          <button className="btn btn-primary btn-sm w-full mb-4" onClick={newThread} disabled={status !== "authenticated"}>
            + New chat
          </button>
          <div className="text-xs font-semibold text-[var(--ink)]/45 mb-2 px-1">Chat history</div>
          <div className="space-y-1 overflow-y-auto flex-1">
            {threads.map((t) => (
              <button
                key={t._id}
                onClick={() => selectThread(t._id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between gap-2 group transition ${
                  t._id === activeId ? "bg-white shadow-sm font-medium" : "text-[var(--ink)]/60 hover:bg-white/70"
                }`}
              >
                <span className="truncate">{t.title || "New chat"}</span>
                <span
                  onClick={(e) => deleteThread(t._id, e)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--ink)]/30 hover:text-red-500 text-xs shrink-0"
                >
                  ✕
                </span>
              </button>
            ))}
          </div>
        </div>

        {status === "authenticated" && activeId && !loadingThread ? (
          <ChatPanel key={activeId} threadId={activeId} initialMessages={activeMessages} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--ink)]/40">
            {status === "authenticated" ? "Loading…" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatPanel({ threadId, initialMessages }) {
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
    },
  });

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  function chip(label) {
    append({ role: "user", content: label });
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 460 }}>
        {messages.length === 0 && (
          <div className="msg-bubble flex justify-start">
            <div className="max-w-[75%] rounded-2xl px-4 py-3 text-sm bg-[var(--lavender)]">
              Hey! Tell me what you&apos;re stuck on and I&apos;ll help you think it through — I won&apos;t just hand you the answer.
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg-bubble flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[75%] rounded-2xl px-4 py-3 text-sm"
              style={m.role === "user" ? { background: "var(--indigo)", color: "#fff" } : { background: "var(--lavender)" }}
            >
              {m.role === "user" ? (
                <span className="whitespace-pre-wrap">{m.content}</span>
              ) : (
                <div className="markdown-body">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="msg-bubble flex justify-start">
            <div className="rounded-2xl px-4 py-3 bg-[var(--lavender)]">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-black/5">
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" className="chip text-xs border border-black/10 rounded-full px-3 py-1.5" onClick={() => chip("Explain this error")}>Explain this error</button>
          <button type="button" className="chip text-xs border border-black/10 rounded-full px-3 py-1.5" onClick={() => chip("Give me a concept hint")}>Give me a concept hint</button>
          <button type="button" className="chip text-xs border border-black/10 rounded-full px-3 py-1.5" onClick={() => chip("Check my logic flow")}>Check my logic flow</button>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask a question about the quest…"
            className="flex-1 rounded-full border border-black/10 px-4 py-3 text-sm"
          />
          <button className="btn btn-primary btn-sm" type="submit" disabled={isLoading}>Send</button>
        </form>
      </div>
    </div>
  );
}
