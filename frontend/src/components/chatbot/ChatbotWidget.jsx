import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { chatbotAPI } from '../../api/services';
import './ChatbotWidget.css';

// ─── Renders **bold** and *italic* markdown in AI messages ────────────────────
function MessageContent({ text }) {
  if (!text) return null;
  return (
    <>
      {text.split('\n').map((line, lineIdx, lines) => {
        // Handle **bold**
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <React.Fragment key={lineIdx}>
            {parts.map((part, i) =>
              i % 2 === 1 ? <strong key={i}>{part}</strong> : part
            )}
            {lineIdx < lines.length - 1 && <br />}
          </React.Fragment>
        );
      })}
    </>
  );
}

// ─── Quick-action chip button ──────────────────────────────────────────────────
function QuickAction({ label, icon, onClick, disabled }) {
  return (
    <button
      className="chatbot-quick-action"
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      <span>{icon}</span> {label}
    </button>
  );
}

// ─── Welcome message (shown when conversation has no history) ──────────────────
const WELCOME_MSG = {
  id   : '__welcome__',
  role : 'assistant',
  content:
    "Hello! 👋 I'm **DocBot**, your AI health assistant powered by **Llama 3**.\n\n" +
    "I can help you:\n" +
    "📅 **Reschedule** an existing appointment\n" +
    "🩺 **Book a new appointment** based on your symptoms\n" +
    "💬 **Answer health questions** and guide you on DocBook\n\n" +
    "Use the quick-action buttons below or just type your request!\n\n" +
    "---\n" +
    "⚕️ *Disclaimer: General guidance only. Always consult a qualified doctor.*",
};

// ─── Detect if the last AI message signals end of a flow (show quick actions) ──
function isFlowCompleted(lastMsg) {
  if (!lastMsg || lastMsg.role !== 'assistant') return false;
  const c = lastMsg.content;
  return (
    c.includes('successfully') ||
    c.includes('anything else') ||
    c.includes('cancelled. ✅')
  );
}

// ─── ChatbotWidget ─────────────────────────────────────────────────────────────
export default function ChatbotWidget() {
  const { user } = useAuth();

  const [isOpen, setIsOpen]       = useState(false);
  const [convId, setConvId]       = useState(null);
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [initializing, setInit]   = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, aiLoading, scrollToBottom]);

  // ── Focus input on open ────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 280);
  }, [isOpen]);

  // ── Init conversation on open ──────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && !convId) initConversation();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const initConversation = async () => {
    setInit(true);
    try {
      const { data } = await chatbotAPI.getOrCreateConversation();
      const id = data.conversation.id;
      setConvId(id);
      const msgRes = await chatbotAPI.getMessages(id);
      setMessages(msgRes.data.messages.length > 0 ? msgRes.data.messages : [WELCOME_MSG]);
    } catch (err) {
      console.error('[ChatbotWidget] init error:', err);
    } finally {
      setInit(false);
    }
  };

  // ── Start new conversation ─────────────────────────────────────────────────
  const handleNewChat = async () => {
    setConvId(null);
    setMessages([]);
    setInput('');
    setInit(true);
    try {
      const { data } = await chatbotAPI.newConversation();
      setConvId(data.conversation.id);
      setMessages([{
        id: `__welcome_${Date.now()}__`,
        role: 'assistant',
        content:
          "New conversation started! 👋\n\n" +
          "Use the buttons below or describe your symptoms / request.\n\n" +
          "---\n" +
          "⚕️ *Disclaimer: General guidance only. Consult a qualified doctor.*",
      }]);
    } catch (err) {
      console.error('[ChatbotWidget] new chat error:', err);
    } finally {
      setInit(false);
    }
  };

  // ── Core send (reusable by keyboard, button, and quick-action chips) ────────
  const sendText = useCallback(async (text) => {
    if (!text || aiLoading || !convId) return;

    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text }]);
    setAiLoading(true);

    try {
      const { data } = await chatbotAPI.sendMessage(convId, text);
      setMessages((prev) => [...prev, data.message]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: '❌ Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setAiLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [aiLoading, convId]);

  const handleSend = () => sendText(input.trim());

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ─── Decide when to show quick-action buttons ──────────────────────────────
  // Show after welcome message OR after a flow completes
  const lastMsg         = messages[messages.length - 1];
  const showQuickActions =
    !aiLoading && !initializing && convId &&
    (
      (messages.length === 1 && lastMsg?.id?.startsWith('__welcome')) ||
      isFlowCompleted(lastMsg)
    );

  // ─── Guard: only patients see the widget ──────────────────────────────────
  if (!user || user.role !== 'patient') return null;

  return (
    <div className="chatbot-widget">

      {/* ── Chat window ──────────────────────────────────────────────────── */}
      {isOpen && (
        <div className="chatbot-window" role="dialog" aria-label="DocBot AI Assistant">

          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar" aria-hidden="true">🤖</div>
              <div>
                <div className="chatbot-title">DocBot</div>
                <div className="chatbot-subtitle">Llama 3 · AI Health Assistant</div>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button className="chatbot-btn-icon" onClick={handleNewChat}
                title="New conversation" disabled={initializing}>🔄</button>
              <button className="chatbot-btn-icon" onClick={() => setIsOpen(false)}
                title="Close">✕</button>
            </div>
          </div>

          {/* Disclaimer banner */}
          <div className="chatbot-disclaimer-banner" role="note">
            ⚕️ General guidance only — not a substitute for professional medical advice.
          </div>

          {/* Messages */}
          <div className="chatbot-messages" aria-live="polite">
            {initializing && (
              <div className="chatbot-loading-init">
                <div className="chatbot-dots"><span /><span /><span /></div>
                <p>Starting conversation…</p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`chatbot-msg chatbot-msg--${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="chatbot-msg-avatar" aria-hidden="true">🤖</div>
                )}
                <div className="chatbot-msg-bubble">
                  <MessageContent text={msg.content} />
                </div>
              </div>
            ))}

            {/* AI typing indicator */}
            {aiLoading && (
              <div className="chatbot-msg chatbot-msg--assistant">
                <div className="chatbot-msg-avatar" aria-hidden="true">🤖</div>
                <div className="chatbot-msg-bubble chatbot-typing" aria-label="DocBot is typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {/* Quick-action chips — appear after welcome or after flow completion */}
            {showQuickActions && (
              <div className="chatbot-quick-actions">
                <QuickAction
                  icon="📅" label="Reschedule Appointment"
                  onClick={() => sendText('I want to reschedule an appointment')}
                  disabled={aiLoading}
                />
                <QuickAction
                  icon="🩺" label="Book New Appointment"
                  onClick={() => sendText('I want to book a new appointment')}
                  disabled={aiLoading}
                />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="chatbot-input-area">
            <textarea
              ref={inputRef}
              className="chatbot-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe symptoms, type 'reschedule', or ask anything…"
              rows={1}
              maxLength={1000}
              disabled={aiLoading || initializing || !convId}
              aria-label="Type your message"
            />
            <button
              className="chatbot-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || aiLoading || !convId}
              aria-label="Send"
              title="Send"
            >
              ➤
            </button>
          </div>
          <div className="chatbot-input-hint">
            Enter to send &nbsp;•&nbsp; Shift+Enter for new line
          </div>
        </div>
      )}

      {/* ── Floating toggle ───────────────────────────────────────────────── */}
      <button
        className={`chatbot-toggle-btn ${isOpen ? 'chatbot-toggle-btn--open' : ''}`}
        onClick={() => setIsOpen((o) => !o)}
        aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Health Assistant'}
      >
        {isOpen ? '✕' : <><span>🩺</span> <span className="chatbot-toggle-label">Ask DocBot</span></>}
      </button>
    </div>
  );
}
