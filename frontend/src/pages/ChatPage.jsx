// frontend/src/pages/ChatPage.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chatAPI } from "../api/services";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────
// MessageBubble — single message
// ─────────────────────────────────────────────
const MessageBubble = ({ msg, isMine }) => {
  const time = new Date(msg.created_at).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit"
  });
  return (
    <div className={`bubble-row ${isMine ? "mine" : "theirs"}`}>
      {!isMine && (
        <div className="bubble-avatar">
          {msg.sender_name?.charAt(0).toUpperCase()}
        </div>
      )}
      <div className={`bubble ${isMine ? "bubble-mine" : "bubble-theirs"}`}>
        {!isMine && <span className="bubble-sender">{msg.sender_name}</span>}
        <p className="bubble-text">{msg.message}</p>
        <div className="bubble-meta">
          <span className="bubble-time">{time}</span>
          {isMine && (
            <span className="bubble-read" title={msg.is_read ? "Read" : "Sent"}>
              {msg.is_read ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// ConversationItem — sidebar row
// ─────────────────────────────────────────────
const ConversationItem = ({ conv, isActive, onClick, isPatient }) => {
  const unread = parseInt(conv.unread_count) || 0;
  const time   = conv.last_message_at
    ? new Date(conv.last_message_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className={`conv-item ${isActive ? "active" : ""}`} onClick={onClick}>
      <div className="conv-avatar">
        {conv.other_name?.charAt(0).toUpperCase()}
        <span className="conv-online-dot" />
      </div>
      <div className="conv-info">
        <div className="conv-top">
          <span className="conv-name">
            {isPatient ? `Dr. ${conv.other_name}` : conv.other_name}
          </span>
          <span className="conv-time">{time}</span>
        </div>
        <div className="conv-bottom">
          <span className="conv-preview">
            {conv.last_message || "No messages yet"}
          </span>
          {unread > 0 && <span className="conv-unread-badge">{unread}</span>}
        </div>
        {conv.other_specialization && (
          <span className="conv-spec">{conv.other_specialization}</span>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// ChatPage — main component
// ─────────────────────────────────────────────
const ChatPage = () => {
  const { user }                          = useAuth();
  const { conversationId: urlId }         = useParams();
  const navigate                          = useNavigate();
  const isPatient                         = user.role === "patient";

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv]       = useState(null);
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState("");
  const [sending, setSending]             = useState(false);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);
  const [loadingConvs, setLoadingConvs]   = useState(true);
  const [isTyping, setIsTyping]           = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const pollRef    = useRef(null);

  // scroll to latest message
  const scrollToBottom = () =>
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  // load sidebar conversations
  const loadConversations = useCallback(async () => {
    try {
      const res = await chatAPI.getConversations();
      setConversations(res.data.conversations);
    } catch {
      toast.error("Failed to load conversations");
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // auto-select from URL
  useEffect(() => {
    if (urlId && conversations.length && !activeConv) {
      const found = conversations.find(c => c.id === urlId);
      if (found) openConversation(found);
    }
  }, [urlId, conversations]);

  // load messages (silent = no spinner, used for polling)
  const loadMessages = useCallback(async (convId, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const res = await chatAPI.getMessages(convId);
      setMessages(res.data.messages);
      if (!silent) loadConversations(); // refresh unread counts
    } catch {
      if (!silent) toast.error("Failed to load messages");
    } finally {
      if (!silent) setLoadingMsgs(false);
    }
  }, [loadConversations]);

  // open a conversation
  const openConversation = (conv) => {
    setActiveConv(conv);
    navigate(`/chat/${conv.id}`, { replace: true });
    loadMessages(conv.id);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // polling every 3s for new messages
  useEffect(() => {
    if (!activeConv) return;
    pollRef.current = setInterval(() => loadMessages(activeConv.id, true), 3000);
    return () => clearInterval(pollRef.current);
  }, [activeConv, loadMessages]);

  // scroll on new messages
  useEffect(() => { scrollToBottom(); }, [messages]);

  // send message with optimistic update
  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activeConv || sending) return;

    setSending(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      conversation_id: activeConv.id,
      sender_id: user.id,
      sender_name: user.full_name,
      sender_role: user.role,
      message: text,
      is_read: false,
      created_at: new Date().toISOString(),
      _temp: true,
    };

    setMessages(prev => [...prev, optimistic]);
    setInput("");

    try {
      const res = await chatAPI.sendMessage(activeConv.id, text);
      setMessages(prev => prev.map(m => m.id === tempId ? res.data.message : m));
      setConversations(prev => prev.map(c =>
        c.id === activeConv.id
          ? { ...c, last_message: text, last_message_at: new Date().toISOString() }
          : c
      ));
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(text);
      toast.error(err.response?.data?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // group messages by date for separators
  const grouped = messages.reduce((acc, msg) => {
    const d = new Date(msg.created_at).toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short"
    });
    if (!acc[d]) acc[d] = [];
    acc[d].push(msg);
    return acc;
  }, {});

  return (
    <div className="chat-page">

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`chat-sidebar ${activeConv ? "sidebar-hidden-mobile" : ""}`}>
        <div className="chat-sidebar-header">
          <div>
            <h2 className="chat-sidebar-title">Messages</h2>
            <p className="chat-sidebar-sub">
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </p>
          </div>
          <span className="chat-role-pill">{user.role}</span>
        </div>

        {loadingConvs ? (
          <div className="chat-sidebar-empty">
            <div className="chat-spinner" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="chat-sidebar-empty">
            <p className="chat-empty-icon">💬</p>
            <p className="chat-empty-label">No conversations yet</p>
            {isPatient && (
              <p className="chat-empty-hint">
                Book an appointment with a doctor to start chatting.
              </p>
            )}
          </div>
        ) : (
          <div className="conv-list">
            {conversations.map(conv => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={activeConv?.id === conv.id}
                isPatient={isPatient}
                onClick={() => openConversation(conv)}
              />
            ))}
          </div>
        )}
      </aside>

      {/* ═══ CHAT WINDOW ═══ */}
      <main className={`chat-window ${!activeConv ? "window-hidden-mobile" : ""}`}>
        {!activeConv ? (
          <div className="chat-placeholder">
            <div className="chat-placeholder-icon">💬</div>
            <h3>Your Messages</h3>
            <p>Select a conversation from the sidebar to start messaging.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="chat-window-header">
              <button className="chat-back-btn" onClick={() => { setActiveConv(null); navigate("/chat"); }}>
                ←
              </button>
              <div className="chat-header-avatar">
                {activeConv.other_name?.charAt(0).toUpperCase()}
                <span className="chat-online-indicator" />
              </div>
              <div className="chat-header-info">
                <p className="chat-header-name">
                  {isPatient ? `Dr. ${activeConv.other_name}` : activeConv.other_name}
                </p>
                {activeConv.other_specialization && (
                  <p className="chat-header-sub">{activeConv.other_specialization}</p>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {loadingMsgs ? (
                <div className="chat-msgs-loading">
                  <div className="chat-spinner" />
                  <p>Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="chat-no-msgs">
                  <p className="chat-no-msgs-icon">👋</p>
                  <p>No messages yet. Say hello!</p>
                </div>
              ) : (
                Object.entries(grouped).map(([date, msgs]) => (
                  <div key={date}>
                    <div className="chat-date-sep"><span>{date}</span></div>
                    {msgs.map(msg => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isMine={msg.sender_id === user.id}
                      />
                    ))}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="chat-input-bar">
              <textarea
                ref={inputRef}
                className="chat-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                rows={1}
                disabled={sending}
              />
              <button
                className="chat-send-btn"
                onClick={handleSend}
                disabled={!input.trim() || sending}
              >
                {sending
                  ? <span className="chat-send-spinner" />
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                }
              </button>
            </div>
          </>
        )}
      </main>

    </div>
  );
};

export default ChatPage;
