import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { Plus, Mic, Trash2, IndianRupee, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR } from '../utils/currency';

const Transactions = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [formData, setFormData] = useState({ title: '', amount: '', type: 'expense', category: 'General', date: new Date().toISOString().slice(0, 10) });
    const [voiceNotice, setVoiceNotice] = useState('');

    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        const res = await axios.get('http://localhost:5000/api/transactions', config);
        setTransactions(res.data);
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        await axios.post('http://localhost:5000/api/transactions', formData, config);
        setFormData({ title: '', amount: '', type: 'expense', category: 'General', date: new Date().toISOString().slice(0, 10) });
        fetchTransactions();
    };

    const handleDelete = async (id) => {
        await axios.delete(`http://localhost:5000/api/transactions/${id}`, config);
        fetchTransactions();
    };

    // VOICE LOGIC
    const startVoiceEntry = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return alert("Browser not supported");

        const recognition = new SpeechRecognition();
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = async (event) => {
            const text = event.results[0][0].transcript;
            setIsListening(false);
            setLoading(true);
            try {
                // Parse into the form so the user can review before saving.
                const res = await axios.post('http://localhost:5000/api/ai/parse-voice', { text }, config);
                setFormData(current => ({ ...current, ...res.data }));
                setVoiceNotice(`Heard: “${text}”. Review the fields, then save the record.`);
            } catch (err) {
                alert("AI couldn't parse that. Try saying 'Spent 500 on Food'");
            } finally {
                setLoading(false);
            }
        };
        recognition.start();
    };

    return (
        <div style={{ display: 'flex', background: '#f8fafc', minHeight: '100vh' }}>
            <Sidebar />
            <main className="app-main" style={{ marginLeft: '260px', flex: 1, padding: '40px' }}>
                <h1 className="title-main" style={{ marginBottom: '30px' }}>Transactions</h1>

                <div className="ledger-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '30px' }}>
                    {/* Add Transaction Section */}
                    <div className="bento-card" style={{ background: '#fff', height: 'fit-content' }}>
                        <h3 style={{ fontSize: '14px', fontFamily: 'Orbitron', marginBottom: '20px' }}>New Entry</h3>
                        
                        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input className="input-wrapper" placeholder="Description" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
                            <input className="input-wrapper" type="number" min="0.01" step="0.01" placeholder="Amount (₹)" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
                            <select className="input-wrapper" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                <option>General</option>
                                <option>Food</option>
                                <option>Shopping</option>
                                <option>Rent</option>
                                <option>Transport</option>
                                <option>Savings</option>
                            </select>
                            <input className="input-wrapper" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                            {voiceNotice && <p style={{ fontSize: '12px', color: '#059669' }}>{voiceNotice}</p>}
                            <button type="submit" className="btn-action">Save Record <Plus size={18}/></button>
                        </form>

                        <div style={{ margin: '20px 0', textAlign: 'center', color: '#cbd5e1' }}>— OR USE AI VOICE —</div>

                        <button 
                            onClick={startVoiceEntry}
                            style={{ 
                                width: '100%', padding: '20px', borderRadius: '15px', border: isListening ? '2px solid #EAB308' : '1px solid #e2e8f0',
                                background: isListening ? 'rgba(234, 179, 8, 0.1)' : '#fff', cursor: 'pointer', transition: '0.3s',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
                            }}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Mic size={24} color={isListening ? "#EAB308" : "#64748b"} />}
                            <span style={{ fontSize: '12px', fontWeight: '700', color: isListening ? '#EAB308' : '#64748b' }}>
                                {isListening ? "LISTENING..." : "TAP TO SPEAK EXPENSE"}
                            </span>
                        </button>
                    </div>

                    {/* Transaction History Section */}
                    <div className="bento-card" style={{ background: '#fff' }}>
                        <h3 style={{ fontSize: '14px', fontFamily: 'Orbitron', marginBottom: '20px' }}>Transaction History</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {transactions.map(t => (
                                <motion.div 
                                    layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    key={t._id} 
                                    style={{ 
                                        padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9', background: '#fdfdfd',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{t.title}</div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>{t.category} • {new Date(t.date).toLocaleDateString()}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ fontWeight: '800', color: t.type === 'income' ? '#10b981' : '#ef4444' }}>
                                            {t.type === 'income' ? '+' : '-'} {formatINR(t.amount)}
                                        </div>
                                        <Trash2 size={16} color="#cbd5e1" cursor="pointer" onClick={() => handleDelete(t._id)} />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Transactions;
