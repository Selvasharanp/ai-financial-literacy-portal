import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { Target, Plus, Flag, Trash2, Coins, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatINR } from '../utils/currency';

const Goals = () => {
    const [goals, setGoals] = useState([]);
    const [newGoal, setNewGoal] = useState({ targetName: '', targetAmount: '', deadline: '' });
    const [addAmount, setAddAmount] = useState({}); // To track input for each goal

    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => { fetchGoals(); }, []);

    const fetchGoals = async () => {
        const res = await axios.get('http://localhost:5000/api/goals', config);
        setGoals(res.data);
    };

    const handleAddGoal = async (e) => {
        e.preventDefault();
        await axios.post('http://localhost:5000/api/goals', newGoal, config);
        setNewGoal({ targetName: '', targetAmount: '', deadline: '' });
        fetchGoals();
    };

    const handleUpdateProgress = async (id, amount) => {
        if (!amount) return;
        await axios.put(`http://localhost:5000/api/goals/${id}`, { amount: Number(amount) }, config);
        setAddAmount({ ...addAmount, [id]: '' });
        fetchGoals();
    };

    const handleDelete = async (id) => {
        await axios.delete(`http://localhost:5000/api/goals/${id}`, config);
        fetchGoals();
    };

    return (
        <div style={{ display: 'flex', background: '#f8fafc', minHeight: '100vh' }}>
            <Sidebar />
            <main className="app-main" style={{ marginLeft: '260px', flex: 1, padding: '40px' }}>
                
                <header style={{ marginBottom: '40px' }}>
                    <h1 className="title-main" style={{ fontSize: '32px' }}>Savings Goals</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Define your financial milestones and track progress in real-time.</p>
                </header>

                <div className="goals-layout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
                    
                    {/* Left: Add Goal Form */}
                    <div className="bento-card" style={{ background: '#fff', height: 'fit-content' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px' }}>
                            <Target size={20} color="var(--primary)" />
                            <h3 style={{ fontSize: '14px', fontFamily: 'Orbitron' }}>New Goal</h3>
                        </div>
                        <form onSubmit={handleAddGoal} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input className="input-wrapper" placeholder="Goal Name (e.g. Emergency Fund)" value={newGoal.targetName} onChange={e => setNewGoal({...newGoal, targetName: e.target.value})} required />
                            <input className="input-wrapper" type="number" min="1" placeholder="Target Amount (₹)" value={newGoal.targetAmount} onChange={e => setNewGoal({...newGoal, targetAmount: e.target.value})} required />
                            <input className="input-wrapper" type="date" value={newGoal.deadline} onChange={e => setNewGoal({...newGoal, deadline: e.target.value})} />
                            <button type="submit" className="btn-action">Create Goal <Plus size={18} /></button>
                        </form>
                    </div>

                    {/* Right: Goals Grid */}
                    <div className="goals-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {goals.map((goal) => {
                            const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                            return (
                                <motion.div layout key={goal._id} className="bento-card" style={{ background: '#fff', padding: '25px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                        <h4 style={{ fontWeight: '700', fontSize: '18px' }}>{goal.targetName}</h4>
                                        <Trash2 size={16} color="#cbd5e1" cursor="pointer" onClick={() => handleDelete(goal._id)} />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>PROGRESS</span>
                                        <span style={{ color: 'var(--text-main)' }}>{progress.toFixed(0)}%</span>
                                    </div>

                                    {/* Progress Bar Container */}
                                    <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            style={{ height: '100%', background: 'var(--primary)' }}
                                        />
                                    </div>

                                    <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '20px' }}>
                                        {formatINR(goal.currentAmount)} <span style={{ color: '#94a3b8', fontWeight: '400' }}>/ {formatINR(goal.targetAmount)}</span>
                                    </div>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-12px', marginBottom: '16px' }}>
                                        {formatINR(Math.max(goal.targetAmount - goal.currentAmount, 0))} remaining{goal.deadline ? ` • ${Math.max(0, Math.ceil((new Date(goal.deadline) - new Date()) / 86400000))} days left` : ''}
                                    </p>

                                    {/* Update Progress Input */}
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input 
                                            type="number" 
                                            className="input-wrapper" 
                                            style={{ padding: '8px', fontSize: '12px' }} 
                                            placeholder="+ Add ₹" 
                                            value={addAmount[goal._id] || ''}
                                            onChange={(e) => setAddAmount({...addAmount, [goal._id]: e.target.value})}
                                        />
                                        <button 
                                            onClick={() => handleUpdateProgress(goal._id, addAmount[goal._id])}
                                            style={{ background: 'var(--text-main)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0 15px', cursor: 'pointer' }}
                                        >
                                            <TrendingUp size={16} />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Goals;
