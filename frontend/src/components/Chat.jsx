import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';

function Message({ content, role, citations, meta }) {
  const formatted = content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');

  return (
    <div className={`message ${role}`}>
      <div dangerouslySetInnerHTML={{ __html: formatted }} />
      {citations && citations.length > 0 && (
        <>
          <div className="source-header">Sources:</div>
          {citations.map((c, i) => {
            const section = c.section ? ` — ${c.section}` : '';
            const page = c.page ? ` (p. ${c.page})` : '';
            return (
              <div key={i} className="source-item">
                [{i + 1}] {c.source}{section}{page}
              </div>
            );
          })}
        </>
      )}
      {meta?.model && (
        <div className="meta-tag">
          via {meta.model}{meta.from_fallback ? ' (fallback)' : ''}
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <span className="dot"></span>
      <span className="dot"></span>
      <span className="dot"></span>
    </div>
  );
}

export default function Chat({ getDomain }) {
  const [messages, setMessages] = useState(() => [
    {
      role: 'assistant',
      content: "Hello! I'm your study assistant. Ask me anything about Theory of Computation, or visit the Gaps tab to see your study gaps.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsLoading(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      const result = await api.query(text, getDomain());
      const answer = result.answer || 'No response received.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: answer, citations: result.citations, meta: result.response_meta },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, getDomain]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  return (
    <div id="chat-tab" className="tab-content active">
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <Message
            key={i}
            content={msg.content}
            role={msg.role}
            citations={msg.citations}
            meta={msg.meta}
          />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          id="chat-input"
          placeholder="Ask a question about TOC..."
          rows={1}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        <button
          id="send-btn"
          className="send-btn"
          aria-label="Send message"
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
