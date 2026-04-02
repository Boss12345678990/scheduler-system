import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiSend, FiPlus } from 'react-icons/fi';
import { HiOutlineSparkles } from 'react-icons/hi2';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './AIAgentPage.css';

export default function AIAgentPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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

      // Handle actions from AI agent
      if (res.data.actions?.length) {
        for (const action of res.data.actions) {
          if (action.type === 'print_schedule') {
            navigate('/schedule', { state: { printMonth: action.month } });
          }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '抱歉，發生錯誤，請再試一次。',
        timestamp: new Date(),
      }]);
    } finally {
      setSending(false);
    }
  }, [navigate]);

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
          <h1>AI 助理對話</h1>
          <span className="badge badge-online">線上</span>
        </div>
        <div className="ai-header-right">
          <button className="btn-new-chat" onClick={handleNewChat} disabled={sending}>
            <FiPlus /> 新對話
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="ai-messages">
        {messages.length === 0 && (
          <div className="ai-welcome">
            <HiOutlineSparkles className="ai-welcome-icon" />
            <h2>歡迎使用 AI 助理</h2>
            <p>我可以幫您排班、回答系統相關問題，以及提供工作摘要。</p>
            <div className="ai-suggestions">
              <button onClick={() => updateInput('顯示本月排班摘要')}>📊 月度摘要</button>
              <button onClick={() => updateInput('有沒有排班衝突？')}>⚠️ 檢查衝突</button>
              <button onClick={() => updateInput('如何使用排班系統？')}>❓ 使用說明</button>
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
                <span className="message-sender">{msg.role === 'assistant' ? 'AI 助理' : '你'}</span>
                <span className="message-time">{formatTime(msg.timestamp)}</span>
              </div>
              <div className={`message-bubble ${msg.role}`}>
                {msg.role === 'assistant'
                  ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                  : msg.content}
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
            placeholder="輸入訊息或詢問排班相關問題..."
            value={input}
            onChange={(e) => updateInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <button className="send-btn" onClick={handleSend} disabled={!input.trim() || sending}>
            <FiSend />
          </button>
        </div>
        <p className="ai-disclaimer">AI 助理可能會出錯，請驗證重要資訊。</p>
      </div>
    </div>
  );
}
