import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import "./app.css";

const API_URL = "http://localhost:8000/chat";

const GeminiIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#4285F4"/>
    <path d="M12 6l1.5 4.5H18l-3.75 2.73 1.43 4.38L12 15l-3.68 2.61 1.43-4.38L6 10.5h4.5L12 6z" fill="white"/>
  </svg>
);

const UserIcon = () => (
  <div className="user-avatar">U</div>
);

function CodeBlock({ language, children }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="code-block">
      <div className="code-header">
        <span>{language || "code"}</span>
        <button onClick={copy}>{copied ? "Copied!" : "Copy"}</button>
      </div>
      <SyntaxHighlighter style={oneDark} language={language} PreTag="div">
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`message-row ${isUser ? "user-row" : "bot-row"}`}>
      {!isUser && (
        <div className="bot-avatar">
          <GeminiIcon />
        </div>
      )}
      <div className={`message-bubble ${isUser ? "user-bubble" : "bot-bubble"}`}>
        {isUser ? (
          <p>{msg.content}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
            code(props) {
              const { children, className, node, ...rest } = props;
              const match = /language-(\w+)/.exec(className || "");
              return match ? (
                <CodeBlock language={match[1]}>{String(children).replace(/\n$/, "")}</CodeBlock>
              ) : (
                <code className="inline-code" {...rest}>
                  {children}
                </code>
              );
            },
          }}
        >
          {msg.content}
        </ReactMarkdown>
      )}
      {msg.streaming && <span className="cursor" />}
    </div>
    {isUser && <UserIcon />}
  </div>
);
}

export default function App() {
  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem("gemini_chats");
    return saved ? JSON.parse(saved) : [];
  });
  const [activeId, setActiveId] = useState(() => {
    const saved = localStorage.getItem("gemini_active_id");
    return saved || null;
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem("gemini_chats", JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem("gemini_active_id", activeId || "");
  }, [activeId]);

  // Current active conversation
  const activeChat = conversations.find(c => c.id === activeId);
  const messages = activeChat ? activeChat.messages : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createNewChat = () => {
    const newId = Date.now().toString();
    const newChat = {
      id: newId,
      title: "New Chat",
      messages: [],
      createdAt: new Date().toISOString()
    };
    setConversations([newChat, ...conversations]);
    setActiveId(newId);
    setSidebarOpen(false);
    setInput("");
    setEditingId(null);
  };

  const deleteChat = (id, e) => {
    e.stopPropagation();
    const updated = conversations.filter(c => c.id !== id);
    setConversations(updated);
    if (activeId === id) {
      setActiveId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const startRenaming = (chat, e) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setRenameTitle(chat.title);
  };

  const saveRename = (id) => {
    if (renameTitle.trim()) {
      setConversations(prev => prev.map(c => 
        c.id === id ? { ...c, title: renameTitle.trim() } : c
      ));
    }
    setEditingId(null);
  };

  const handleRenameKeyDown = (e, id) => {
    if (e.key === "Enter") saveRename(id);
    if (e.key === "Escape") setEditingId(null);
  };

  const updateActiveChatMessages = (updater) => {
    setConversations(prev => prev.map(c => {
      if (c.id === activeId) {
        const newMessages = typeof updater === 'function' ? updater(c.messages) : updater;
        // Update title if it's the first user message
        let newTitle = c.title;
        if (c.title === "New Chat" && newMessages.length > 0) {
          const firstUserMsg = newMessages.find(m => m.role === "user");
          if (firstUserMsg) {
            newTitle = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? "..." : "");
          }
        }
        return { ...c, messages: newMessages, title: newTitle };
      }
      return c;
    }));
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    let currentId = activeId;
    if (!currentId) {
      const newId = Date.now().toString();
      const newChat = {
        id: newId,
        title: text.slice(0, 30) + (text.length > 30 ? "..." : ""),
        messages: [],
        createdAt: new Date().toISOString()
      };
      setConversations([newChat, ...conversations]);
      setActiveId(newId);
      currentId = newId;
    }

    const userMsg = { role: "user", content: text };
    
    // We need to use the functional update to ensure we have the latest messages
    // but also handle the streaming state correctly.
    // To simplify, we'll update the conversations state directly.

    setConversations(prev => prev.map(c => {
      if (c.id === currentId) {
        const newMessages = [...c.messages, userMsg];
        let newTitle = c.title;
        if (c.title === "New Chat") {
           newTitle = text.slice(0, 30) + (text.length > 30 ? "..." : "");
        }
        return { ...c, messages: newMessages, title: newTitle };
      }
      return c;
    }));

    setInput("");
    setLoading(true);

    // Prepare messages for the API (everything in the current chat)
    const chatToUpdate = conversations.find(c => c.id === currentId) || { messages: [] };
    const messagesForApi = [...chatToUpdate.messages, userMsg];

    // Add empty bot message for streaming
    setConversations(prev => prev.map(c => {
      if (c.id === currentId) {
        return { ...c, messages: [...c.messages, { role: "model", content: "", streaming: true }] };
      }
      return c;
    }));

    const botMsgIndex = messagesForApi.length; // index in the updated messages array

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForApi.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error("Failed to connect");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let botContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.replace("data: ", "").trim();
          if (raw === "[DONE]") break;
          
          try {
            const parsed = JSON.parse(raw);
            if (parsed.text) {
              botContent += parsed.text;
              setConversations(prev => prev.map(c => {
                if (c.id === currentId) {
                  const updatedMsgs = [...c.messages];
                  updatedMsgs[botMsgIndex] = { role: "model", content: botContent, streaming: true };
                  return { ...c, messages: updatedMsgs };
                }
                return c;
              }));
            } else if (parsed.error) {
              botContent = "❌ Error: " + parsed.error;
              setConversations(prev => prev.map(c => {
                if (c.id === currentId) {
                  const updatedMsgs = [...c.messages];
                  updatedMsgs[botMsgIndex] = { role: "model", content: botContent, streaming: false };
                  return { ...c, messages: updatedMsgs };
                }
                return c;
              }));
              break;
            }
          } catch (e) {
            console.error("Error parsing JSON chunk:", e);
          }
        }
      }

      setConversations(prev => prev.map(c => {
        if (c.id === currentId) {
          const updatedMsgs = [...c.messages];
          updatedMsgs[botMsgIndex] = { role: "model", content: botContent, streaming: false };
          return { ...c, messages: updatedMsgs };
        }
        return c;
      }));
    } catch (err) {
      setConversations(prev => prev.map(c => {
        if (c.id === currentId) {
          const updatedMsgs = [...c.messages];
          updatedMsgs[botMsgIndex] = {
            role: "model",
            content: "⚠️ Error connecting to the server.",
            streaming: false,
          };
          return { ...c, messages: updatedMsgs };
        }
        return c;
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={createNewChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New chat
          </button>
        </div>
        <div className="history-list">
          {conversations.map((chat) => (
            <div 
              key={chat.id} 
              className={`history-item ${activeId === chat.id ? "active" : ""}`}
              onClick={() => { setActiveId(chat.id); setSidebarOpen(false); }}
            >
              {editingId === chat.id ? (
                <input
                  autoFocus
                  className="edit-input"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  onBlur={() => saveRename(chat.id)}
                  onKeyDown={(e) => handleRenameKeyDown(e, chat.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="history-item-title">{chat.title}</span>
                  <div className="action-btns">
                    <button className="edit-btn" onClick={(e) => startRenaming(chat, e)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path>
                      </svg>
                    </button>
                    <button className="delete-btn" onClick={(e) => deleteChat(chat.id, e)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </aside>

      <div className="main-content">
        <header className="header">
          <div className="header-left">
            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <GeminiIcon />
            <span className="header-title">Gemini Chat</span>
          </div>
        </header>

        <main className="chat-area">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><GeminiIcon /></div>
              <h2>How can I help you today?</h2>
              <div className="suggestions">
                {["Explain quantum computing simply", "Write a Python web scraper", "What is the difference between ML and AI?", "Give me a study plan for cybersecurity"].map((s) => (
                  <button key={s} className="suggestion-chip" onClick={() => { setInput(s); textareaRef.current?.focus(); }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((msg, i) => <Message key={i} msg={msg} />)}
              <div ref={bottomRef} />
            </div>
          )}
        </main>

        <footer className="input-area">
          <div className="input-box">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Gemini..."
              rows={1}
              disabled={loading}
            />
            <button
              className={`send-btn ${loading ? "loading" : ""}`}
              onClick={sendMessage}
              disabled={!input.trim() || loading}
            >
              {loading ? (
                <span className="spinner" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
                </svg>
              )}
            </button>
          </div>
          <p className="disclaimer">Gemini can make mistakes. Verify important information.</p>
        </footer>
      </div>
    </div>
  );
}