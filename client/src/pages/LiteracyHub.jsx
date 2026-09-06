import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { motion } from 'framer-motion';
import { GraduationCap, Sparkles, BookOpen, ArrowUpRight, Zap } from 'lucide-react';

const LiteracyHub = () => {
    const [recommended, setRecommended] = useState([]);
    const [allContent, setAllContent] = useState([]);
    const [issue, setIssue] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const config = { headers: { Authorization: `Bearer ${token}` } };
                
                const [recRes, allRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/literacy/recommended', config),
                    axios.get('http://localhost:5000/api/literacy/all', config)
                ]);

                setRecommended(recRes.data.recommendations || []);
                setIssue(recRes.data.detectedIssue || "Global Baseline");
                setAllContent(allRes.data);
            } catch (err) {
                console.error("Literacy Hub Error", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    return (
        <div style={{ display: 'flex', background: '#f8fafc', minHeight: '100vh' }}>
            <Sidebar />
            <main className="app-main" style={{ marginLeft: '260px', flex: 1, padding: '40px' }}>
                
                {/* Hero Header */}
                <header style={{ marginBottom: '50px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '10px' }}>
                        <GraduationCap size={20} />
                        <span style={{ fontFamily: 'Orbitron', fontSize: '12px', fontWeight: '800', letterSpacing: '2px' }}>Knowledge Resources</span>
                    </div>
                    <h1 className="title-main" style={{ fontSize: '36px' }}>Literacy Hub</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Personalized financial intelligence matched to your spending behavior.</p>
                </header>

                {/* AI Recommendation Section (The Highlight) */}
                <section style={{ marginBottom: '60px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Smart Recommendations</h2>
                        <div style={{ padding: '4px 12px', background: 'var(--text-main)', color: '#fff', borderRadius: '20px', fontSize: '10px', fontFamily: 'Orbitron' }}>
                           Matched: {issue}
                        </div>
                    </div>

                    <div className="literacy-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' }}>
                        {recommended.map((item, index) => (
                            <motion.div 
                                whileHover={{ y: -10 }}
                                key={index} 
                                className="bento-card" 
                                style={{ background: '#fff', borderLeft: '4px solid var(--primary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                            >
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--primary)', fontFamily: 'Orbitron' }}>{item.category.toUpperCase()}</span>
                                        <Zap size={14} color="var(--primary)" fill="var(--primary)" />
                                    </div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', lineHeight: '1.3' }}>{item.title}</h3>
                                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>{item.content.substring(0, 100)}...</p>
                                </div>
                                <button style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                    READ BRIEFING <ArrowUpRight size={16} />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* All Resources Section */}
                <section>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '25px' }}>Global Library</h2>
                    <div className="library-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {allContent.map((item, index) => (
                            <div key={index} style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '20px', alignItems: 'center' }}>
                                <div style={{ background: 'var(--bg-subtle)', padding: '15px', borderRadius: '12px' }}>
                                    <BookOpen size={20} color="var(--text-muted)" />
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>{item.title}</h4>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>{item.difficulty} Level</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default LiteracyHub;
