import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  GraduationCap, Briefcase, CheckCircle2, ArrowRight, Sparkles, 
  ShieldCheck, IndianRupee, Calendar, AlertCircle, ShoppingBag, Wallet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { apiUrl, authConfig } from '../utils/api';

const getDateAwareContent = () => {
    const today = new Date();
    const day = today.getDate();

    if (day >= 1 && day <= 5) {
        return {
            heading: "Let's set up your monthly spending",
            question: "Have you spent any money so far this month?",
            helper: "Enter your total spending since the beginning of this month, or enter ₹0 if you haven't spent anything."
        };
    } else if (day >= 6 && day <= 14) {
        return {
            heading: "Your spending so far",
            question: "How much have you spent since the beginning of this month?",
            helper: "Include the expenses you've already paid, even if you haven't recorded them in this app."
        };
    } else if (day >= 15 && day <= 20) {
        return {
            heading: "Let's catch up with your spending",
            question: "How much have you spent so far this month?",
            helper: "Enter the total amount spent from the first day of this month until today."
        };
    } else if (day >= 21 && day <= 27) {
        return {
            heading: "Review your monthly spending",
            question: "How much have you spent so far this month?",
            helper: "Include the expenses you've already made so your monthly figures start with the correct total."
        };
    } else {
        return {
            heading: "Your month-end spending",
            question: "What is your total spending so far this month?",
            helper: "Enter the expenses you've already made this month to establish your current monthly total."
        };
    }
};

const Onboarding = () => {
    const [step, setStep] = useState(1); // 1: Persona, 2: Spend so far, 3: Available Balance, 4: Income (if Pro)
    const [userType, setUserType] = useState('Student');
    const [monthToDateSpending, setMonthToDateSpending] = useState('0');
    const [openingBalance, setOpeningBalance] = useState('25000');
    const [income, setIncome] = useState('30000');
    const [isCredited, setIsCredited] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const dateContent = getDateAwareContent();

    const handleComplete = async (e) => {
        if (e) e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload = {
                userType,
                monthToDateSpending: Number(monthToDateSpending) || 0,
                openingBalance: Number(openingBalance) || 0,
                income: userType === 'Working Professional' ? (Number(income) || 0) : 0,
                isCredited: userType === 'Working Professional' ? isCredited : true
            };

            const res = await axios.post(apiUrl('/api/auth/onboarding'), payload, authConfig());

            const updatedUser = res.data?.user || res.data;
            if (updatedUser) {
                localStorage.setItem('user', JSON.stringify(updatedUser));
            }
            
            window.dispatchEvent(new Event('transactions-changed'));
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.msg || err.response?.data?.error || 'Unable to save your financial profile.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}>
            
            {/* Top Navigation Header */}
            <header style={{ 
                height: '70px', borderBottom: '1px solid var(--border)', background: 'var(--primary)', 
                padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#ffffff'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'var(--gold)', color: 'var(--primary)', padding: '8px', borderRadius: '8px', display: 'flex' }}>
                        <Sparkles size={20} />
                    </div>
                    <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: '#F7F4EE' }}>
                        FinWise <span style={{ color: 'var(--gold)' }}>AI</span>
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <span className="stitch-badge badge-dark" style={{ fontSize: '12px' }}>
                        <ShieldCheck size={14} /> Step {step} of {userType === 'Working Professional' ? 4 : 3}
                    </span>
                </div>
            </header>

            {/* Main Setup Container */}
            <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
                <div style={{ width: '100%', maxWidth: '780px' }}>
                    
                    {/* Progress Bar Header */}
                    <div style={{ marginBottom: '28px', textAlign: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                            FINANCIAL PROFILE CALIBRATION
                        </span>
                        <h1 style={{ fontSize: '32px', marginTop: '4px', marginBottom: '8px' }}>
                            Configure Your Financial Baseline
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px', maxWidth: '580px', margin: '0 auto' }}>
                            Accurate initial figures help FinWise AI track your real monthly cashflow without duplicate deductions.
                        </p>
                    </div>

                    {error && (
                        <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', color: '#dc2626', fontSize: '14px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}

                    {/* Step 1: Persona Selection */}
                    {step === 1 && (
                        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                            <div className="persona-selection-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '24px', marginBottom: '28px' }}>
                                
                                {/* Student Persona Card */}
                                <div 
                                    onClick={() => setUserType('Student')}
                                    className="bento-card"
                                    style={{
                                        padding: '28px',
                                        cursor: 'pointer',
                                        border: userType === 'Student' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        position: 'relative'
                                    }}
                                >
                                    {userType === 'Student' && (
                                        <div style={{ position: 'absolute', top: '16px', right: '16px', background: 'var(--primary)', color: 'var(--gold)', padding: '4px', borderRadius: '50%', display: 'flex' }}>
                                            <CheckCircle2 size={16} />
                                        </div>
                                    )}

                                    <div style={{ background: 'var(--primary)', width: '48px', height: '48px', borderRadius: '12px', display: 'grid', placeItems: 'center', color: 'var(--gold)', marginBottom: '18px' }}>
                                        <GraduationCap size={24} />
                                    </div>

                                    <span className="stitch-badge badge-green" style={{ marginBottom: '10px' }}>
                                        College & Campus Budgeting
                                    </span>

                                    <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>
                                        Student / Learner
                                    </h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5', marginBottom: '16px' }}>
                                        Track daily campus spends, mess bills, and goal savings without complex tax accounting.
                                    </p>
                                </div>

                                {/* Working Professional Persona Card */}
                                <div 
                                    onClick={() => setUserType('Working Professional')}
                                    className="bento-card"
                                    style={{
                                        padding: '28px',
                                        cursor: 'pointer',
                                        border: userType === 'Working Professional' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        position: 'relative'
                                    }}
                                >
                                    {userType === 'Working Professional' && (
                                        <div style={{ position: 'absolute', top: '16px', right: '16px', background: 'var(--primary)', color: 'var(--gold)', padding: '4px', borderRadius: '50%', display: 'flex' }}>
                                            <CheckCircle2 size={16} />
                                        </div>
                                    )}

                                    <div style={{ background: 'var(--primary-light)', width: '48px', height: '48px', borderRadius: '12px', display: 'grid', placeItems: 'center', color: 'var(--primary)', marginBottom: '18px' }}>
                                        <Briefcase size={24} />
                                    </div>

                                    <span className="stitch-badge badge-indigo" style={{ marginBottom: '10px' }}>
                                        Salary & Goal Allocation
                                    </span>

                                    <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>
                                        Working Professional
                                    </h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5', marginBottom: '16px' }}>
                                        Manage monthly salary credits, automatic goal transfers, and emergency buffers.
                                    </p>
                                </div>

                            </div>

                            <button 
                                type="button" 
                                className="btn-action" 
                                onClick={() => setStep(2)}
                                style={{ width: '100%', padding: '16px', fontSize: '16px' }}
                            >
                                Continue to Spending Setup <ArrowRight size={20} />
                            </button>
                        </motion.div>
                    )}

                    {/* Step 2: Date-Aware Month-to-Date Spending */}
                    {step === 2 && (
                        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                            <div className="bento-card" style={{ padding: '32px', marginBottom: '24px' }}>
                                <span className="stitch-badge badge-amber" style={{ marginBottom: '12px' }}>
                                    <Calendar size={13} /> {new Date().toLocaleString('default', { month: 'long' })} Snapshot
                                </span>
                                
                                <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>
                                    {dateContent.heading}
                                </h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                                    {dateContent.question}
                                </p>

                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', display: 'block' }}>
                                        Month-to-Date Expenses Spent So Far (₹)
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type="number" 
                                            className="input-wrapper" 
                                            value={monthToDateSpending} 
                                            onChange={(e) => setMonthToDateSpending(e.target.value)} 
                                            placeholder="0" 
                                            required 
                                            min="0"
                                            style={{ paddingLeft: '36px', fontSize: '18px', fontWeight: 700 }}
                                        />
                                        <IndianRupee size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    </div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', display: 'block' }}>
                                        {dateContent.helper}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button 
                                    type="button" 
                                    className="btn-secondary" 
                                    onClick={() => setStep(1)}
                                    style={{ flex: 1, padding: '14px' }}
                                >
                                    ← Back
                                </button>
                                <button 
                                    type="button" 
                                    className="btn-action" 
                                    onClick={() => setStep(3)}
                                    style={{ flex: 2, padding: '14px' }}
                                >
                                    Continue to Available Balance <ArrowRight size={18} />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 3: Available Safe Balance */}
                    {step === 3 && (
                        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                            <div className="bento-card" style={{ padding: '32px', marginBottom: '24px' }}>
                                <span className="stitch-badge badge-green" style={{ marginBottom: '12px' }}>
                                    <Wallet size={13} /> Current Funds
                                </span>

                                <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>
                                    Current Available Safe Balance
                                </h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                                    Enter the liquid funds currently in your bank account right now.
                                </p>

                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', display: 'block' }}>
                                        Current Available Balance (₹)
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type="number" 
                                            className="input-wrapper" 
                                            value={openingBalance} 
                                            onChange={(e) => setOpeningBalance(e.target.value)} 
                                            placeholder="25000" 
                                            required 
                                            min="0"
                                            style={{ paddingLeft: '36px', fontSize: '18px', fontWeight: 700 }}
                                        />
                                        <IndianRupee size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    </div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', display: 'block' }}>
                                        Note: Your starting monthly spending snapshot (₹{Number(monthToDateSpending) || 0}) will NOT be deducted from this balance.
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button 
                                    type="button" 
                                    className="btn-secondary" 
                                    onClick={() => setStep(2)}
                                    style={{ flex: 1, padding: '14px' }}
                                >
                                    ← Back
                                </button>
                                {userType === 'Working Professional' ? (
                                    <button 
                                        type="button" 
                                        className="btn-action" 
                                        onClick={() => setStep(4)}
                                        style={{ flex: 2, padding: '14px' }}
                                    >
                                        Continue to Salary Setup <ArrowRight size={18} />
                                    </button>
                                ) : (
                                    <button 
                                        type="button" 
                                        className="btn-action" 
                                        disabled={loading}
                                        onClick={handleComplete}
                                        style={{ flex: 2, padding: '14px' }}
                                    >
                                        {loading ? 'Completing Setup...' : 'Complete & Open Dashboard'} <ArrowRight size={18} />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 4: Working Professional Salary & Credit Status */}
                    {step === 4 && userType === 'Working Professional' && (
                        <motion.form initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleComplete}>
                            <div className="bento-card" style={{ padding: '32px', marginBottom: '24px' }}>
                                <span className="stitch-badge badge-indigo" style={{ marginBottom: '12px' }}>
                                    <Briefcase size={13} /> Monthly Salary Details
                                </span>

                                <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>
                                    Monthly Take-Home Salary
                                </h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                                    Specify your expected monthly income and whether this month's salary has arrived.
                                </p>

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', display: 'block' }}>
                                        Monthly Net Salary (₹)
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type="number" 
                                            className="input-wrapper" 
                                            value={income} 
                                            onChange={(e) => setIncome(e.target.value)} 
                                            placeholder="30000" 
                                            required 
                                            min="0"
                                            style={{ paddingLeft: '36px', fontSize: '18px', fontWeight: 700 }}
                                        />
                                        <IndianRupee size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    </div>
                                </div>

                                <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', display: 'block' }}>
                                        Has your salary of ₹{Number(income) || 0} been credited for {new Date().toLocaleString('default', { month: 'long' })}?
                                    </label>
                                    <div className="credited-choice-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '12px' }}>
                                        <div 
                                            onClick={() => setIsCredited(true)}
                                            style={{
                                                background: isCredited ? '#ecfdf5' : '#ffffff',
                                                border: isCredited ? '2px solid #183630' : '1px solid var(--border)',
                                                padding: '12px', borderRadius: '10px', cursor: 'pointer'
                                            }}
                                        >
                                            <strong style={{ fontSize: '13px', color: isCredited ? '#183630' : 'var(--text-main)' }}>✓ Yes, Already Credited</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>Salary added to current balance</span>
                                        </div>

                                        <div 
                                            onClick={() => setIsCredited(false)}
                                            style={{
                                                background: !isCredited ? '#fffbeb' : '#ffffff',
                                                border: !isCredited ? '2px solid #b45309' : '1px solid var(--border)',
                                                padding: '12px', borderRadius: '10px', cursor: 'pointer'
                                            }}
                                        >
                                            <strong style={{ fontSize: '13px', color: !isCredited ? '#b45309' : 'var(--text-main)' }}>⏳ Pending Credit</strong>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>Show prompt on dashboard to confirm later</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button 
                                    type="button" 
                                    className="btn-secondary" 
                                    onClick={() => setStep(3)}
                                    style={{ flex: 1, padding: '14px' }}
                                >
                                    ← Back
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn-action" 
                                    disabled={loading}
                                    style={{ flex: 2, padding: '14px' }}
                                >
                                    {loading ? 'Completing Setup...' : 'Complete & Open Dashboard'} <ArrowRight size={18} />
                                </button>
                            </div>
                        </motion.form>
                    )}

                </div>
            </main>
        </div>
    );
};

export default Onboarding;
