// Retail Assist Chat Widget Embed Script
(function() {
  'use strict';

  // Get agent ID from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const agentId = urlParams.get('agent');

  if (!agentId) {
    console.error('Retail Assist: No agent ID provided');
    return;
  }

  // Generate or retrieve session ID
  let sessionId = localStorage.getItem('retail_assist_session');
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('retail_assist_session', sessionId);
  }

  // Create widget container
  const container = document.getElementById('retail-assist-chat');
  if (!container) {
    console.error('Retail Assist: Container element #retail-assist-chat not found');
    return;
  }

  // Widget HTML
  container.innerHTML = `
    <div id="ra-widget" style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 350px;
      height: 500px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    ">
      <div id="ra-header" style="
        background: #f9fafb;
        padding: 16px;
        border-bottom: 1px solid #e5e7eb;
        border-radius: 8px 8px 0 0;
      ">
        <h3 style="margin: 0; font-size: 14px; font-weight: 500; color: #111827;">Chat with us</h3>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">Powered by Retail Assist</p>
      </div>

      <div id="ra-messages" style="
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      ">
        <div id="ra-empty" style="text-align: center; color: #6b7280; font-size: 14px;">
          Start a conversation...
        </div>
      </div>

      <div id="ra-input" style="
        border-top: 1px solid #e5e7eb;
        padding: 16px;
      ">
        <div style="display: flex; gap: 8px;">
          <input
            id="ra-message-input"
            type="text"
            placeholder="Type your message..."
            style="
              flex: 1;
              padding: 8px 12px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 14px;
              outline: none;
            "
          />
          <button
            id="ra-send-button"
            style="
              padding: 8px 16px;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
            "
          >
            Send
          </button>
        </div>
      </div>
    </div>
  `;

  const messagesContainer = document.getElementById('ra-messages');
  const inputElement = document.getElementById('ra-message-input');
  const sendButton = document.getElementById('ra-send-button');
  const emptyMessage = document.getElementById('ra-empty');

  let messages = [];
  let isLoading = false;

  // Show error message to user
  function showError(message) {
    emptyMessage.textContent = message;
    emptyMessage.style.color = '#ef4444'; // red color
    emptyMessage.style.display = 'block';
  }

  // Load conversation history
  async function loadHistory() {
    try {
      const response = await fetch(`/api/chat/${agentId}?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        messages = data.messages || [];
        renderMessages();
      } else {
        showError('Unable to load chat history. Please refresh the page.');
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      showError('Unable to connect to chat service. Please check your connection.');
    }
  }

  // Render messages
  function renderMessages() {
    if (messages.length === 0) {
      emptyMessage.style.display = 'block';
      return;
    }

    emptyMessage.style.display = 'none';
    messagesContainer.innerHTML = '';

    messages.forEach(message => {
      const messageDiv = document.createElement('div');
      messageDiv.style.cssText = `
        display: flex;
        ${message.sender === 'customer' ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
      `;

      const bubble = document.createElement('div');
      bubble.style.cssText = `
        max-width: 280px;
        padding: 8px 12px;
        border-radius: 12px;
        font-size: 14px;
        word-wrap: break-word;
        ${message.sender === 'customer'
          ? 'background: #3b82f6; color: white;'
          : 'background: #f3f4f6; color: #111827;'
        }
      `;
      bubble.textContent = message.content;

      messageDiv.appendChild(bubble);
      messagesContainer.appendChild(messageDiv);
    });

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Send message
  async function sendMessage() {
    const content = inputElement.value.trim();
    if (!content || isLoading) return;

    const userMessage = {
      id: 'user_' + Date.now(),
      sender: 'customer',
      content: content,
      timestamp: new Date().toISOString(),
    };

    messages.push(userMessage);
    renderMessages();
    inputElement.value = '';
    isLoading = true;

    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.id = 'ra-typing';
    typingDiv.style.cssText = 'display: flex; justify-content: flex-start;';
    typingDiv.innerHTML = `
      <div style="
        background: #f3f4f6;
        color: #6b7280;
        padding: 8px 12px;
        border-radius: 12px;
        font-size: 14px;
      ">
        Typing...
      </div>
    `;
    messagesContainer.appendChild(typingDiv);

    try {
      const response = await fetch(`/api/chat/${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, sessionId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.reply) {
          const botMessage = {
            id: 'bot_' + Date.now(),
            sender: 'bot',
            content: data.reply,
            timestamp: new Date().toISOString(),
          };
          messages.push(botMessage);
        }
      } else if (response.status === 429) {
        // Rate limited
        const errorMessage = {
          id: 'error_' + Date.now(),
          sender: 'bot',
          content: 'You\'re sending messages too quickly. Please wait a moment before sending another message.',
          timestamp: new Date().toISOString(),
        };
        messages.push(errorMessage);
      } else {
        // Other error
        const errorMessage = {
          id: 'error_' + Date.now(),
          sender: 'bot',
          content: 'Sorry, I couldn\'t send your message. Please try again.',
          timestamp: new Date().toISOString(),
        };
        messages.push(errorMessage);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = {
        id: 'error_' + Date.now(),
        sender: 'bot',
        content: 'Unable to connect. Please check your internet connection and try again.',
        timestamp: new Date().toISOString(),
      };
      messages.push(errorMessage);
    } finally {
      isLoading = false;
      const typingElement = document.getElementById('ra-typing');
      if (typingElement) {
        typingElement.remove();
      }
      renderMessages();
    }
  }

  // Event listeners
  sendButton.addEventListener('click', sendMessage);
  inputElement.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Load history on init
  loadHistory();
})();