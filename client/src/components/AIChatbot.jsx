import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, X, Bot, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiUrl } from '../utils/api';
import { useLocation } from 'react-router-dom';

const welcomeMessage = (name = '') => ({ 
    role: 'ai', 
    text: `Hi${name ? ` ${name}` : ''}! I am your FinWise Guardian AI Coach. I analyze your logged UPI transactions, daily buffer pace, and goal targets to give you actionable advice.` 
});

const AIChatbot = () => {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([welcomeMessage()]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [coachMode, setCoachMode] = useState('friendly');
    const scrollRef = useRef(null);

    useEffect(() => {
        setIsOpen(false); setInput('');
        if (['/login', '/register'].includes(location.pathname)) { setMessages([welcomeMessage()]); return; }
        const token = localStorage.getItem('token');
        axios.get(apiUrl('/api/auth/profile'), { headers: { Authorization: `Bearer ${token}` } })
            .then(({ data }) => setMessages([welcomeMessage(data.name)]))
            .catch(() => setMessages([welcomeMessage()]));
    }, [location.pathname]);

    useEffect(() => { 
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; 
    }, [messages, loading]);

    const handleSendMessage = async () => {
        if (!input.trim() || loading) return;
        const question = input.trim();
        setMessages((current) => [...current, { role: 'user', text: question }]); 
        setInput(''); 
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(apiUrl('/api/ai/chat'), { question, mode: coachMode }, { headers: { Authorization: `Bearer ${token}` } });
            setMessages((current) => [...current, { role: 'ai', text: response.data.answer }]);
        } catch (error) {
            setMessages((current) => [...current, { role: 'ai', text: error.response?.data?.error || 'I could not reach the advisor. Please try again.' }]);
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <div className="ai-chatbot" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                        animate={{ opacity: 1, y: 0, scale: 1 }} 
                        exit={{ opacity: 0, y: 20, scale: 0.95 }} 
                        className="ai-chatbot-window" 
                        style={{ 
                            width: '380px', 
                            height: '520px', 
                            background: '#ffffff', 
                            borderRadius: '24px', 
                            boxShadow: '0 20px 50px rgba(11, 19, 43, 0.25)', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            overflow: 'hidden', 
                            border: '1px solid var(--border)', 
                            marginBottom: '16px' 
                        }}
                    >
                        {/* Header */}
                        <div style={{ background: '#0b132b', color: '#ffffff', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ background: '#4f46e5', padding: '6px', borderRadius: '8px', color: '#ffffff', display: 'flex' }}>
                                    <Sparkles size={16} />
                                </div>
                                <div>
                                    <span style={{ fontSize: '14px', fontWeight: 800, display: 'block', color: '#ffffff' }}>FinWise AI Coach</span>
                                    <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 700 }}>● Active Telemetry Analysis</span>
                                </div>
                            </div>
                            <button aria-label="Close advisor" onClick={() => setIsOpen(false)} style={{ color: '#94a3b8', border: 0, background: 'transparent', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Persona Mode Switcher */}
                        <div style={{ padding: '10px 16px', display: 'flex', gap: '6px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                            {[
                                ['friendly', '😊 Friendly'], 
                                ['serious', '📊 Analytical'], 
                                ['roast', '🔥 Roast Spending']
                            ].map(([value, label]) => (
                                <button 
                                    key={value} 
                                    onClick={() => setCoachMode(value)} 
                                    style={{ 
                                        border: 'none', 
                                        borderRadius: '20px', 
                                        padding: '6px 10px', 
                                        cursor: 'pointer', 
                                        fontSize: '11px', 
                                        background: coachMode === value ? '#0f172a' : '#ffffff', 
                                        color: coachMode === value ? '#ffffff' : 'var(--text-main)', 
                                        fontWeight: 700,
                                        boxShadow: coachMode === value ? '0 2px 6px rgba(0,0,0,0.1)' : 'none'
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Messages Scroll Area */}
                        <div ref={scrollRef} style={{ flex: 1, padding: '18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc' }}>
                            {messages.map((message, index) => (
                                <div 
                                    key={index} 
                                    style={{ 
                                        alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', 
                                        maxWidth: '85%', 
                                        padding: '12px 16px', 
                                        borderRadius: message.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', 
                                        background: message.role === 'user' ? '#0f172a' : '#ffffff', 
                                        color: message.role === 'user' ? '#ffffff' : 'var(--text-main)', 
                                        fontSize: '13px', 
                                        fontWeight: 500, 
                                        lineHeight: 1.5, 
                                        whiteSpace: 'pre-wrap', 
                                        overflowWrap: 'anywhere', 
                                        border: message.role === 'ai' ? '1px solid var(--border)' : 'none',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                                    }}
                                >
                                    {message.text}
                                </div>
                            ))}
                            {loading && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '12px', fontWeight: 600 }}>
                                    <Loader2 size={16} className="animate-spin" /> Analyzing cashflow telemetry...
                                </div>
                            )}
                        </div>

                        {/* Input Box */}
                        <div style={{ padding: '14px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', background: '#ffffff' }}>
                            <input 
                                className="input-wrapper" 
                                style={{ borderRadius: '24px', padding: '10px 16px', fontSize: '13px' }} 
                                placeholder="Ask FinWise AI about your money..." 
                                value={input} 
                                onChange={(event) => setInput(event.target.value)} 
                                onKeyDown={(event) => event.key === 'Enter' && handleSendMessage()} 
                            />
                            <button 
                                aria-label="Send message" 
                                onClick={handleSendMessage} 
                                disabled={loading} 
                                style={{ 
                                    background: '#0f172a', 
                                    border: 'none', 
                                    color: '#ffffff', 
                                    padding: '10px 14px', 
                                    borderRadius: '50%', 
                                    cursor: loading ? 'wait' : 'pointer',
                                    display: 'grid',
                                    placeItems: 'center'
                                }}
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Trigger Button */}
            <motion.button 
                aria-label={isOpen ? 'Close advisor' : 'Open advisor'} 
                whileHover={{ scale: 1.08 }} 
                whileTap={{ scale: 0.95 }} 
                onClick={() => setIsOpen(!isOpen)} 
                style={{ 
                    width: '56px', 
                    height: '56px', 
                    borderRadius: '28px', 
                    background: '#0b132b', 
                    color: '#818cf8', 
                    border: '1px solid rgba(255, 255, 255, 0.15)', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    boxShadow: '0 12px 28px rgba(11, 19, 43, 0.35)' 
                }}
            >
                {isOpen ? <X size={24} color="#ffffff" /> : <Sparkles size={24} fill="#818cf8" color="#818cf8" />}
            </motion.button>
        </div>
    );
};

export default AIChatbot;
