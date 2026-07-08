/** Chat interface module — handles query submission and message rendering. */

import { api } from './api.js';

export function initChat(getDomain) {
  const messagesEl = document.getElementById('chat-messages');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');

  if (!messagesEl || !inputEl || !sendBtn) return;

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    // Add user message
    addMessage(text, 'user');
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;

    // Show typing indicator
    showTyping();

    try {
      const result = await api.query(text, getDomain());
      hideTyping();
      const answer = result.answer || 'No response received.';
      addMessage(answer, 'assistant', result.citations, result.response_meta);
    } catch (err) {
      hideTyping();
      addMessage(`Error: ${err.message}`, 'assistant');
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  function addMessage(content, role, citations = [], meta = null) {
    const div = document.createElement('div');
    div.className = `message ${role}`;

    // Format content with basic markdown-like support
    const formatted = content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
    div.innerHTML = formatted;

    // Citations
    if (citations && citations.length > 0) {
      const sourceDiv = document.createElement('div');
      sourceDiv.className = 'source-header';
      sourceDiv.textContent = 'Sources:';
      div.appendChild(sourceDiv);

      citations.forEach((c, i) => {
        const item = document.createElement('div');
        item.className = 'source-item';
        const section = c.section ? ` — ${c.section}` : '';
        const page = c.page ? ` (p. ${c.page})` : '';
        item.textContent = `[${i + 1}] ${c.source}${section}${page}`;
        div.appendChild(item);
      });
    }

    // Meta
    if (meta && meta.model) {
      const tag = document.createElement('div');
      tag.className = 'meta-tag';
      tag.textContent = `via ${meta.model}${meta.from_fallback ? ' (fallback)' : ''}`;
      div.appendChild(tag);
    }

    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'typing-indicator';
    div.id = 'typing-indicator';
    div.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  // Event listeners
  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  // Welcome message
  addMessage(
    'Hello! I\'m your study assistant. Ask me anything about Theory of Computation, or visit the Gaps tab to see your study gaps.',
    'assistant'
  );
}
