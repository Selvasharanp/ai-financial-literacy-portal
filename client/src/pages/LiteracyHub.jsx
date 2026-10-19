// client/src/pages/LiteracyHub.jsx
// Redesigned FinWise AI Literacy Hub: ONLY Two Features:
// 1. LEARN ONE CONCEPT (Interactive 8-Topic Curriculum with 1 lesson at a time)
// 2. ASK AI TO EXPLAIN (Grok-powered financial educator with suggested questions)

import { useState, useMemo } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { CONCEPTS_DATA, SUGGESTED_AI_QUESTIONS } from '../data/conceptsData';
import { apiUrl, authConfig } from '../utils/api';
import { formatINR } from '../utils/currency';
import {
  BookOpen,
  Sparkles,
  Clock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Calculator,
  HelpCircle,
  Send,
  Copy,
  Check,
  RotateCcw,
  TrendingUp,
  ShieldCheck,
  Percent,
  PieChart,
  Coins,
  Scale,
  CreditCard,
  FileText,
  Lightbulb,
  AlertTriangle,
  Loader2
} from 'lucide-react';

// Topic Icon Mapper
const TOPIC_ICONS = {
  'budgeting-saving': PieChart,
  'compound-interest': TrendingUp,
  'inflation': Percent,
  'loans-emi': Coins,
  'credit-scores': CreditCard,
  'insurance': ShieldCheck,
  'taxes': Scale,
  'stocks-mutual-funds': FileText
};

export default function LiteracyHub() {
  // Main Tab State: 'learn' | 'ask-ai'
  const [activeTab, setActiveTab] = useState('learn');

  // Feature 1: Learn One Concept State
  const [selectedConceptId, setSelectedConceptId] = useState('budgeting-saving');

  // Interactive Activity States
  // 1. Budgeting
  const [budgetIncome, setBudgetIncome] = useState(50000);

  // 2. Compound Interest
  const [compoundSIP, setCompoundSIP] = useState(10000);
  const [compoundYears, setCompoundYears] = useState(15);
  const [compoundRate, setCompoundRate] = useState(12);

  // 3. Inflation
  const [inflationExpense, setInflationExpense] = useState(30000);
  const [inflationRate, setInflationRate] = useState(6);
  const [inflationYears, setInflationYears] = useState(15);

  // 4. Loans & EMI
  const [loanPrincipal, setLoanPrincipal] = useState(3000000);
  const [loanRate, setLoanRate] = useState(8.5);
  const [loanTenureYears, setLoanTenureYears] = useState(20);
  const [loanExtraPrepayment, setLoanExtraPrepayment] = useState(5000);

  // 5. Credit Scores
  const [creditLimit, setCreditLimit] = useState(100000);
  const [creditMonthlySpend, setCreditMonthlySpend] = useState(28000);

  // 6. Insurance
  const [insAnnualIncome, setInsAnnualIncome] = useState(800000);
  const [insOutstandingDebt, setInsOutstandingDebt] = useState(2000000);
  const [insDependents, setInsDependents] = useState(2);

  // 7. Taxes
  const [taxSalary, setTaxSalary] = useState(1000000);
  const [taxDeductions, setTaxDeductions] = useState(150000);

  // 8. Stocks & Mutual Funds
  const [sipMonthly, setSipMonthly] = useState(5000);
  const [sipYears, setSipYears] = useState(10);
  const [sipRate, setSipRate] = useState(12.5);

  // Feature 2: Ask AI State
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [chatHistory, setChatHistory] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      question: 'Welcome to FinWise AI Educator!',
      answer: `Hello! I am your **FinWise AI Financial Educator**.

I can explain any personal finance concept in simple, student-friendly terms with realistic Indian rupee (₹) examples:
• How budgeting frameworks like the 50/30/20 rule work
• Calculating compound interest, SIP returns, and loan EMIs
• Strategies to boost your CIBIL score above 750
• Comparing Old vs New tax regimes
• Choosing term life & health insurance over endowment policies

**Ask any question below or click one of the suggested prompts to get started!**`,
      source: 'FinWise AI'
    }
  ]);
  const [copiedId, setCopiedId] = useState(null);

  // Find active concept
  const currentConcept = useMemo(() => {
    return CONCEPTS_DATA.find((c) => c.id === selectedConceptId) || CONCEPTS_DATA[0];
  }, [selectedConceptId]);

  const currentIndex = useMemo(() => {
    return CONCEPTS_DATA.findIndex((c) => c.id === currentConcept.id);
  }, [currentConcept]);

  const goToPrevConcept = () => {
    if (currentIndex > 0) {
      setSelectedConceptId(CONCEPTS_DATA[currentIndex - 1].id);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  const goToNextConcept = () => {
    if (currentIndex < CONCEPTS_DATA.length - 1) {
      setSelectedConceptId(CONCEPTS_DATA[currentIndex + 1].id);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  // --- Calculations for Interactive Activities ---

  // 1. Budgeting 50/30/20
  const budgetCalculations = useMemo(() => {
    const income = Number(budgetIncome) || 0;
    const needs = Math.round(income * 0.5);
    const wants = Math.round(income * 0.3);
    const savings = Math.round(income * 0.2);
    const yearlySavings = savings * 12;
    return { needs, wants, savings, yearlySavings };
  }, [budgetIncome]);

  // 2. Compound Interest
  const compoundCalculations = useMemo(() => {
    const P = Number(compoundSIP) || 0;
    const y = Number(compoundYears) || 1;
    const r = Number(compoundRate) || 12;
    const i = r / (12 * 100);
    const n = y * 12;

    const totalInvested = P * n;
    let futureValue = 0;
    if (i > 0) {
      futureValue = Math.round(P * (((Math.pow(1 + i, n) - 1) / i) * (1 + i)));
    } else {
      futureValue = totalInvested;
    }
    const interestGained = Math.max(0, futureValue - totalInvested);
    const multiplier = totalInvested > 0 ? (futureValue / totalInvested).toFixed(1) : '1.0';
    const doublingYears = r > 0 ? (72 / r).toFixed(1) : '—';

    return { totalInvested, futureValue, interestGained, multiplier, doublingYears };
  }, [compoundSIP, compoundYears, compoundRate]);

  // 3. Inflation
  const inflationCalculations = useMemo(() => {
    const expense = Number(inflationExpense) || 0;
    const r = Number(inflationRate) || 6;
    const y = Number(inflationYears) || 15;

    const futureCost = Math.round(expense * Math.pow(1 + r / 100, y));
    const multiple = expense > 0 ? (futureCost / expense).toFixed(1) : '1.0';
    const erodedValue1Lakh = Math.round(100000 / Math.pow(1 + r / 100, y));

    return { futureCost, multiple, erodedValue1Lakh };
  }, [inflationExpense, inflationRate, inflationYears]);

  // 4. Loans & EMI
  const emiCalculations = useMemo(() => {
    const P = Number(loanPrincipal) || 0;
    const annualRate = Number(loanRate) || 8.5;
    const y = Number(loanTenureYears) || 20;
    const extra = Number(loanExtraPrepayment) || 0;

    const r = annualRate / (12 * 100);
    const n = y * 12;

    let emi = 0;
    if (r > 0 && n > 0) {
      emi = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
    }

    const baselineTotalPayment = emi * n;
    const baselineTotalInterest = Math.max(0, baselineTotalPayment - P);

    // Simulation with extra prepayment
    let remainingPrincipal = P;
    let prepayTotalInterest = 0;
    let monthsTaken = 0;

    while (remainingPrincipal > 0 && monthsTaken < 600) {
      monthsTaken++;
      const interestMonth = remainingPrincipal * r;
      prepayTotalInterest += interestMonth;
      const principalRepaid = Math.min(remainingPrincipal, emi - interestMonth + extra);
      remainingPrincipal -= principalRepaid;
    }

    const interestSaved = Math.max(0, Math.round(baselineTotalInterest - prepayTotalInterest));
    const yearsSaved = Math.max(0, ((n - monthsTaken) / 12).toFixed(1));

    return { emi, baselineTotalInterest, interestSaved, yearsSaved, monthsTaken };
  }, [loanPrincipal, loanRate, loanTenureYears, loanExtraPrepayment]);

  // 5. Credit Utilization
  const creditCalculations = useMemo(() => {
    const limit = Number(creditLimit) || 1;
    const spend = Number(creditMonthlySpend) || 0;
    const ratio = Math.min(100, Math.round((spend / limit) * 100));
    const safeLimit = Math.round(limit * 0.3);

    let status = 'safe'; // 'safe' | 'caution' | 'danger'
    let statusText = 'Optimal Zone (Safe)';
    let statusBg = '#ecfdf5';
    let statusColor = '#065f46';
    let statusBorder = '#a7f3d0';
    let advice = 'Excellent! Keeping your balance under 30% boosts your CIBIL score and marks you as a low-risk borrower.';

    if (ratio > 50) {
      status = 'danger';
      statusText = 'High-Risk Zone (Red)';
      statusBg = '#fef2f2';
      statusColor = '#991b1b';
      statusBorder = '#fecaca';
      advice = `Warning: Spends above 50% signal credit hunger to lenders, docking up to 40 CIBIL points. Aim to spend under ${formatINR(safeLimit)} or request a limit increase.`;
    } else if (ratio > 30) {
      status = 'caution';
      statusText = 'Caution Zone (Amber)';
      statusBg = '#fffbeb';
      statusColor = '#92400e';
      statusBorder = '#fde68a';
      advice = `Borderline: Keeping utilization strictly below ${formatINR(safeLimit)} (30%) prevents score dips. Consider making a mid-month payment before the statement date.`;
    }

    return { ratio, safeLimit, status, statusText, statusBg, statusColor, statusBorder, advice };
  }, [creditLimit, creditMonthlySpend]);

  // 6. Insurance
  const insuranceCalculations = useMemo(() => {
    const income = Number(insAnnualIncome) || 0;
    const debt = Number(insOutstandingDebt) || 0;
    const dep = Number(insDependents) || 0;

    const incomeReplacement = income * 15;
    const dependentBuffer = dep * 1500000;
    const totalCover = incomeReplacement + debt + dependentBuffer;
    const estimatedMonthlyTermCost = Math.round((totalCover / 10000000) * 850);

    return { incomeReplacement, dependentBuffer, totalCover, estimatedMonthlyTermCost };
  }, [insAnnualIncome, insOutstandingDebt, insDependents]);

  // 7. Taxes: New vs Old Regime
  const taxCalculations = useMemo(() => {
    const salary = Number(taxSalary) || 0;
    const deductions = Number(taxDeductions) || 0;

    // New Regime (FY 24-25/25-26)
    const newStdDeduction = 75000;
    const newTaxable = Math.max(0, salary - newStdDeduction);
    let newTax = 0;

    if (newTaxable > 700000) {
      // 0-3L @ 0%
      // 3-7L @ 5%
      if (newTaxable > 300000) newTax += Math.min(newTaxable - 300000, 400000) * 0.05;
      // 7-10L @ 10%
      if (newTaxable > 700000) newTax += Math.min(newTaxable - 700000, 300000) * 0.10;
      // 10-12L @ 15%
      if (newTaxable > 1000000) newTax += Math.min(newTaxable - 1000000, 200000) * 0.15;
      // 12-15L @ 20%
      if (newTaxable > 1200000) newTax += Math.min(newTaxable - 1200000, 300000) * 0.20;
      // > 15L @ 30%
      if (newTaxable > 1500000) newTax += (newTaxable - 1500000) * 0.30;
      newTax = Math.round(newTax * 1.04); // 4% cess
    }

    // Old Regime
    const oldStdDeduction = 50000;
    const oldTaxable = Math.max(0, salary - oldStdDeduction - deductions);
    let oldTax = 0;

    if (oldTaxable > 500000) {
      // 0-2.5L @ 0%
      // 2.5-5L @ 5%
      if (oldTaxable > 250000) oldTax += Math.min(oldTaxable - 250000, 250000) * 0.05;
      // 5-10L @ 20%
      if (oldTaxable > 500000) oldTax += Math.min(oldTaxable - 500000, 500000) * 0.20;
      // > 10L @ 30%
      if (oldTaxable > 1000000) oldTax += (oldTaxable - 1000000) * 0.30;
      oldTax = Math.round(oldTax * 1.04); // 4% cess
    }

    const difference = Math.abs(newTax - oldTax);
    const recommendedRegime = newTax <= oldTax ? 'New Tax Regime' : 'Old Tax Regime';
    const regimeWinner = newTax <= oldTax ? 'new' : 'old';

    return { newTax, oldTax, difference, recommendedRegime, regimeWinner };
  }, [taxSalary, taxDeductions]);

  // 8. Stocks & Mutual Funds (SIP)
  const sipCalculations = useMemo(() => {
    const P = Number(sipMonthly) || 0;
    const y = Number(sipYears) || 10;
    const r = Number(sipRate) || 12.5;

    const i = r / (12 * 100);
    const n = y * 12;
    const invested = P * n;

    let equityValue = 0;
    if (i > 0) {
      equityValue = Math.round(P * (((Math.pow(1 + i, n) - 1) / i) * (1 + i)));
    }

    // Fixed deposit comparison at 6.5%
    const iFD = 6.5 / (12 * 100);
    const fdValue = Math.round(P * (((Math.pow(1 + iFD, n) - 1) / iFD) * (1 + iFD)));
    const extraWealth = Math.max(0, equityValue - fdValue);

    return { invested, equityValue, fdValue, extraWealth };
  }, [sipMonthly, sipYears, sipRate]);

  // Handle Ask AI Submission
  const handleAskAI = async (queryText) => {
    const questionToAsk = queryText || aiQuestion;
    if (!questionToAsk || !questionToAsk.trim()) return;

    setAiLoading(true);
    setAiError('');

    try {
      const config = authConfig();
      const res = await axios.post(
        apiUrl('/api/ai/explain'),
        {
          question: questionToAsk.trim(),
          topic: currentConcept.category
        },
        config
      );

      const newEntry = {
        id: Date.now().toString(),
        role: 'assistant',
        question: questionToAsk.trim(),
        answer: res.data.answer,
        source: res.data.source === 'ai' ? 'FinWise AI (Grok)' : 'FinWise Knowledge Base'
      };

      setChatHistory((prev) => [newEntry, ...prev]);
      setAiQuestion('');
    } catch (err) {
      console.error('[LiteracyHub] Ask AI error:', err);
      setAiError(
        err.response?.data?.error || 'Unable to connect to AI educator. Please check your network or try again.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div style={{ background: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-main)' }}>
      <Sidebar />

      <main className="app-main">
        <div className="literacy-wrapper">
          {/* Top Header & Two Main Tabs */}
          <header className="literacy-header-bar">
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  marginBottom: '8px'
                }}
              >
                <Sparkles size={13} color="var(--gold)" />
                FinWise Financial Literacy
              </div>
              <h1 className="title-main" style={{ fontSize: '30px', margin: 0, color: 'var(--text-main)' }}>
                Financial Literacy Hub
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '15px', margin: '4px 0 0 0' }}>
                Master essential money principles through interactive lessons and ask AI for clear, jargon-free explanations.
              </p>
            </div>

            {/* TWO MAIN TABS */}
            <div className="literacy-tabs-wrapper">
              <button
                type="button"
                onClick={() => setActiveTab('learn')}
                className={`literacy-tab-btn ${activeTab === 'learn' ? 'active' : ''}`}
              >
                <BookOpen size={16} />
                <span>Learn One Concept</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ask-ai')}
                className={`literacy-tab-btn ${activeTab === 'ask-ai' ? 'active' : ''}`}
              >
                <HelpCircle size={16} />
                <span>Ask AI to Explain</span>
              </button>
            </div>
          </header>

          {/* ========================================================================= */}
          {/* TAB 1: LEARN ONE CONCEPT                                                  */}
          {/* ========================================================================= */}
          {activeTab === 'learn' && (
            <div>
              {/* 8 Topics Grid */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                    Select a Concept ({currentIndex + 1} of {CONCEPTS_DATA.length})
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Displaying 1 focused lesson at a time
                  </span>
                </div>

                <div className="topic-nav-grid">
                  {CONCEPTS_DATA.map((c, idx) => {
                    const isSelected = c.id === selectedConceptId;
                    const Icon = TOPIC_ICONS[c.id] || BookOpen;

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedConceptId(c.id)}
                        className={`topic-item-card ${isSelected ? 'active' : ''}`}
                      >
                        <div className="topic-icon-badge">
                          <Icon size={18} />
                        </div>
                        <span className="topic-card-title">
                          {c.category}
                        </span>
                        <span className="topic-card-subtitle">
                          Lesson {idx + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SINGLE FOCUSED LESSON CONTAINER */}
              <div className="lesson-card-container">
                {/* Lesson Header Meta */}
                <div className="lesson-meta-header">
                  <div className="lesson-category-tag">
                    <BookOpen size={13} />
                    <span>Topic {currentIndex + 1}: {currentConcept.category}</span>
                  </div>

                  <div className="lesson-time-pill">
                    <Clock size={13} />
                    <span>{currentConcept.estimatedMinutes} min read & practice</span>
                  </div>
                </div>

                <h2 className="lesson-headline">
                  {currentConcept.title}
                </h2>

                <p className="lesson-lead-summary">
                  {currentConcept.summary}
                </p>

                {/* 1. SIMPLE EXPLANATION */}
                <div style={{ marginBottom: '28px' }}>
                  <div className="lesson-section-header">
                    <BookOpen size={16} color="var(--primary)" />
                    <span>The Core Concept Explained</span>
                  </div>

                  <div>
                    {currentConcept.explanation.map((para, pIdx) => {
                      const isBullet = para.startsWith('•');
                      if (isBullet) {
                        return (
                          <div key={pIdx} className="lesson-bullet-row">
                            {para}
                          </div>
                        );
                      }
                      return (
                        <p key={pIdx} className="lesson-body-paragraph">
                          {para}
                        </p>
                      );
                    })}
                  </div>
                </div>

                {/* 2. REALISTIC NUMERICAL EXAMPLE */}
                <div className="lesson-example-card">
                  <div className="lesson-section-header" style={{ margin: '0 0 10px 0' }}>
                    <Calculator size={16} color="var(--primary)" />
                    <span>{currentConcept.example.title}</span>
                  </div>

                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
                    {currentConcept.example.description}
                  </p>

                  <div className="example-grid-3">
                    {currentConcept.example.items.map((item, itIdx) => (
                      <div key={itIdx} className="example-single-box">
                        <div>
                          <span className="example-box-label">{item.label}</span>
                          <span className="example-box-value">{item.amount}</span>
                        </div>
                        <span className="example-box-note">{item.note}</span>
                      </div>
                    ))}
                  </div>

                  <div className="example-bottom-line">
                    <CheckCircle2 size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Bottom Line: </strong>{currentConcept.example.result}
                    </div>
                  </div>
                </div>

                {/* 3. INTERACTIVE MINI-ACTIVITY */}
                <div className="lesson-activity-box">
                  <div className="activity-title-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: 'var(--primary)', color: 'var(--gold)', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>
                          {currentConcept.activity.title}
                        </h3>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          {currentConcept.activity.description}
                        </span>
                      </div>
                    </div>
                    <span className="activity-badge">Interactive Practice</span>
                  </div>

                  {/* Activity A: Budgeting */}
                  {currentConcept.id === 'budgeting-saving' && (
                    <div>
                      <div style={{ marginBottom: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                            Monthly In-Hand Salary:
                          </label>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>
                            {formatINR(budgetIncome)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="15000"
                          max="250000"
                          step="5000"
                          value={budgetIncome}
                          onChange={(e) => setBudgetIncome(Number(e.target.value))}
                          className="finwise-slider"
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span>₹15,000 / mo</span>
                          <span>₹1,00,000 / mo</span>
                          <span>₹2,50,000 / mo</span>
                        </div>
                      </div>

                      {/* Visual 50/30/20 Bar */}
                      <div style={{ height: '14px', width: '100%', borderRadius: '8px', overflow: 'hidden', display: 'flex', marginBottom: '18px', background: 'var(--bg-subtle)' }}>
                        <div style={{ width: '50%', background: '#183630' }} title="Needs 50%" />
                        <div style={{ width: '30%', background: '#b45309' }} title="Wants 30%" />
                        <div style={{ width: '20%', background: '#15803d' }} title="Savings 20%" />
                      </div>

                      <div className="activity-metric-grid" style={{ marginTop: 0 }}>
                        <div className="activity-metric-card" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#1e293b' }}>
                              50% Needs
                            </span>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                              {formatINR(budgetCalculations.needs)}
                            </div>
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Rent, groceries, utilities, commute, and medicine.
                          </span>
                        </div>

                        <div className="activity-metric-card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#92400e' }}>
                              30% Wants
                            </span>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: '#b45309', margin: '4px 0' }}>
                              {formatINR(budgetCalculations.wants)}
                            </div>
                          </div>
                          <span style={{ fontSize: '12px', color: '#92400e' }}>
                            Dining out, weekend leisure, gadgets, and hobbies.
                          </span>
                        </div>

                        <div className="activity-metric-card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#065f46' }}>
                              20% Savings
                            </span>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: '#047857', margin: '4px 0' }}>
                              {formatINR(budgetCalculations.savings)}
                            </div>
                          </div>
                          <span style={{ fontSize: '12px', color: '#065f46' }}>
                            {formatINR(budgetCalculations.yearlySavings)} saved per year in emergency buffer & SIPs.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activity B: Compound Interest */}
                  {currentConcept.id === 'compound-interest' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Monthly SIP:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{formatINR(compoundSIP)}</span>
                          </div>
                          <input
                            type="range"
                            min="1000"
                            max="50000"
                            step="1000"
                            value={compoundSIP}
                            onChange={(e) => setCompoundSIP(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Duration:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{compoundYears} Years</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="30"
                            step="1"
                            value={compoundYears}
                            onChange={(e) => setCompoundYears(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Expected Return:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{compoundRate}% p.a.</span>
                          </div>
                          <input
                            type="range"
                            min="6"
                            max="16"
                            step="0.5"
                            value={compoundRate}
                            onChange={(e) => setCompoundRate(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>
                      </div>

                      <div className="activity-metric-grid" style={{ marginTop: 0 }}>
                        <div className="activity-metric-card">
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Deposited</span>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', margin: '4px 0' }}>
                            {formatINR(compoundCalculations.totalInvested)}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>From your pocket</span>
                        </div>

                        <div className="activity-metric-card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#065f46' }}>Interest Gained</span>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#047857', margin: '4px 0' }}>
                            +{formatINR(compoundCalculations.interestGained)}
                          </div>
                          <span style={{ fontSize: '11px', color: '#065f46' }}>Pure compound growth</span>
                        </div>

                        <div className="activity-metric-card" style={{ background: 'var(--primary)', color: '#F7F4EE' }}>
                          <span style={{ fontSize: '12px', color: 'var(--gold)' }}>Total Maturity Value</span>
                          <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>
                            {formatINR(compoundCalculations.futureValue)}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--primary-light)' }}>
                            Multiplied by {compoundCalculations.multiplier}x (Doubles every ~{compoundCalculations.doublingYears} yrs)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activity C: Inflation */}
                  {currentConcept.id === 'inflation' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Current Monthly Expense:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{formatINR(inflationExpense)}</span>
                          </div>
                          <input
                            type="range"
                            min="10000"
                            max="150000"
                            step="5000"
                            value={inflationExpense}
                            onChange={(e) => setInflationExpense(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Inflation Rate:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{inflationRate}% / year</span>
                          </div>
                          <input
                            type="range"
                            min="4"
                            max="12"
                            step="0.5"
                            value={inflationRate}
                            onChange={(e) => setInflationRate(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Years Ahead:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{inflationYears} Years</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="30"
                            step="1"
                            value={inflationYears}
                            onChange={(e) => setInflationYears(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>
                      </div>

                      <div className="activity-metric-grid" style={{ marginTop: 0 }}>
                        <div className="activity-metric-card" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#991b1b' }}>
                            Future Cost in {inflationYears} Years
                          </span>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626', margin: '4px 0' }}>
                            {formatINR(inflationCalculations.futureCost)} / mo
                          </div>
                          <span style={{ fontSize: '12px', color: '#991b1b' }}>
                            You will need {inflationCalculations.multiple}x as many rupees for the exact same lifestyle.
                          </span>
                        </div>

                        <div className="activity-metric-card">
                          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                            ₹1,00,000 Cash Purchasing Power
                          </span>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', margin: '4px 0' }}>
                            Feels like {formatINR(inflationCalculations.erodedValue1Lakh)}
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Idle cash loses over {(100 - (inflationCalculations.erodedValue1Lakh / 1000)).toFixed(0)}% of real purchasing power.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activity D: Loans & EMI */}
                  {currentConcept.id === 'loans-emi' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Loan Amount:</label>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)' }}>{formatINR(loanPrincipal)}</span>
                          </div>
                          <input
                            type="range"
                            min="500000"
                            max="10000000"
                            step="250000"
                            value={loanPrincipal}
                            onChange={(e) => setLoanPrincipal(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Interest Rate:</label>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)' }}>{loanRate}%</span>
                          </div>
                          <input
                            type="range"
                            min="6"
                            max="14"
                            step="0.25"
                            value={loanRate}
                            onChange={(e) => setLoanRate(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Tenure:</label>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)' }}>{loanTenureYears} Yrs</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="30"
                            step="1"
                            value={loanTenureYears}
                            onChange={(e) => setLoanTenureYears(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Extra Prepayment:</label>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)' }}>{formatINR(loanExtraPrepayment)}/mo</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="20000"
                            step="1000"
                            value={loanExtraPrepayment}
                            onChange={(e) => setLoanExtraPrepayment(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>
                      </div>

                      <div className="activity-metric-grid" style={{ marginTop: 0 }}>
                        <div className="activity-metric-card">
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Standard Monthly EMI</span>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', margin: '4px 0' }}>
                            {formatINR(emiCalculations.emi)} / mo
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Total interest: {formatINR(emiCalculations.baselineTotalInterest)}
                          </span>
                        </div>

                        <div className="activity-metric-card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#065f46' }}>Interest Saved</span>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#047857', margin: '4px 0' }}>
                            {formatINR(emiCalculations.interestSaved)}
                          </div>
                          <span style={{ fontSize: '11px', color: '#065f46' }}>
                            By prepaying {formatINR(loanExtraPrepayment)}/month
                          </span>
                        </div>

                        <div className="activity-metric-card" style={{ background: 'var(--primary-light)', borderColor: 'var(--border)' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Debt Freedom Faster</span>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', margin: '4px 0' }}>
                            {emiCalculations.yearsSaved} Years Shaved
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--primary)' }}>
                            Clears in {(emiCalculations.monthsTaken / 12).toFixed(1)} yrs instead of {loanTenureYears} yrs
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activity E: Credit Scores */}
                  {currentConcept.id === 'credit-scores' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '18px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Credit Card Limit:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{formatINR(creditLimit)}</span>
                          </div>
                          <input
                            type="range"
                            min="20000"
                            max="500000"
                            step="10000"
                            value={creditLimit}
                            onChange={(e) => setCreditLimit(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Monthly Card Spend:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{formatINR(creditMonthlySpend)}</span>
                          </div>
                          <input
                            type="range"
                            min="1000"
                            max={creditLimit}
                            step="1000"
                            value={creditMonthlySpend}
                            onChange={(e) => setCreditMonthlySpend(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>
                      </div>

                      {/* Utilization Gauge */}
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                          <span>Utilization: {creditCalculations.ratio}%</span>
                          <span>Safe 30% Cap: {formatINR(creditCalculations.safeLimit)}</span>
                        </div>
                        <div style={{ height: '12px', width: '100%', background: 'var(--bg-subtle)', borderRadius: '6px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, creditCalculations.ratio)}%`,
                              height: '100%',
                              background: creditCalculations.ratio <= 30 ? '#10b981' : creditCalculations.ratio <= 50 ? '#f59e0b' : '#ef4444',
                              transition: 'width 0.2s ease, background-color 0.2s ease'
                            }}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          background: creditCalculations.statusBg,
                          borderColor: creditCalculations.statusBorder,
                          color: creditCalculations.statusColor,
                          border: '1px solid',
                          borderRadius: '12px',
                          padding: '16px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontWeight: 800, fontSize: '12px' }}>
                          <span>STATUS: {creditCalculations.statusText}</span>
                          <span>{creditCalculations.ratio}% UTILIZED</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                          {creditCalculations.advice}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Activity F: Insurance */}
                  {currentConcept.id === 'insurance' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Annual Salary:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{formatINR(insAnnualIncome)}</span>
                          </div>
                          <input
                            type="range"
                            min="300000"
                            max="3000000"
                            step="50000"
                            value={insAnnualIncome}
                            onChange={(e) => setInsAnnualIncome(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Existing Debts/Loans:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{formatINR(insOutstandingDebt)}</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="5000000"
                            step="100000"
                            value={insOutstandingDebt}
                            onChange={(e) => setInsOutstandingDebt(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Dependents:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{insDependents} People</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="4"
                            step="1"
                            value={insDependents}
                            onChange={(e) => setInsDependents(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>
                      </div>

                      <div className="activity-metric-grid" style={{ marginTop: 0 }}>
                        <div className="activity-metric-card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#065f46' }}>
                            Recommended Term Life Cover
                          </span>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: '#047857', margin: '4px 0' }}>
                            {formatINR(insuranceCalculations.totalCover)}
                          </div>
                          <span style={{ fontSize: '12px', color: '#065f46' }}>
                            (15x Salary: {formatINR(insuranceCalculations.incomeReplacement)}) + (Debts: {formatINR(insOutstandingDebt)})
                          </span>
                        </div>

                        <div className="activity-metric-card">
                          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                            Estimated Pure Term Cost
                          </span>
                          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', margin: '4px 0' }}>
                            ~{formatINR(insuranceCalculations.estimatedMonthlyTermCost)} / mo
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Pure term protection gives 50x higher cover at a fraction of the cost of endowment plans.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activity G: Taxes */}
                  {currentConcept.id === 'taxes' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Gross Annual Salary:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{formatINR(taxSalary)}</span>
                          </div>
                          <input
                            type="range"
                            min="400000"
                            max="2500000"
                            step="50000"
                            value={taxSalary}
                            onChange={(e) => setTaxSalary(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Eligible Deductions (Old Regime):</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{formatINR(taxDeductions)}</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="400000"
                            step="25000"
                            value={taxDeductions}
                            onChange={(e) => setTaxDeductions(Number(e.target.value))}
                            className="finwise-slider"
                          />
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            80C (EPF/ELSS), 80D (Health), HRA, Home Loan Interest
                          </span>
                        </div>
                      </div>

                      <div className="activity-metric-grid" style={{ marginTop: 0 }}>
                        <div
                          className="activity-metric-card"
                          style={{
                            background: taxCalculations.regimeWinner === 'new' ? '#ecfdf5' : 'var(--bg-main)',
                            borderColor: taxCalculations.regimeWinner === 'new' ? '#34d399' : 'var(--border)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)' }}>
                              New Tax Regime
                            </span>
                            {taxCalculations.regimeWinner === 'new' && (
                              <span style={{ fontSize: '10px', fontWeight: 800, background: '#059669', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                                Lower Tax
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', margin: '6px 0' }}>
                            {formatINR(taxCalculations.newTax)}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Standard ₹75,000 deduction with zero paperwork.
                          </span>
                        </div>

                        <div
                          className="activity-metric-card"
                          style={{
                            background: taxCalculations.regimeWinner === 'old' ? '#ecfdf5' : 'var(--bg-main)',
                            borderColor: taxCalculations.regimeWinner === 'old' ? '#34d399' : 'var(--border)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)' }}>
                              Old Tax Regime
                            </span>
                            {taxCalculations.regimeWinner === 'old' && (
                              <span style={{ fontSize: '10px', fontWeight: 800, background: '#059669', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                                Lower Tax
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', margin: '6px 0' }}>
                            {formatINR(taxCalculations.oldTax)}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            With {formatINR(taxDeductions)} deductions applied.
                          </span>
                        </div>

                        <div className="activity-metric-card" style={{ background: 'var(--primary)', color: '#F7F4EE' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gold)' }}>
                            Recommendation
                          </span>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: '6px 0' }}>
                            Choose {taxCalculations.recommendedRegime}
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--primary-light)' }}>
                            Saves {formatINR(taxCalculations.difference)} in taxes!
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activity H: Stocks & Mutual Funds */}
                  {currentConcept.id === 'stocks-mutual-funds' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Monthly Index SIP:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{formatINR(sipMonthly)}</span>
                          </div>
                          <input
                            type="range"
                            min="1000"
                            max="25000"
                            step="1000"
                            value={sipMonthly}
                            onChange={(e) => setSipMonthly(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Tenure:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{sipYears} Years</span>
                          </div>
                          <input
                            type="range"
                            min="3"
                            max="25"
                            step="1"
                            value={sipYears}
                            onChange={(e) => setSipYears(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Index CAGR:</label>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>{sipRate}%</span>
                          </div>
                          <input
                            type="range"
                            min="8"
                            max="15"
                            step="0.5"
                            value={sipRate}
                            onChange={(e) => setSipRate(Number(e.target.value))}
                            className="finwise-slider"
                          />
                        </div>
                      </div>

                      <div className="activity-metric-grid" style={{ marginTop: 0 }}>
                        <div className="activity-metric-card">
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Principal Invested</span>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)', margin: '4px 0' }}>
                            {formatINR(sipCalculations.invested)}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sipYears} years of monthly discipline</span>
                        </div>

                        <div className="activity-metric-card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#065f46' }}>Nifty 50 Index Value</span>
                          <div style={{ fontSize: '22px', fontWeight: 800, color: '#047857', margin: '4px 0' }}>
                            {formatINR(sipCalculations.equityValue)}
                          </div>
                          <span style={{ fontSize: '11px', color: '#065f46' }}>At {sipRate}% historical CAGR</span>
                        </div>

                        <div className="activity-metric-card" style={{ background: 'var(--primary-light)', borderColor: 'var(--border)' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>Extra Wealth vs Bank FD</span>
                          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', margin: '4px 0' }}>
                            +{formatINR(sipCalculations.extraWealth)}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--primary)' }}>Significantly beats bank FD after inflation</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. CONCISE TAKEAWAY */}
                <div className="lesson-takeaway-banner">
                  <Lightbulb size={24} color="var(--gold)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--gold)', margin: '0 0 6px 0' }}>
                      Actionable Takeaway
                    </h4>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, lineHeight: '1.6', color: '#F7F4EE' }}>
                      {currentConcept.takeaway}
                    </p>
                  </div>
                </div>

                {/* Lesson Navigation Footer */}
                <div className="lesson-nav-bar">
                  <button
                    type="button"
                    onClick={goToPrevConcept}
                    disabled={currentIndex === 0}
                    className="btn-secondary"
                    style={{
                      opacity: currentIndex === 0 ? 0.4 : 1,
                      cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <ArrowLeft size={16} />
                    <span>Previous Concept</span>
                  </button>

                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Lesson {currentIndex + 1} of {CONCEPTS_DATA.length}
                  </div>

                  <button
                    type="button"
                    onClick={goToNextConcept}
                    disabled={currentIndex === CONCEPTS_DATA.length - 1}
                    className="btn-action"
                    style={{
                      opacity: currentIndex === CONCEPTS_DATA.length - 1 ? 0.4 : 1,
                      cursor: currentIndex === CONCEPTS_DATA.length - 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <span>Next Concept</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: ASK AI TO EXPLAIN                                                  */}
          {/* ========================================================================= */}
          {activeTab === 'ask-ai' && (
            <div className="ask-ai-card-container">
              {/* Feature Header */}
              <div style={{ paddingBottom: '20px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    marginBottom: '8px'
                  }}
                >
                  <Sparkles size={13} color="var(--gold)" />
                  <span>AI Financial Tutor</span>
                </div>
                <h2 className="title-main" style={{ fontSize: '28px', margin: 0, color: 'var(--primary)' }}>
                  Ask AI to Explain Any Financial Concept
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Get plain-language explanations with realistic Indian rupee (₹) examples, powered by Grok AI.
                </p>
              </div>

              {/* Suggested Questions Pills */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  <HelpCircle size={14} />
                  <span>Suggested Questions to Try:</span>
                </div>
                <div className="suggested-prompts-grid">
                  {SUGGESTED_AI_QUESTIONS.map((q, qIdx) => (
                    <button
                      key={qIdx}
                      type="button"
                      onClick={() => {
                        setAiQuestion(q);
                        handleAskAI(q);
                      }}
                      className="suggested-prompt-chip"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Box */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskAI();
                }}
                style={{ marginBottom: '28px' }}
              >
                <div style={{ marginBottom: '12px' }}>
                  <textarea
                    rows={3}
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="Ask any financial question in plain language... (e.g. Why should I not keep my emergency fund in stocks?)"
                    className="input-wrapper"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      minHeight: '85px',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    FinWise AI answers using factual financial principles and Indian context.
                  </span>

                  <button
                    type="submit"
                    disabled={aiLoading || !aiQuestion.trim()}
                    className="btn-action"
                    style={{ minWidth: '170px' }}
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Explaining...</span>
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        <span>Ask AI to Explain</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Error Message */}
              {aiError && (
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: '12px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    marginBottom: '20px'
                  }}
                >
                  <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Unable to get explanation: </strong>
                    <span>{aiError}</span>
                  </div>
                </div>
              )}

              {/* Q&A Chat History Stream */}
              <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--primary)', margin: 0 }}>
                    Explanations Stream
                  </h3>
                  {chatHistory.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setChatHistory([chatHistory[chatHistory.length - 1]])}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <RotateCcw size={13} />
                      <span>Clear History</span>
                    </button>
                  )}
                </div>

                <div>
                  {chatHistory.map((item) => (
                    <div key={item.id} className="chat-bubble-card">
                      {/* Question Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ background: 'var(--primary)', color: 'var(--gold)', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                            <Sparkles size={14} />
                          </div>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>
                            {item.question}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.answer, item.id)}
                          style={{
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Copy explanation"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check size={13} color="#059669" />
                              <span style={{ color: '#059669' }}>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Answer Body */}
                      <div
                        style={{
                          fontSize: '14px',
                          lineHeight: '1.7',
                          color: 'var(--text-main)',
                          whiteSpace: 'pre-line',
                          paddingLeft: '14px',
                          borderLeft: '3px solid var(--gold)',
                          margin: '0 0 14px 0'
                        }}
                      >
                        {item.answer}
                      </div>

                      {/* Source Footnote */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          paddingTop: '10px',
                          borderTop: '1px solid var(--border)'
                        }}
                      >
                        <span>Source: {item.source || 'FinWise AI'}</span>
                        <span>Educational purpose only • Not investment advice</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
