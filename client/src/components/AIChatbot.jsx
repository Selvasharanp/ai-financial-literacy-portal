import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, Send, X, Bot, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR } from '../utils/currency';
import { useLocation } from 'react-router-dom';

const welcomeMessage = (name = '') => ({ role: 'ai', text: `Hi${name ? ` ${name}` : ''}. I use your own transactions to help with budgeting. Add income and expenses first, or ask me about a recorded category.` });

const AIChatbot = () => {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        welcomeMessage()
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        setIsOpen(false);
        setInput('');
        if (location.pathname === '/login' || location.pathname === '/register') {
            setMessages([welcomeMessage()]);
            return;
        }
        const token = localStorage.getItem('token');
        axios.get('http://localhost:5000/api/auth/profile', { headers: { Authorization: `Bearer ${token}` } })
            .then(({ data }) => setMessages([welcomeMessage(data.name)]))
            .catch(() => setMessages([welcomeMessage()]));
    }, [location.pathname]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim()) return;
        
        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput("");
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };

            // Logic: If the message contains "spent" or "bought" or "income", we treat it as an expense log
            const isTransaction = /(spent|bought|received|income|cost|paid|rupees)/i.test(userMsg);

            if (isTransaction) {
                // Use the Voice Parser API (it works for text too!)
                const parseRes = await axios.post('http://localhost:5000/api/ai/parse-voice', { text: userMsg }, config);
                await axios.post('http://localhost:5000/api/transactions', parseRes.data, config);
                setMessages(prev => [...prev, { role: 'ai', text: `Transaction logged: ${parseRes.data.title} for ${formatINR(parseRes.data.amount)} under ${parseRes.data.category}. Anything else?` }]);
            } else {
                // General Chat
                const chatRes = await axios.post('http://localhost:5000/api/ai/chat', { question: userMsg }, config);
                setMessages(prev => [...prev, { role: 'ai', text: chatRes.data.answer }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'ai', text: "Error syncing with core. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ai-chatbot" style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 1000 }}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        style={{ 
                            width: '350px', height: '500px', background: '#fff', borderRadius: '24px', 
                            boxShadow: '0 20px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', 
                            overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '20px'
                        }}
                    >
                        {/* Chat Header */}
                        <div style={{ background: 'var(--text-main)', color: '#fff', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Bot size={20} color="var(--primary)" />
                                <span style={{ fontFamily: 'Orbitron', fontSize: '12px', fontWeight: '800' }}>AI Advisor</span>
                            </div>
                            <X size={20} onClick={() => setIsOpen(false)} style={{ cursor: 'pointer' }} />
                        </div>

                        {/* Messages Area */}
                        <div ref={scrollRef} style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', background: '#f8fafc' }}>
                            {messages.map((m, i) => (
                                <div key={i} style={{ 
                                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                    maxWidth: '80%', padding: '12px 16px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                    background: m.role === 'user' ? 'var(--primary)' : '#fff',
                                    color: m.role === 'user' ? '#000' : 'var(--text-main)',
                                    fontSize: '14px', fontWeight: '500', lineHeight: '1.5', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                    border: m.role === 'ai' ? '1px solid var(--border)' : 'none'
                                }}>
                                    {m.text}
                                </div>
                            ))}
                            {loading && <Loader2 size={18} className="animate-spin" color="var(--primary)" />}
                        </div>

                        {/* Input Area */}
                        <div style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px' }}>
                            <input 
                                className="input-wrapper" 
                                style={{ borderRadius: '30px', padding: '10px 20px' }}
                                placeholder="Type a message..." 
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            />
                            <button onClick={handleSendMessage} style={{ background: 'var(--text-main)', border: 'none', color: '#fff', padding: '10px', borderRadius: '50%', cursor: 'pointer' }}>
                                <Send size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Toggle Button */}
            <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(!isOpen)}
                style={{ 
                    width: '60px', height: '60px', borderRadius: '30px', background: 'var(--text-main)', 
                    color: 'var(--primary)', border: 'none', cursor: 'pointer', display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
                }}
            >
                {isOpen ? <X size={28} /> : <Sparkles size={28} fill="var(--primary)" />}
            </motion.button>
        </div>
    );
};

export default AIChatbot;
