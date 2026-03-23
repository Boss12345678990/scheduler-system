import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { FiSend, FiPlus } from 'react-icons/fi';
import { HiOutlineSparkles } from 'react-icons/hi2';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './AIAgentPage.css';

export default function AIAgentPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(() => sessionStorage.getItem('ai-draft') || '');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const autoSendHandled = useRef(false);
  const initialLoad = useRef(true);

  const sendMessage = useCallback(async (message) => {
    setSending(true);
    setMessages(prev => [...prev, { role: 'user', content: message, timestamp: new Date() }]);

    try {
      const res = await api.post('/ai/chat', { message });
      setMessages(res.data.messages);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setSending(false);
    }
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/ai/history');
        setMessages(res.data);
      } catch (err) {
        console.error(err);
      }

      // Auto-send message from navigation state after history loads
      if (location.state?.autoSend && !autoSendHandled.current) {
        autoSendHandled.current = true;
        sendMessage(location.state.autoSend);
      }
    };
    fetchHistory();
  }, [location.state, sendMessage]);

  useEffect(() => {
    if (initialLoad.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      initialLoad.current = false;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const updateInput = (value) => {
    setInput(value);
    sessionStorage.setItem('ai-draft', value);
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const message = input.trim();
    updateInput('');
    sendMessage(message);
  };

  const handleNewChat = async () => {
    try {
      await api.post('/ai/history/clear');
      setMessages([]);
      updateInput('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="ai-page">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-header-left">
          <HiOutlineSparkles className="ai-header-icon" />
          <h1>AI Agent Chat</h1>
          <span className="badge badge-online">ONLINE</span>
        </div>
        <div className="ai-header-right">
          <button className="btn-new-chat" onClick={handleNewChat} disabled={sending}>
            <FiPlus /> New Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="ai-messages">
        {messages.length === 0 && (
          <div className="ai-welcome">
            <HiOutlineSparkles className="ai-welcome-icon" />
            <h2>Welcome to AI Assistant</h2>
            <p>I can help you with scheduling, answer questions about the system, and provide work summaries.</p>
            <div className="ai-suggestions">
              <button onClick={() => updateInput('Show me a summary of this month\'s schedule')}>📊 Monthly summary</button>
              <button onClick={() => updateInput('Are there any scheduling conflicts?')}>⚠️ Check conflicts</button>
              <button onClick={() => updateInput('How do I use the scheduling system?')}>❓ How to use</button>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="message-avatar ai-avatar">
                <HiOutlineSparkles />
              </div>
            )}
            <div className="message-body">
              <div className="message-meta">
                <span className="message-sender">{msg.role === 'assistant' ? 'AI Assistant' : 'You'}</span>
                <span className="message-time">{formatTime(msg.timestamp)}</span>
              </div>
              <div className={`message-bubble ${msg.role}`}>
                {msg.content}
              </div>
            </div>
            {msg.role === 'user' && (
              <div className="message-avatar user-avatar-chat">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="message assistant">
            <div className="message-avatar ai-avatar"><HiOutlineSparkles /></div>
            <div className="message-body">
              <div className="message-bubble assistant typing">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="ai-input-area">
        <div className="ai-input-wrapper">
          <input
            type="text"
            placeholder="Type a message or ask for help with scheduling..."
            value={input}
            onChange={(e) => updateInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <button className="send-btn" onClick={handleSend} disabled={!input.trim() || sending}>
            <FiSend />
          </button>
        </div>
        <p className="ai-disclaimer">AI AGENT CAN MAKE MISTAKES. VERIFY IMPORTANT INFORMATION.</p>
      </div>
    </div>
  );
}
