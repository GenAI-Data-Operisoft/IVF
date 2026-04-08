/**
 * Chatbot — AI assistant for staff queries about the IVF system.
 */
import { useState, useRef, useEffect } from 'react';
import { api } from '../api';

const SUGGESTIONS = [
  "Today's stats",
  "Show recent failures",
  "Show in-progress cases",
  "Total cases in system",
  "Help",
];

const IcoBot = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/>
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v4"/>
    <line x1="8" y1="16" x2="8" y2="16"/><line x1="12" y1="16" x2="12" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
);

const IcoSend = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const IcoClose = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// Simple markdown-like renderer for bold and bullets
function renderAnswer(text) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bold: **text**
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const rendered = parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p);
    // Bullet
    if (line.startsWith('• ') || line.startsWith('* ')) {
      return <div key={i} style={{ paddingLeft: '0.5rem', marginBottom: '2px' }}>• {rendered.slice(1)}</div>;
    }
    if (line === '') return <div key={i} style={{ height: '6px' }} />;
    return <div key={i} style={{ marginBottom: '2px' }}>{rendered}</div>;
  });
}

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hi! I\'m your IVF Assistant. Ask me about cases, patients, failures, or stats.\n\nTry: *"Today\'s stats"* or *"show recent failures"*' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const data = await api.chat(q);
      const answer = data.answer || 'Sorry, I could not find an answer.';
      setMessages(m => [...m, { role: 'bot', text: answer }]);
      if (!open) setUnread(u => u + 1);
    } catch {
      setMessages(m => [...m, { role: 'bot', text: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 999,
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(102,126,234,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', transition: 'transform 0.2s, box-shadow 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        title="IVF Assistant"
      >
        {open ? <IcoClose /> : <IcoBot />}
        {!open && unread > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: '#e11d48', color: 'white', borderRadius: '50%',
            width: '18px', height: '18px', fontSize: '0.7rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>{unread}</span>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '92px', right: '24px', zIndex: 998,
          width: '360px', maxHeight: '520px',
          background: 'white', borderRadius: '16px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          border: '1px solid #e8ecf4',
          animation: 'chatSlideUp 0.2s ease'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '16px 16px 0 0', padding: '1rem 1.25rem',
            display: 'flex', alignItems: 'center', gap: '10px', color: 'white'
          }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IcoBot />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>IVF Assistant</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>Ask about cases, patients & stats</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '5px 8px', cursor: 'pointer', color: 'white' }}>
              <IcoClose />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '200px', maxHeight: '320px' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '0.6rem 0.9rem', borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#f8f9ff',
                  color: msg.role === 'user' ? 'white' : '#1a202c',
                  fontSize: '0.85rem', lineHeight: '1.5',
                  border: msg.role === 'bot' ? '1px solid #e8ecf4' : 'none',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                }}>
                  {msg.role === 'bot' ? renderAnswer(msg.text) : msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#f8f9ff', border: '1px solid #e8ecf4', borderRadius: '12px 12px 12px 2px', padding: '0.6rem 1rem', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#667eea', animation: `dotBounce 1.2s ${i*0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div style={{ padding: '0 1rem 0.5rem', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  padding: '4px 10px', borderRadius: '20px', border: '1px solid #c7d2fe',
                  background: '#eef2ff', color: '#667eea', fontSize: '0.78rem', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.15s'
                }}>{s}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about cases, patients, stats..."
              rows={1}
              style={{
                flex: 1, padding: '0.55rem 0.75rem', border: '2px solid #e2e8f0',
                borderRadius: '10px', fontSize: '0.85rem', resize: 'none',
                outline: 'none', fontFamily: 'inherit', lineHeight: '1.4',
                maxHeight: '80px', overflowY: 'auto'
              }}
              onFocus={e => e.target.style.borderColor = '#667eea'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              style={{
                width: '36px', height: '36px', borderRadius: '10px', border: 'none',
                background: input.trim() && !loading ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#e2e8f0',
                color: input.trim() && !loading ? 'white' : '#94a3b8',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.2s'
              }}
            >
              <IcoSend />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40%            { transform: translateY(-6px); }
        }
      `}</style>
    </>
  );
}
