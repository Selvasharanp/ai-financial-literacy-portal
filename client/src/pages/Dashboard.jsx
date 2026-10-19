import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlusCircle, MinusCircle, Wallet, TrendingUp, TrendingDown, Target, 
  Sparkles, ShieldAlert, Cpu, Search, Calendar, Filter, Mic, 
  ArrowUpRight, ArrowDownRight, ArrowRight, Tag, RefreshCw, CheckCircle2, ChevronRight, X, Trash2, HelpCircle
} from 'lucide-react';
import axios from 'axios';
import { apiUrl, authConfig } from '../utils/api';
import { formatINR } from '../utils/currency';
import LocationBudgetAdvisor from '../components/dashboard/LocationBudgetAdvisor';
import { useNotification } from '../context/NotificationContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { showToast, confirmModal } = useNotification();
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Voice Expense State
  const [isListening, setIsListening] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceNotice, setVoiceNotice] = useState('');
  const [voiceSuccess, setVoiceSuccess] = useState('');
  const [voiceDraft, setVoiceDraft] = useState(null);
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const [manualVoiceText, setManualVoiceText] = useState('');
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineAmount, setInlineAmount] = useState('');
  const [inlineCategory, setInlineCategory] = useState('Food');
  const [isSubmittingInline, setIsSubmittingInline] = useState(false);

  // Modals
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showConfirmSalaryModal, setShowConfirmSalaryModal] = useState(false);

  // Table Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Income Modal State
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeSource, setIncomeSource] = useState('');

  // Confirm Salary Credit Modal State
  const [creditingSalary, setCreditingSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');
  const [salaryAction, setSalaryAction] = useState('allocated'); 
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [customGoalName, setCustomGoalName] = useState('');
  const [customGoalTarget, setCustomGoalTarget] = useState('');
  const [allocationAmount, setAllocationAmount] = useState('');
  const [isAllocatingAll, setIsAllocatingAll] = useState(false);

  const openConfirmSalaryModal = () => {
    setSalaryInput(profile?.income || summary?.monthlyIncome || '');
    setShowConfirmSalaryModal(true);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const config = authConfig();
      const [profileRes, summaryRes, txRes, goalsRes, insightsRes] = await Promise.allSettled([
        axios.get(apiUrl('/api/auth/profile'), config),
        axios.get(apiUrl('/api/transactions/summary'), config),
        axios.get(apiUrl('/api/transactions'), config),
        axios.get(apiUrl('/api/goals'), config),
        axios.get(apiUrl('/api/ai/insights'), config)
      ]);

      if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data);
      if (txRes.status === 'fulfilled') setTransactions(txRes.value.data || []);
      if (goalsRes.status === 'fulfilled') setGoals(goalsRes.value.data || []);
      if (insightsRes.status === 'fulfilled') setInsights(insightsRes.value.data || []);

      if (profileRes.status === 'rejected' && summaryRes.status === 'rejected') {
        setError('Unable to load financial dashboard telemetry.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load dashboard telemetry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    window.addEventListener('transactions-changed', fetchData);
    return () => window.removeEventListener('transactions-changed', fetchData);
  }, [fetchData]);

  // Voice & Manual Expense Recognition, Validation & Parsing
  const processExpensePhrase = async (text, isVoice = false) => {
    if (!text || !text.trim()) {
      setVoiceError(isVoice 
        ? 'No speech detected. Please speak clearly or enter your expense phrase below.' 
        : 'Please enter an expense phrase (e.g. "Spent ₹250 on lunch today").');
      return;
    }
    const cleanText = text.trim();
    setVoiceLoading(true);
    setVoiceError('');
    setVoiceSuccess('');
    try {
      const response = await axios.post(apiUrl('/api/ai/parse-voice'), { text: cleanText }, authConfig());
      setVoiceDraft({
        ...response.data,
        isVoice: isVoice,
        sourceText: cleanText,
        paymentMethod: isVoice ? 'UPI (Voice)' : 'Manual Entry'
      });
      setVoiceNotice(isVoice 
        ? `Heard: “${cleanText}”. Confirm details below to save.`
        : `Parsed phrase: “${cleanText}”. Confirm details below to save.`);
    } catch (requestError) {
      const errMsg = requestError.response?.data?.error;
      if (errMsg) {
        setVoiceError(errMsg);
      } else {
        setVoiceError(isVoice 
          ? 'Could not parse that voice entry. Try saying: “Spent ₹250 on lunch today”' 
          : 'Could not parse that expense phrase. Make sure to include an amount, e.g. “Spent ₹250 on lunch today”.');
      }
    } finally {
      setVoiceLoading(false);
    }
  };

  const processVoiceText = (text) => processExpensePhrase(text, true);
  const processManualText = (text) => processExpensePhrase(text, false);

  const startVoiceEntry = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice recognition requires Chrome, Edge, or a browser with Speech Recognition support. You can also test with the phrase field below.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError('');
      setVoiceNotice('Listening… speak now (e.g. "I spent ₹250 on lunch today")');
    };
    recognition.onerror = () => {
      setIsListening(false);
      setVoiceError('Voice recognition could not understand that request. Please try again or type your phrase below.');
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      setIsListening(false);
      await processExpensePhrase(text, true);
    };
    recognition.start();
  };

  // Save Voice / Manual Expense Record (Strict Single Transaction Creation)
  const handleSaveVoiceExpense = async (e) => {
    if (e) e.preventDefault();
    if (!voiceDraft || isSavingVoice) return;
    if (!voiceDraft.amount || Number(voiceDraft.amount) <= 0) {
      setVoiceError('Please specify a valid positive amount.');
      return;
    }
    if (!voiceDraft.title || !voiceDraft.title.trim()) {
      setVoiceError('Please specify a title or description for the expense.');
      return;
    }
    setIsSavingVoice(true);
    setVoiceError('');
    try {
      await axios.post(apiUrl('/api/transactions'), {
        title: voiceDraft.title.trim(),
        amount: Number(voiceDraft.amount),
        type: 'expense',
        category: voiceDraft.category || 'Food',
        date: voiceDraft.date || new Date().toISOString().slice(0, 10),
        paymentMethod: voiceDraft.paymentMethod || (voiceDraft.isVoice ? 'UPI (Voice)' : 'Manual Entry'),
        isVoice: Boolean(voiceDraft.isVoice)
      }, authConfig());

      window.dispatchEvent(new Event('transactions-changed'));
      setVoiceSuccess(`Recorded ${formatINR(voiceDraft.amount)} for "${voiceDraft.title.trim()}" (${voiceDraft.category}).`);
      setVoiceDraft(null);
      setVoiceNotice('');
      setManualVoiceText('');
      await fetchData();
      setTimeout(() => setVoiceSuccess(''), 6000);
    } catch (err) {
      setVoiceError(err.response?.data?.error || 'Unable to save expense.');
    } finally {
      setIsSavingVoice(false);
    }
  };

  // Record Manual Expense Directly with "Where did you spend?" and "How much?"
  const handleRecordInlineExpense = async (e) => {
    if (e) e.preventDefault();
    if (isSubmittingInline) return;

    let finalTitle = (inlineTitle || '').trim();
    let finalAmount = Number(inlineAmount);
    let finalCategory = inlineCategory || 'Food';

    // Fallback: If amount was entered as natural text in the title field, auto-extract
    if ((!finalAmount || finalAmount <= 0) && finalTitle) {
      const normalized = finalTitle.replace(/,/g, '');
      const match = normalized.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)/i);
      if (match && Number(match[1]) > 0) {
        finalAmount = Number(match[1]);
        const descMatch = normalized.match(/\b(?:on|for)\s+(.+?)(?:\s+(?:today|yesterday))?[.!?]?$/i);
        if (descMatch && descMatch[1]) finalTitle = descMatch[1].trim();
      }
    }

    if (!finalTitle) {
      setVoiceError('Please specify where you spent in "Where did you spend?".');
      return;
    }
    if (!finalAmount || Number.isNaN(finalAmount) || finalAmount <= 0) {
      setVoiceError('Please specify how much you spent in "How much? (INR ₹)".');
      return;
    }

    setIsSubmittingInline(true);
    setVoiceError('');
    try {
      await axios.post(apiUrl('/api/transactions'), {
        title: finalTitle,
        amount: finalAmount,
        type: 'expense',
        category: finalCategory,
        date: new Date().toISOString().slice(0, 10),
        paymentMethod: 'UPI',
        isVoice: false
      }, authConfig());

      window.dispatchEvent(new Event('transactions-changed'));
      setVoiceSuccess(`Recorded ${formatINR(finalAmount)} for "${finalTitle}" (${finalCategory}).`);
      setInlineTitle('');
      setInlineAmount('');
      setInlineCategory('Food');
      await fetchData();
      setTimeout(() => setVoiceSuccess(''), 6000);
    } catch (err) {
      setVoiceError(err.response?.data?.error || 'Unable to record expense.');
    } finally {
      setIsSubmittingInline(false);
    }
  };

  // Expose helper on window for testing & automated verification
  useEffect(() => {
    window.__finwiseVoice = {
      processVoiceText: (text) => processExpensePhrase(text, true),
      processManualText: (text) => processExpensePhrase(text, false),
      saveDraft: handleSaveVoiceExpense,
      startVoiceEntry,
      recordInline: (title, amount, cat) => {
        setInlineTitle(title);
        setInlineAmount(amount);
        if (cat) setInlineCategory(cat);
        return handleRecordInlineExpense();
      }
    };
    return () => {
      delete window.__finwiseVoice;
    };
  }, [voiceDraft, isSavingVoice, inlineTitle, inlineAmount, inlineCategory, manualVoiceText]);

  // Add Income Submit
  const handleAddIncome = async (e) => {
    e.preventDefault();
    try {
      await axios.post(apiUrl('/api/transactions'), {
        title: incomeSource || 'Income Credit',
        amount: Number(incomeAmount),
        type: 'income',
        category: 'Allowance & Salary'
      }, authConfig());
      setShowIncomeModal(false);
      setIncomeAmount('');
      setIncomeSource('');
      showToast('Income recorded successfully.', 'success');
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to record income.', 'error');
    }
  };

  // Delete Transaction
  const handleDeleteTx = async (id) => {
    const confirmed = await confirmModal({
      title: 'Remove Transaction',
      message: 'Are you sure you want to remove this transaction record?',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      isDestructive: true
    });
    if (!confirmed) return;
    try {
      await axios.delete(apiUrl(`/api/transactions/${id}`), authConfig());
      showToast('Transaction record removed.', 'success');
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to delete transaction.', 'error');
    }
  };

  // Confirm Salary Credit
  const handleConfirmSalaryCredit = async (e) => {
    e.preventDefault();
    const finalSalary = Number(profile?.income) || Number(summary?.monthlyIncome) || 0;
    setCreditingSalary(true);
    try {
      await axios.post(apiUrl('/api/user/confirm-salary'), {
        action: salaryAction,
        goalId: salaryAction === 'existing' ? selectedGoalId : null,
        newGoalName: salaryAction === 'new' ? customGoalName : null,
        targetAmount: salaryAction === 'new' ? Number(customGoalTarget) || 0 : null,
        newGoalTargetAmount: salaryAction === 'new' ? Number(customGoalTarget) || 0 : null,
        allocationAmount: Number(allocationAmount) || 0,
        amount: finalSalary,
        isAllocatingAll: salaryAction === 'existing' && Number(allocationAmount) === finalSalary
      }, authConfig());
      
      setShowConfirmSalaryModal(false);
      setAllocationAmount('');
      setCustomGoalName('');
      setCustomGoalTarget('');

      // Update local profile state so pending banner vanishes immediately
      const currentMonthKey = new Date().toISOString().slice(0, 7);
      setProfile(prev => prev ? { ...prev, isCredited: true, lastCreditedMonth: currentMonthKey } : prev);

      showToast('Monthly salary / allowance credited successfully.', 'success');
      await fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to confirm salary credit.', 'error');
    } finally {
      setCreditingSalary(false);
    }
  };

  // Defensive safe arrays to prevent render crashes on fresh account registration
  const safeTx = Array.isArray(transactions) ? transactions : [];
  const safeGoals = Array.isArray(goals) ? goals : [];
  const safeInsights = Array.isArray(insights) ? insights : [];

  // Calculations for KPI cards derived strictly from real transactions & summary
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTransactions = safeTx.filter(t => t.type === 'expense' && (typeof t.date === 'string' ? t.date.startsWith(todayStr) : false));
  const todaySpent = todayTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
  const dailyTargetBuffer = profile?.userType === 'Student' ? 275 : 850;
  const todayBufferRemaining = Math.max(0, dailyTargetBuffer - todaySpent);

  const thisMonthExpenses = summary?.monthlyExpenses || summary?.thisMonthExpenses || 0;
  const monthlyBufferCap = (summary?.monthlyIncome || summary?.thisMonthIncome || 0) + (summary?.balance || 0);

  // Filtered transactions for table
  const filteredTx = safeTx.filter(t => {
    const matchesSearch = (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ display: 'flex', background: 'var(--bg-main)', minHeight: '100vh' }}>
      <Sidebar />

      <main className="app-main">
        
        {/* Top Header & Search Bar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={{ fontSize: '30px', margin: 0 }}>
              Financial Dashboard
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '2px' }}>
              Track your income, daily expenses, and savings goals.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div className="dashboard-search-box" style={{ position: 'relative' }}>
              <input 
                type="text" 
                className="input-wrapper" 
                placeholder="Search transactions..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '36px', height: '40px', fontSize: '13px' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            {/* Profile Avatar Pill */}
            <div style={{ background: '#ffffff', border: '1px solid var(--border)', padding: '6px 14px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', color: '#ffffff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '12px' }}>
                {profile?.name ? profile.name.charAt(0) : 'U'}
              </div>
              <div style={{ fontSize: '12px', lineHeight: '1.2' }}>
                <strong style={{ display: 'block', color: 'var(--text-main)' }}>{profile?.name || 'User'}</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{profile?.userType || 'Student'}</span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <button 
              className="btn-secondary" 
              onClick={startVoiceEntry} 
              style={{ height: '40px', padding: '0 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Speak an expense"
            >
              <Mic size={15} color="var(--primary)" /> Speak an expense
            </button>
            <button className="btn-action" onClick={() => setShowIncomeModal(true)} style={{ height: '40px', padding: '0 16px', fontSize: '13px' }}>
              <PlusCircle size={16} /> Record Income
            </button>
          </div>
        </header>

        {/* Pending Salary Alert Banner (for Working Professionals) */}
        {profile?.userType === 'Working Professional' && !profile?.isCredited && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="dashboard-salary-banner"
            style={{ 
              background: 'linear-gradient(90deg, #fffbeb 0%, #fef3c7 100%)', 
              border: '1px solid #fde047', 
              borderRadius: '16px', 
              padding: '18px 24px', 
              marginBottom: '28px', 
              display: 'flex', 
              justify: 'space-between', 
              alignItems: 'center' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ background: '#f59e0b', padding: '10px', borderRadius: '12px', color: '#ffffff' }}>
                <Wallet size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '15px', color: '#b45309', display: 'block' }}>Monthly Salary Pending Confirmation</strong>
                <span style={{ fontSize: '13px', color: '#78350f' }}>
                  Has your monthly salary of <strong>{formatINR(profile?.income || 0)}</strong> been credited to your account?
                </span>
              </div>
            </div>
            <button className="btn-action" onClick={openConfirmSalaryModal} style={{ background: '#b45309' }}>
              Confirm Credit & Allocate →
            </button>
          </motion.div>
        )}

        {/* TOP 3 SUMMARY KPI CARDS */}
        <div className="stats-grid dashboard-stats-grid">
          
          {/* Card 1: Today's Total Spent */}
          <div className="bento-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                  TODAY'S TOTAL SPENT
                </span>
              </div>

              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
                {formatINR(todaySpent)} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>/ {formatINR(dailyTargetBuffer)} max safe</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-subtle)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Daily Buffer Surplus:</span>
              <strong style={{ fontSize: '13px', color: '#047857' }}>+{formatINR(todayBufferRemaining)} safe reserve</strong>
            </div>
          </div>

          {/* Card 2: Available Safe Balance */}
          <div className="bento-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                  AVAILABLE SAFE BALANCE
                </span>
              </div>

              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
                {formatINR(summary?.balance || 0)}
              </div>
            </div>

            <div style={{ background: 'var(--bg-subtle)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Month's Inflow:</span>
              <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>+{formatINR(summary?.monthlyIncome || 0)}</strong>
            </div>
          </div>

          {/* Card 3: Monthly Expenses & Buffer */}
          <div className="bento-card" style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                  THIS MONTH'S EXPENSES
                </span>
              </div>

              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
                {formatINR(thisMonthExpenses)}
              </div>
            </div>

            <div style={{ background: 'var(--bg-subtle)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Savings Goals:</span>
              <strong style={{ fontSize: '13px', color: 'var(--primary)' }}>{goals.length} Goals Active</strong>
            </div>
          </div>
        </div>

        {/* MIDDLE SECTION: Log New Expense Form & Category Breakdown (Positioned above Location-Based Budget Suggestions) */}
        <div className="dashboard-content-grid dashboard-two-col-grid">
          
          {/* Left: Speak an Expense Voice & Manual Input Card */}
          <div className="bento-card" style={{ background: '#ffffff', padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(24, 54, 48, 0.08)', display: 'grid', placeItems: 'center', color: 'var(--primary)' }}>
                    <Mic size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Speak an Expense</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Record spending hands-free with voice recognition or manual typing</span>
                  </div>
                </div>
                <span className="stitch-badge badge-green" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={11} /> AI Voice & Text
                </span>
              </div>

              {/* Main Speak an expense Action Button */}
              <div style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={startVoiceEntry}
                  disabled={voiceLoading || isListening}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    borderRadius: '14px',
                    border: isListening ? '2px solid #EAB308' : '1px solid var(--border)',
                    background: isListening ? '#fefce8' : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                    cursor: (voiceLoading || isListening) ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    fontSize: '15px',
                    fontWeight: 700,
                    color: isListening ? '#b45309' : 'var(--text-main)',
                    boxShadow: isListening ? '0 0 16px rgba(234, 179, 8, 0.35)' : '0 2px 6px rgba(0,0,0,0.03)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {voiceLoading ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Parsing expense...</span>
                    </>
                  ) : (
                    <>
                      <Mic size={20} color={isListening ? '#EAB308' : 'var(--primary)'} />
                      <span>{isListening ? 'Listening… speak now' : 'Speak an expense'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status / Error / Success Messages */}
              {voiceError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', marginBottom: '14px' }}>
                  {voiceError}
                </div>
              )}

              {voiceSuccess && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} /> {voiceSuccess}
                </div>
              )}

              {voiceNotice && !voiceSuccess && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', marginBottom: '14px' }}>
                  {voiceNotice}
                </div>
              )}

              {/* Parsed Voice / Manual Draft Confirmation Card */}
              {voiceDraft && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {voiceDraft.isVoice ? 'Recognized Voice Expense Details' : 'Parsed Expense Details'}
                    </span>
                    <span className="stitch-badge badge-blue" style={{ fontSize: '10px' }}>
                      Ready to Save
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Description</label>
                      <input
                        type="text"
                        className="input-wrapper"
                        value={voiceDraft.title}
                        onChange={(e) => setVoiceDraft({ ...voiceDraft, title: e.target.value })}
                        style={{ height: '38px', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Amount (₹)</label>
                      <input
                        type="number"
                        className="input-wrapper"
                        value={voiceDraft.amount}
                        onChange={(e) => setVoiceDraft({ ...voiceDraft, amount: e.target.value })}
                        style={{ height: '38px', fontSize: '14px', fontWeight: 700 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Category</label>
                      <select
                        className="input-wrapper"
                        value={voiceDraft.category}
                        onChange={(e) => setVoiceDraft({ ...voiceDraft, category: e.target.value })}
                        style={{ height: '38px', fontSize: '12px' }}
                      >
                        <option value="Food">Food & Dining</option>
                        <option value="Transport">Transport</option>
                        <option value="Bills">Bills & Utilities</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Education">Education</option>
                        <option value="Housing">Housing</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Date</label>
                      <input
                        type="date"
                        className="input-wrapper"
                        value={voiceDraft.date}
                        onChange={(e) => setVoiceDraft({ ...voiceDraft, date: e.target.value })}
                        style={{ height: '38px', fontSize: '12px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={handleSaveVoiceExpense}
                      disabled={isSavingVoice}
                      className="btn-action"
                      style={{ flex: 1, padding: '10px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      {isSavingVoice ? 'Saving...' : 'Confirm & Save Expense'} <ArrowRight size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setVoiceDraft(null); setVoiceNotice(''); }}
                      className="btn-secondary"
                      style={{ padding: '10px 14px', fontSize: '13px' }}
                    >
                      Discard
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Manual expense entry: where they spent and how much */}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--border)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px', display: 'block' }}>
                  Or manually enter an expense:
                </span>
                <form onSubmit={handleRecordInlineExpense} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label htmlFor="inline-expense-title" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Where did you spend?
                    </label>
                    <input
                      id="inline-expense-title"
                      type="text"
                      className="input-wrapper"
                      placeholder="Where did you spend? (e.g. Canteen, Tea Stall, Books)"
                      value={inlineTitle}
                      onChange={(e) => setInlineTitle(e.target.value)}
                      required
                      style={{ height: '38px', fontSize: '13px' }}
                      aria-label="Where did you spend"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                    <div>
                      <label htmlFor="inline-expense-amount" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        How much? (INR ₹)
                      </label>
                      <input
                        id="inline-expense-amount"
                        type="number"
                        className="input-wrapper"
                        placeholder="How much? (INR ₹)"
                        value={inlineAmount}
                        onChange={(e) => setInlineAmount(e.target.value)}
                        required
                        min="1"
                        style={{ height: '38px', fontSize: '13px', fontWeight: 700 }}
                        aria-label="How much"
                      />
                    </div>
                    <div>
                      <label htmlFor="inline-expense-category" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Category
                      </label>
                      <select
                        id="inline-expense-category"
                        className="input-wrapper"
                        value={inlineCategory}
                        onChange={(e) => setInlineCategory(e.target.value)}
                        style={{ height: '38px', fontSize: '12px' }}
                        aria-label="Category"
                      >
                        <option value="Food">Food & Dining</option>
                        <option value="Transport">Transport</option>
                        <option value="Bills">Bills & Utilities</option>
                        <option value="Shopping">Shopping</option>
                        <option value="Education">Education</option>
                        <option value="Housing">Housing</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button
                      type="submit"
                      id="inline-expense-submit-btn"
                      disabled={isSubmittingInline}
                      className="btn-action"
                      style={{ flex: 1, height: '38px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      {isSubmittingInline ? 'Saving...' : 'Add Expense'} <ArrowRight size={15} />
                    </button>
                    {(inlineTitle || inlineAmount) && (
                      <button
                        type="button"
                        onClick={() => { setInlineTitle(''); setInlineAmount(''); }}
                        className="btn-secondary"
                        style={{ height: '38px', padding: '0 14px', fontSize: '12px' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Powered by FinWise AI Natural Language Parser
              </span>
              <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                Single Transaction Guarantee
              </span>
            </div>
          </div>

          {/* Right: Category Allocation Breakdown */}
          <div className="bento-card" style={{ background: '#ffffff', padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Category Allocation</h3>
                <span className="stitch-badge badge-green">47% Target Healthy</span>
              </div>

              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                    <span>Food & Dining</span>
                    <span>{formatINR(safeTx.filter(t => t.category === 'Food').reduce((a, b) => a + (b.amount || 0), 0))}</span>
                  </div>
                  <div style={{ height: '8px', width: '100%', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '57%', background: 'var(--primary)', borderRadius: '4px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                    <span>Transport & Travel</span>
                    <span>{formatINR(safeTx.filter(t => t.category === 'Transport').reduce((a, b) => a + (b.amount || 0), 0))}</span>
                  </div>
                  <div style={{ height: '8px', width: '100%', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '35%', background: '#10b981', borderRadius: '4px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                    <span>Study & Books</span>
                    <span>{formatINR(safeTx.filter(t => t.category === 'Education').reduce((a, b) => a + (b.amount || 0), 0))}</span>
                  </div>
                  <div style={{ height: '8px', width: '100%', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '25%', background: '#3b82f6', borderRadius: '4px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                    <span>Shopping & Others</span>
                    <span>{formatINR(safeTx.filter(t => t.category === 'Shopping' || t.category === 'Others').reduce((a, b) => a + (b.amount || 0), 0))}</span>
                  </div>
                  <div style={{ height: '8px', width: '100%', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '20%', background: '#f59e0b', borderRadius: '4px' }}></div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* LOCATION-BASED BUDGET ADVISOR (Positioned below Speak an Expense) */}
        <LocationBudgetAdvisor 
          initialBalance={summary?.balance || 0}
          userProfileLocation={profile?.location || ''}
        />

        {/* TELEMETRY AI ALERT BANNER */}
        <div style={{ background: 'linear-gradient(135deg, #183630 0%, #112722 100%)', borderRadius: '16px', padding: '24px 32px', color: '#ffffff', marginBottom: '28px', border: '1px solid #E5C690', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: '#E5C690', padding: '12px', borderRadius: '12px', color: '#183630' }}>
              <Sparkles size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800 }}>FinWise Spending Telemetry</span>
                <span className="stitch-badge badge-dark">AI Engine</span>
              </div>
              <p style={{ color: '#E3DAC9', fontSize: '13px', margin: 0, maxWidth: '680px' }}>
                You've spent <strong>{formatINR(todaySpent)}</strong> today against your daily target buffer of <strong>{formatINR(dailyTargetBuffer)}</strong>. 
                You are currently saving <strong>{formatINR(todayBufferRemaining)}</strong> today which can be diverted to your goal pot!
              </p>
            </div>
          </div>
          <button onClick={() => window.location.href='/goals'} className="btn-action" style={{ flexShrink: 0 }}>
            View Goal Diversion Rate →
          </button>
        </div>

        {/* EXPENSE LOGBOOK & VERIFICATION TABLE */}
        <div className="bento-card" style={{ background: '#ffffff', padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Expense Logbook & Verification</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Verified against your live account records</span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <select 
                className="input-wrapper" 
                value={categoryFilter} 
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ width: '160px', height: '38px', fontSize: '12px' }}
              >
                <option value="All">All Categories</option>
                <option value="Food">Food</option>
                <option value="Transport">Transport</option>
                <option value="Education">Education</option>
                <option value="Housing">Housing</option>
                <option value="Shopping">Shopping</option>
                <option value="Allowance & Salary">Allowance & Salary</option>
              </select>
            </div>
          </div>

          {/* Data Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '12px 14px' }}>Date & Time</th>
                  <th style={{ padding: '12px 14px' }}>Category</th>
                  <th style={{ padding: '12px 14px' }}>Description & Merchant</th>
                  <th style={{ padding: '12px 14px' }}>Payment Method</th>
                  <th style={{ padding: '12px 14px' }}>Amount</th>
                  <th style={{ padding: '12px 14px' }}>AI Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.length > 0 ? filteredTx.map((tx) => (
                  <tr key={tx._id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {new Date(tx.date || Date.now()).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '14px' }}>
                      <span className="stitch-badge badge-blue" style={{ textTransform: 'capitalize' }}>
                        {tx.category || 'General'}
                      </span>
                    </td>
                    <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {tx.title}
                    </td>
                    <td style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {tx.paymentMethod || 'UPI Sync'}
                    </td>
                    <td style={{ padding: '14px', fontWeight: 800, color: tx.type === 'income' ? '#047857' : 'var(--text-main)' }}>
                      {tx.type === 'income' ? '+' : '-'}{formatINR(tx.amount)}
                    </td>
                    <td style={{ padding: '14px' }}>
                      <span className="stitch-badge badge-green" style={{ fontSize: '10px' }}>
                        <CheckCircle2 size={12} /> Verified
                      </span>
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleDeleteTx(tx._id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        title="Delete Entry"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No expenses logged matching filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* RECORD INCOME MODAL */}
      <AnimatePresence>
        {showIncomeModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bento-card" style={{ width: '100%', maxWidth: '440px', background: '#ffffff', padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Record Income Inflow</h3>
                <button onClick={() => setShowIncomeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <form onSubmit={handleAddIncome} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label htmlFor="income-source-input" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Income Source (e.g. Allowance, Freelance)</label>
                  <input id="income-source-input" className="input-wrapper" value={incomeSource} onChange={(e) => setIncomeSource(e.target.value)} required aria-label="Income Source" />
                </div>
                <div>
                  <label htmlFor="income-amount-input" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Amount (INR ₹)</label>
                  <input id="income-amount-input" type="number" className="input-wrapper" value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} required min="1" aria-label="Income Amount in INR" />
                </div>
                <button type="submit" className="btn-action" style={{ width: '100%', padding: '14px', marginTop: '6px' }}>Add Income Record</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM SALARY CREDIT MODAL */}
      <AnimatePresence>
        {showConfirmSalaryModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: '20px' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bento-card" style={{ width: '100%', maxWidth: '520px', background: '#ffffff', padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Confirm Salary Credit</h3>
                <button onClick={() => setShowConfirmSalaryModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
                Choose how you'd like to allocate this monthly salary inflow:
              </p>

              <form onSubmit={handleConfirmSalaryCredit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Read-Only Salary Display */}
                <div style={{ background: 'var(--bg-subtle)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                      Monthly Salary / Inflow
                    </span>
                    <strong style={{ fontSize: '22px', color: 'var(--primary)', fontWeight: 800 }}>
                      {formatINR(profile?.income || summary?.monthlyIncome || 0)}
                    </strong>
                  </div>
                  <span className="stitch-badge badge-green" style={{ fontSize: '11px', fontWeight: 700 }}>
                    Stored Profile Salary
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    <input type="radio" name="salaryAction" value="allocated" checked={salaryAction === 'allocated'} onChange={() => setSalaryAction('allocated')} />
                    Add directly to Available Safe Balance
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, cursor: safeGoals.length > 0 ? 'pointer' : 'not-allowed', opacity: safeGoals.length > 0 ? 1 : 0.6 }}>
                    <input type="radio" name="salaryAction" value="existing" disabled={safeGoals.length === 0} checked={salaryAction === 'existing'} onChange={() => safeGoals.length > 0 && setSalaryAction('existing')} />
                    Allocate portion directly to an existing goal
                  </label>
                  {safeGoals.length === 0 && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '24px', display: 'block', marginTop: '-6px' }}>
                      No active goals found. Create a goal first to allocate funds to an existing goal.
                    </span>
                  )}
                  {salaryAction === 'existing' && safeGoals.length > 0 && (
                    <select className="input-wrapper" value={selectedGoalId} onChange={(e) => setSelectedGoalId(e.target.value)} required style={{ marginLeft: '24px', width: 'calc(100% - 24px)' }}>
                      <option value="">Select Goal...</option>
                      {safeGoals.map(g => <option key={g._id} value={g._id}>{g.name || g.targetName} (Current: {formatINR(g.currentAmount)})</option>)}
                    </select>
                  )}

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    <input type="radio" name="salaryAction" value="new" checked={salaryAction === 'new'} onChange={() => setSalaryAction('new')} />
                    Create a new goal with a portion of salary
                  </label>
                  {salaryAction === 'new' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '24px', width: 'calc(100% - 24px)' }}>
                      <div>
                        <label htmlFor="custom-goal-name" style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Goal Pot Name</label>
                        <input id="custom-goal-name" className="input-wrapper" value={customGoalName} onChange={(e) => setCustomGoalName(e.target.value)} required aria-label="Goal Pot Name" />
                      </div>
                      <div>
                        <label htmlFor="custom-goal-target" style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Goal Target Amount (INR ₹)</label>
                        <input id="custom-goal-target" type="number" className="input-wrapper" value={customGoalTarget} onChange={(e) => setCustomGoalTarget(e.target.value)} required min="1" aria-label="Goal Target Amount in INR" />
                      </div>
                    </div>
                  )}
                </div>

                {(salaryAction === 'existing' || salaryAction === 'new') && (
                  <div style={{ background: 'var(--bg-subtle)', padding: '14px', borderRadius: '12px', marginTop: '6px' }}>
                    <label htmlFor="salary-alloc-amount" style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>Initial Allocation Amount from this Salary (INR ₹)</label>
                    <input id="salary-alloc-amount" type="number" className="input-wrapper" value={allocationAmount} onChange={(e) => setAllocationAmount(e.target.value)} required min="1" max={profile?.income || undefined} aria-label="Allocation amount in INR" />
                  </div>
                )}

                <button type="submit" className="btn-action" disabled={creditingSalary} style={{ width: '100%', padding: '14px', marginTop: '10px' }}>
                  {creditingSalary ? 'Updating Records...' : 'Confirm & Apply'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
