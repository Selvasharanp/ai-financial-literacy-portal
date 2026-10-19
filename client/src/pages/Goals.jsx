import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, PlusCircle, IndianRupee, ArrowUpRight, ArrowDownLeft, 
  Sparkles, ShieldAlert, CheckCircle2, Trash2, Calendar, AlertCircle, RefreshCw
} from 'lucide-react';
import axios from 'axios';
import { apiUrl, authConfig } from '../utils/api';
import { formatINR } from '../utils/currency';
import { useNotification } from '../context/NotificationContext';

export default function Goals() {
  const { showToast, confirmModal } = useNotification();
  const [profile, setProfile] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New Goal Form
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [creating, setCreating] = useState(false);

  // Allocation & Withdrawal Form State
  const [allocationInputs, setAllocationInputs] = useState({});
  const [withdrawInputs, setWithdrawInputs] = useState({});
  const [submittingId, setSubmittingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const config = authConfig();
      const [profileRes, goalsRes] = await Promise.all([
        axios.get(apiUrl('/api/auth/profile'), config),
        axios.get(apiUrl('/api/goals'), config)
      ]);
      setProfile(profileRes.data);
      setGoals(goalsRes.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load goals telemetry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener('transactions-changed', loadData);
    return () => window.removeEventListener('transactions-changed', loadData);
  }, [loadData]);

  // Create Goal
  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please provide a goal name.', 'error');
      return;
    }
    const amt = Number(targetAmount);
    if (!amt || amt <= 0) {
      showToast('Target amount must be a positive number.', 'error');
      return;
    }

    setCreating(true);
    try {
      await axios.post(apiUrl('/api/goals'), {
        name: name.trim(),
        targetName: name.trim(),
        targetAmount: amt,
        deadline: deadline || null
      }, authConfig());

      setName('');
      setTargetAmount('');
      setDeadline('');
      showToast(`Goal pot "${name.trim()}" created successfully.`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to create goal.', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Allocate Funds
  const handleAllocate = async (goal) => {
    const amt = Number(allocationInputs[goal._id]);
    if (!amt || amt <= 0) {
      showToast('Please enter a positive allocation amount.', 'error');
      return;
    }

    setSubmittingId(goal._id);
    try {
      await axios.post(apiUrl(`/api/goals/${goal._id}/allocate`), { amount: amt }, authConfig());
      setAllocationInputs(prev => ({ ...prev, [goal._id]: '' }));
      showToast(`Allocated ${formatINR(amt)} to "${goal.name || goal.targetName}".`, 'success');
      window.dispatchEvent(new Event('transactions-changed'));
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to allocate funds.', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  // Emergency Withdraw Funds
  const handleEmergencyWithdraw = async (goal) => {
    const amt = Number(withdrawInputs[goal._id]);
    if (!amt || amt <= 0) {
      showToast('Please enter a positive withdrawal amount.', 'error');
      return;
    }
    const availableGoalBalance = goal.currentAmount || 0;
    if (amt > availableGoalBalance) {
      showToast(`Withdrawal amount (${formatINR(amt)}) cannot exceed available goal balance (${formatINR(availableGoalBalance)}).`, 'error');
      return;
    }

    const confirmed = await confirmModal({
      title: 'Emergency Withdrawal',
      message: `Withdraw ${formatINR(amt)} from "${goal.name || goal.targetName}" back into your Available Safe Balance?`,
      confirmText: 'Withdraw to Safe Balance',
      cancelText: 'Keep Saved',
      isDestructive: false
    });
    if (!confirmed) return;
    
    setSubmittingId(goal._id);
    try {
      const res = await axios.post(apiUrl(`/api/goals/${goal._id}/emergency-withdraw`), { amount: amt }, authConfig());
      setWithdrawInputs(prev => ({ ...prev, [goal._id]: '' }));
      showToast(res.data?.msg || `Successfully withdrew ${formatINR(amt)} to Available Safe Balance.`, 'success');
      window.dispatchEvent(new Event('transactions-changed'));
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to withdraw funds.', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  // Delete Goal
  const handleDeleteGoal = async (goal) => {
    const confirmed = await confirmModal({
      title: 'Delete Goal Pot',
      message: `Delete goal pot "${goal.name || goal.targetName}"? Any saved funds will remain in your overall balance.`,
      confirmText: 'Delete Pot',
      cancelText: 'Cancel',
      isDestructive: true
    });
    if (!confirmed) return;

    try {
      await axios.delete(apiUrl(`/api/goals/${goal._id}`), authConfig());
      showToast(`Goal pot "${goal.name || goal.targetName}" removed.`, 'success');
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to delete goal.', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', background: 'var(--bg-main)', minHeight: '100vh' }}>
      <Sidebar />

      <main className="app-main">
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={{ fontSize: '30px', margin: 0 }}>
              Future Goals & Savings Pots
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '2px' }}>
              Divert daily cashflow surpluses into dedicated goal pots without affecting your baseline expenses.
            </p>
          </div>
        </header>

        {error && (
          <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', color: '#dc2626', fontSize: '14px', marginBottom: '24px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* CREATE GOAL & ACTIVE POTS GRID */}
        <div className="goals-layout-grid">
          
          {/* Left: Create Goal Form */}
          <div className="bento-card" style={{ background: '#ffffff', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '10px', color: 'var(--primary)' }}>
                <PlusCircle size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Create Goal Pot</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Define target amount and deadline</span>
              </div>
            </div>

            <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="goal-name-input" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>Goal Name</label>
                <input 
                  id="goal-name-input"
                  type="text" 
                  className="input-wrapper" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                  aria-label="Goal Name"
                />
              </div>

              <div>
                <label htmlFor="target-amount-input" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>Target Amount (INR ₹)</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    id="target-amount-input"
                    type="number" 
                    className="input-wrapper" 
                    value={targetAmount} 
                    onChange={(e) => setTargetAmount(e.target.value)} 
                    required 
                    min="1"
                    style={{ paddingLeft: '34px', fontSize: '15px', fontWeight: 700 }}
                    aria-label="Target Amount in INR"
                  />
                  <IndianRupee size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>Target Date / Deadline (Optional)</label>
                <input 
                  type="date" 
                  className="input-wrapper" 
                  value={deadline} 
                  onChange={(e) => setDeadline(e.target.value)} 
                />
              </div>

              <button type="submit" className="btn-action" disabled={creating} style={{ width: '100%', padding: '14px', marginTop: '6px' }}>
                {creating ? 'Creating Pot...' : 'Initialize Goal Pot'}
              </button>
            </form>

            <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Sparkles size={18} color="var(--primary)" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Allocating funds to goals reserves money from your safe balance while preserving overall net worth.
              </span>
            </div>
          </div>

          {/* Right: Goals Summary Overview */}
          <div className="dark-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span className="stitch-badge badge-dark" style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#E5C690', marginBottom: '16px' }}>
                <Target size={13} /> GOAL DIVERSION TELEMETRY
              </span>

              <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', marginBottom: '10px' }}>
                Active Goal Runway
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
                You have {goals.length} active wealth pots. Daily canteen and transit savings are automatically tracked against your highest priority target.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total Goal Target</span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                    {formatINR(goals.reduce((acc, g) => acc + g.targetAmount, 0))}
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total Funds Saved</span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                    {formatINR(goals.reduce((acc, g) => acc + (g.currentAmount || 0), 0))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '14px 18px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>🛡️ Emergency Withdraw Ready</span>
              <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700 }}>Instant liquidity restore</span>
            </div>
          </div>

        </div>

        {/* ACTIVE GOALS CARDS LIST */}
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px' }}>Active Goal Pots List</h2>

        {loading ? (
          <p>Loading your goal pots...</p>
        ) : goals.length === 0 ? (
          <div className="bento-card" style={{ padding: '40px', textAlign: 'center', background: '#ffffff' }}>
            <Target size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 800 }}>No active goal pots yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '400px', margin: '6px auto 0' }}>
              Use the form above to initialize your first savings goal pot (e.g. Laptop Fund, Emergency Cushion, or Tuition deposit).
            </p>
          </div>
        ) : (
          <div className="goals-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '24px' }}>
            {goals.map((goal) => {
              const pct = Math.min(100, Math.round(((goal.currentAmount || 0) / goal.targetAmount) * 100));

              return (
                <motion.div key={goal._id} className="bento-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    {/* Goal Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                      <div>
                        <span className="stitch-badge badge-blue" style={{ marginBottom: '6px' }}>SAVINGS POT</span>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: '4px 0' }}>
                          {goal.name || goal.targetName}
                        </h3>
                      </div>
                      <button 
                        onClick={() => handleDeleteGoal(goal)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        title="Delete Goal Pot"
                        aria-label="Delete Goal Pot"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    {/* Progress Percentage & Amounts */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                      <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>
                        {formatINR(goal.currentAmount || 0)}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Target: {formatINR(goal.targetAmount)} ({pct}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ height: '10px', width: '100%', background: 'var(--bg-subtle)', borderRadius: '6px', overflow: 'hidden', marginBottom: '18px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #183630 0%, #2e5a44 60%, #E5C690 100%)', borderRadius: '6px', transition: 'width 0.4s ease' }}></div>
                    </div>

                    {goal.deadline && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '18px' }}>
                        <Calendar size={14} /> Target Deadline: <strong>{new Date(goal.deadline).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</strong>
                      </div>
                    )}
                  </div>

                  {/* Allocate & Withdraw Actions */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {/* Allocate Funds Form */}
                    <div>
                      <label htmlFor={`allocate-amt-${goal._id}`} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                        + Allocate from Available Safe Balance
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          id={`allocate-amt-${goal._id}`}
                          type="number" 
                          className="input-wrapper" 
                          value={allocationInputs[goal._id] || ''} 
                          onChange={(e) => setAllocationInputs({ ...allocationInputs, [goal._id]: e.target.value })} 
                          min="1"
                          style={{ height: '38px', fontSize: '13px' }}
                          aria-label="Allocate amount in INR"
                        />
                        <button 
                          onClick={() => handleAllocate(goal)}
                          className="btn-action" 
                          disabled={submittingId === goal._id}
                          style={{ padding: '0 14px', height: '38px', fontSize: '12px', flexShrink: 0 }}
                        >
                          {submittingId === goal._id ? 'Allocating...' : 'Allocate'}
                        </button>
                      </div>
                    </div>

                    {/* Emergency Withdraw Form */}
                    <div>
                      <label htmlFor={`withdraw-amt-${goal._id}`} style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                        ⚡ Emergency Withdraw to Safe Balance
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          id={`withdraw-amt-${goal._id}`}
                          type="number" 
                          className="input-wrapper" 
                          value={withdrawInputs[goal._id] || ''} 
                          onChange={(e) => setWithdrawInputs({ ...withdrawInputs, [goal._id]: e.target.value })} 
                          min="1"
                          style={{ height: '38px', fontSize: '13px', borderColor: '#fde047' }}
                          aria-label="Withdraw amount in INR"
                        />
                        <button 
                          onClick={() => handleEmergencyWithdraw(goal)}
                          className="btn-secondary" 
                          disabled={submittingId === goal._id}
                          style={{ padding: '0 14px', height: '38px', fontSize: '12px', color: '#b45309', borderColor: '#fde047', background: '#fffbeb', flexShrink: 0 }}
                        >
                          {submittingId === goal._id ? 'Withdrawing...' : 'Withdraw'}
                        </button>
                      </div>
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
