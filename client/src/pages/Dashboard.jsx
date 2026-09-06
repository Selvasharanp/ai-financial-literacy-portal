import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, BrainCircuit, Plus, X, AlertTriangle, MapPin } from 'lucide-react';
import { formatINR } from '../utils/currency';

const apiBase = 'http://localhost:5000/api';
const today = () => new Date().toISOString().slice(0, 10);

const Dashboard = () => {
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpenses: 0, balance: 0 });
  const [transactions, setTransactions] = useState([]);
  const [insights, setInsights] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [benchmark, setBenchmark] = useState(null);
  const [entryType, setEntryType] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ title: '', amount: '', category: 'General', date: today() });
  const config = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const fetchData = useCallback(async () => {
    try {
      const [sumRes, transRes, aiRes, profileRes, benchmarkRes] = await Promise.all([
        axios.get(`${apiBase}/transactions/summary`, config()),
        axios.get(`${apiBase}/transactions`, config()),
        axios.get(`${apiBase}/ai/insights`, config()),
        axios.get(`${apiBase}/auth/profile`, config()),
        axios.get(`${apiBase}/ai/benchmark`, config()),
      ]);
      setSummary(sumRes.data);
      setTransactions(transRes.data);
      setInsights(aiRes.data.insights);
      setAlerts(aiRes.data.alerts || []);
      setProfile(profileRes.data);
      setBenchmark(benchmarkRes.data);
    } catch (requestError) {
      console.error('Unable to load dashboard data:', requestError);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openEntry = (type) => {
    setError('');
    setEntryType(type);
    setFormData({ title: '', amount: '', category: type === 'income' ? 'Salary' : 'General', date: today() });
  };

  const handleAddTransaction = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      await axios.post(`${apiBase}/transactions`, { ...formData, type: entryType }, config());
      await fetchData();
      setEntryType(null);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to save this transaction. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return <div style={{ display: 'flex', background: 'var(--bg-subtle)', minHeight: '100vh' }}>
    <Sidebar />
    <main className="app-main dashboard-main" style={{ marginLeft: '260px', flex: 1, padding: '40px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', gap: '20px', flexWrap: 'wrap' }}>
        <div><h1 className="title-main" style={{ fontSize: '28px' }}>Welcome{profile?.name ? `, ${profile.name}` : ''}</h1><p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>A real-time view of your financial ecosystem.</p></div>
        <div className="dashboard-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-action" onClick={() => openEntry('income')} style={{ padding: '10px 16px', background: '#10b981' }}><Plus size={16} /> ADD INCOME</button>
          <button className="btn-action" onClick={() => openEntry('expense')} style={{ padding: '10px 16px' }}><Plus size={16} /> ADD EXPENSE</button>
          <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '10px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: '700' }}>STATUS: <span style={{ color: '#10b981' }}>SYNCED</span></div>
        </div>
      </div>
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '30px' }}>
        <StatCard label="AVAILABLE BALANCE" value={formatINR(summary.balance)} icon={<Wallet color="var(--primary)" />} />
        <StatCard label="TOTAL INCOME" value={formatINR(summary.totalIncome)} icon={<TrendingUp color="#10b981" />} />
        <StatCard label="TOTAL EXPENSES" value={formatINR(summary.totalExpenses)} icon={<TrendingDown color="#ef4444" />} />
      </div>
      <div className="dashboard-content-grid" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px' }}>
        <div className="bento-card" style={{ height: '400px', background: '#fff' }}>
          <h3 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', fontWeight: '700', fontFamily: 'Orbitron' }}>Recent Transaction Trend</h3>
          <ResponsiveContainer width="100%" height="85%"><AreaChart data={transactions.slice(0, 10).reverse()}><defs><linearGradient id="colorValue" x1="0" y1="0" x2="1"><stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2}/><stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/></linearGradient></defs><Tooltip formatter={(value) => formatINR(value)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }} /><Area type="monotone" dataKey="amount" stroke="var(--primary)" strokeWidth={3} fill="url(#colorValue)" /></AreaChart></ResponsiveContainer>
        </div>
        <div className="bento-card" style={{ background: 'var(--text-main)', color: '#fff' }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}><div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '10px' }}><BrainCircuit size={24} color="var(--primary)" /></div><h3 style={{ fontSize: '15px', fontFamily: 'Orbitron', letterSpacing: '1px' }}>AI Advisor</h3></div><p style={{ fontSize: '15px', color: '#cbd5e1', lineHeight: '1.7', fontWeight: '400' }}>{insights || 'Calculating financial trajectory...'}</p></div>
      </div>
      <div className="dashboard-lower-grid" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '24px', marginTop: '24px' }}>
        <div className="bento-card" style={{ background: '#fff', padding: '24px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}><AlertTriangle size={18} color="var(--primary)" /><h3 style={{ fontFamily: 'Orbitron', fontSize: '13px' }}>AI Insights</h3></div>{alerts.length ? alerts.map(alert => <p key={`${alert.type}-${alert.category}`} style={{ color: 'var(--text-muted)', marginTop: '8px' }}>• {alert.title}</p>) : <p style={{ color: 'var(--text-muted)' }}>No unusual spending patterns detected yet.</p>}</div>
        <div className="bento-card" style={{ background: '#fff', padding: '24px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}><MapPin size={18} color="var(--primary)" /><h3 style={{ fontFamily: 'Orbitron', fontSize: '13px' }}>Regional Budget</h3></div><p style={{ fontSize: '20px', fontWeight: 700 }}>{benchmark ? formatINR(benchmark.adjustedBudgetLimit) : '—'} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ month</span></p><p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>{benchmark?.comparison || 'Set your city in Profile to personalise this.'}</p></div>
      </div>
    </main>
    {entryType && <TransactionModal type={entryType} formData={formData} setFormData={setFormData} onClose={() => setEntryType(null)} onSubmit={handleAddTransaction} isSaving={isSaving} error={error} />}
  </div>;
};

const StatCard = ({ label, value, icon }) => <div className="bento-card" style={{ background: '#fff' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}><span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>{label}</span>{icon}</div><div style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-1px' }}>{value}</div></div>;

const TransactionModal = ({ type, formData, setFormData, onClose, onSubmit, isSaving, error }) => {
  const categories = type === 'income' ? ['Salary', 'Freelance', 'Business', 'Investment', 'Gift', 'Other'] : ['General', 'Food', 'Rent', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment'];
  return <div role="presentation" onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(15, 23, 42, 0.45)', display: 'grid', placeItems: 'center', padding: '20px' }}><div role="dialog" aria-modal="true" aria-labelledby="transaction-dialog-title" onMouseDown={(event) => event.stopPropagation()} className="bento-card" style={{ width: 'min(100%, 470px)', background: '#fff', padding: '30px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}><h2 id="transaction-dialog-title" className="title-main" style={{ fontSize: '20px' }}>ADD {type.toUpperCase()}</h2><button aria-label="Close" onClick={onClose} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}><X /></button></div><form onSubmit={onSubmit} style={{ display: 'grid', gap: '14px' }}><input className="input-wrapper" placeholder="Description" value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} required /><input className="input-wrapper" type="number" min="0.01" step="0.01" placeholder="Amount (₹)" value={formData.amount} onChange={(event) => setFormData({ ...formData, amount: event.target.value })} required /><select className="input-wrapper" value={formData.category} onChange={(event) => setFormData({ ...formData, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select><input className="input-wrapper" type="date" value={formData.date} onChange={(event) => setFormData({ ...formData, date: event.target.value })} required />{error && <p style={{ color: '#dc2626', fontSize: '13px' }}>{error}</p>}<button className="btn-action" type="submit" disabled={isSaving} style={{ opacity: isSaving ? 0.7 : 1 }}>{isSaving ? 'SAVING...' : `SAVE ${type.toUpperCase()}`}</button></form></div></div>;
};

export default Dashboard;
