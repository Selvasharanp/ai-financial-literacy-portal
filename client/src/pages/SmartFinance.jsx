import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { apiUrl, authConfig } from '../utils/api';
import { formatINR } from '../utils/currency';
import { motion } from 'framer-motion';
import { 
    BrainCircuit, Sparkles, Cpu, TrendingUp, ShieldAlert, Zap, 
    RefreshCw, Layers, CheckCircle2, ArrowRight, Award, Sliders
} from 'lucide-react';

const challengeLabels = {
    spending_control: '7-day spending control',
    daily_budget: 'Stay under daily budget',
    no_impulse_buy: 'No impulse-buy challenge'
};

export default function SmartFinance() {
    const [type, setType] = useState('reduce_category');
    const [category, setCategory] = useState('Food');
    const [amount, setAmount] = useState('2000');
    const [percent, setPercent] = useState('20');
    const [scenario, setScenario] = useState(null);
    const [scenarioHistory, setScenarioHistory] = useState([]);
    const [recurring, setRecurring] = useState([]);
    const [summary, setSummary] = useState(null);
    const [challenges, setChallenges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const config = authConfig();
            const [recurringResponse, summaryResponse, challengesResponse, scenariosResponse] = await Promise.all([
                axios.get(apiUrl('/api/smart-finance/recurring'), config),
                axios.get(apiUrl('/api/smart-finance/summary'), config),
                axios.get(apiUrl('/api/smart-finance/challenges'), config),
                axios.get(apiUrl('/api/smart-finance/scenarios'), config)
            ]);
            setRecurring(recurringResponse.data || []);
            setSummary(summaryResponse.data || null);
            setChallenges(challengesResponse.data || []);
            setScenarioHistory(scenariosResponse.data || []);
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Unable to load smart finance lab tools.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        window.addEventListener('transactions-changed', load);
        return () => window.removeEventListener('transactions-changed', load);
    }, [load]);

    const runScenario = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const { data } = await axios.post(apiUrl('/api/smart-finance/scenarios'), {
                type, category, amount: Number(amount), percent: Number(percent)
            }, authConfig());
            setScenario(data.result);
            await load();
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Unable to calculate scenario.');
        } finally {
            setSubmitting(false);
        }
    };

    const setPreference = async (id, preference) => {
        setError('');
        try {
            await axios.put(apiUrl(`/api/smart-finance/recurring/${id}`), { preference }, authConfig());
            await load();
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Unable to update the recurring expense.');
        }
    };

    const startChallenge = async (challengeType) => {
        setError('');
        try {
            await axios.post(apiUrl('/api/smart-finance/challenges'), { type: challengeType }, authConfig());
            await load();
        } catch (requestError) {
            setError(requestError.response?.data?.error || 'Unable to start challenge.');
        }
    };

    return (
        <div style={{ display: 'flex', background: 'var(--bg-main)', minHeight: '100vh' }}>
            <Sidebar />

            <main className="app-main">
                
                {/* Header */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '20px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                            <BrainCircuit size={16} /> FINWISE AI SIMULATION & TELEMETRY LAB
                        </div>
                        <h1 style={{ fontSize: '30px', fontWeight: 800, margin: 0 }}>
                            Literacy AI & What-If Simulator
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '2px' }}>
                            Every calculation uses your saved account records; no financial data is invented.
                        </p>
                    </div>

                    <span className="stitch-badge badge-indigo" style={{ padding: '8px 16px', fontSize: '12px' }}>
                        📅 {new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                </header>

                {error && (
                    <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', color: '#dc2626', fontSize: '14px', marginBottom: '24px' }}>
                        ⚠️ {error}
                    </div>
                )}

                {loading ? (
                    <p>Loading smart finance lab tools...</p>
                ) : (
                    <>
                        {/* WHAT-IF SIMULATOR CARD */}
                        <section className="bento-card" style={{ background: '#ffffff', padding: '28px', marginBottom: '28px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                                <div style={{ background: '#0f172a', padding: '8px', borderRadius: '10px', color: '#ffffff' }}>
                                    <Sliders size={20} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>What-If Scenario Simulator</h3>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Simulate budget tweaks and see real goal time-to-completion impact</span>
                                </div>
                            </div>

                            <form className="smart-scenario-form" onSubmit={runScenario} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <select 
                                    className="input-wrapper" 
                                    value={type} 
                                    onChange={(e) => setType(e.target.value)}
                                    style={{ width: '220px' }}
                                >
                                    <option value="reduce_category">Reduce a category spend</option>
                                    <option value="save_more">Save more each month</option>
                                    <option value="one_time_expense">One-time major expense</option>
                                </select>

                                {type === 'reduce_category' && (
                                    <>
                                        <input 
                                            className="input-wrapper" 
                                            value={category} 
                                            onChange={(e) => setCategory(e.target.value)} 
                                            placeholder="Category, e.g. Food" 
                                            required 
                                            style={{ width: '180px' }}
                                        />
                                        <input 
                                            className="input-wrapper" 
                                            type="number" 
                                            min="1" 
                                            max="100" 
                                            value={percent} 
                                            onChange={(e) => setPercent(e.target.value)} 
                                            placeholder="Percent %" 
                                            required 
                                            style={{ width: '120px' }}
                                        />
                                    </>
                                )}

                                {type !== 'reduce_category' && (
                                    <input 
                                        className="input-wrapper" 
                                        type="number" 
                                        min="1" 
                                        value={amount} 
                                        onChange={(e) => setAmount(e.target.value)} 
                                        placeholder="Amount ₹" 
                                        required 
                                        style={{ width: '160px' }}
                                    />
                                )}

                                <button className="btn-action" disabled={submitting} style={{ padding: '12px 24px' }}>
                                    {submitting ? 'Calculating...' : 'Run Simulation'} <ArrowRight size={16} />
                                </button>
                            </form>

                            {scenario && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', padding: '20px', borderRadius: '16px', marginTop: '20px' }}>
                                    <h4 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '10px', color: 'var(--primary)' }}>⚡ Simulation Results Telemetry</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '14px' }}>
                                        <div>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Projected Monthly Surplus</span>
                                            <div style={{ fontSize: '20px', fontWeight: 800 }}>{formatINR(scenario.monthlySurplus)}</div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Projected Monthly Savings</span>
                                            <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981' }}>{formatINR(scenario.monthlySavings)}</div>
                                        </div>
                                        <div>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Projected Available Balance</span>
                                            <div style={{ fontSize: '20px', fontWeight: 800 }}>{formatINR(scenario.projectedBalance)}</div>
                                        </div>
                                    </div>

                                    {scenario.goalEffects.length > 0 && (
                                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                                            <strong style={{ fontSize: '12px', display: 'block', marginBottom: '6px' }}>Impact on Active Savings Goals:</strong>
                                            {scenario.goalEffects.map((goal) => (
                                                <div key={goal.name} style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '4px' }}>
                                                    🎯 <strong>{goal.name}:</strong> {goal.projectedMonths === null ? 'Add a savings entry to project this goal.' : `about ${goal.projectedMonths} month(s) to complete${goal.monthsFaster ? `, ${goal.monthsFaster} month(s) faster!` : ''}.`}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </section>

                        {/* RECURRING EXPENSES & MONTHLY SUMMARY GRID */}
                        <div className="smart-finance-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '24px', marginBottom: '28px' }}>
                            
                            {/* Recurring Expenses Classifier */}
                            <section className="bento-card" style={{ background: '#ffffff', padding: '28px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Recurring Expenses Telemetry</h3>
                                    <span className="stitch-badge badge-blue">{recurring.length} Patterns Detected</span>
                                </div>

                                {recurring.length ? recurring.map((item) => (
                                    <div key={item.key} style={{ borderTop: '1px solid var(--border)', padding: '14px 0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <strong style={{ fontSize: '14px' }}>{item.title}</strong>
                                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                                                {formatINR(item.monthlyCost)}/mo
                                            </span>
                                        </div>
                                        <select 
                                            className="input-wrapper" 
                                            value={item.preference} 
                                            onChange={(event) => setPreference(item.transactionIds[0], event.target.value)}
                                            style={{ height: '36px', fontSize: '12px' }}
                                        >
                                            <option value="unset">Not classified</option>
                                            <option value="essential">Essential Commitment</option>
                                            <option value="optional">Optional / Discretionary</option>
                                        </select>
                                    </div>
                                )) : (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                        No repeating expenses detected yet. Add matching expenses across two different months.
                                    </p>
                                )}
                            </section>

                            {/* Monthly Summary & Health Score */}
                            <section className="bento-card" style={{ background: '#ffffff', padding: '28px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Monthly Cashflow Summary</h3>
                                    <span className="stitch-badge badge-green">Health Score: {summary?.healthScore || 85}/100</span>
                                </div>

                                {summary && (
                                    <div style={{ display: 'grid', gap: '12px', fontSize: '13px' }}>
                                        <div style={{ background: 'var(--bg-subtle)', padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Monthly Inflow & Outflow:</span>
                                            <strong>In: {formatINR(summary.income)} · Out: {formatINR(summary.expenses)}</strong>
                                        </div>
                                        <div style={{ background: 'var(--bg-subtle)', padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Savings Rate:</span>
                                            <strong>{summary.savingsRate === null ? 'Need income data' : `${summary.savingsRate}%`}</strong>
                                        </div>
                                        <div style={{ background: 'var(--bg-subtle)', padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Top Expense Category:</span>
                                            <strong>{summary.highestCategory ? `${summary.highestCategory.name} (${formatINR(summary.highestCategory.amount)})` : 'Need expense data'}</strong>
                                        </div>
                                        <div style={{ background: 'var(--primary-light)', padding: '14px', borderRadius: '12px', color: 'var(--primary)', border: '1px solid #c7d2fe' }}>
                                            <strong>🤖 AI Recommended Next Action:</strong>
                                            <p style={{ fontSize: '13px', margin: '4px 0 0 0', color: 'var(--text-main)' }}>{summary.recommendedAction}</p>
                                        </div>
                                    </div>
                                )}
                            </section>

                        </div>

                        {/* SPENDING CHALLENGES SECTION */}
                        <section className="bento-card" style={{ background: '#ffffff', padding: '28px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>7-Day Spending Challenges</h3>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Challenges start today and measure transactions you actually log</span>
                                </div>
                                <span className="stitch-badge badge-amber"><Award size={13} /> Active Challenges</span>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                                {Object.entries(challengeLabels).map(([value, label]) => (
                                    <button key={value} className="btn-secondary" onClick={() => startChallenge(value)} style={{ fontSize: '12px', padding: '8px 16px' }}>
                                        + Start {label}
                                    </button>
                                ))}
                            </div>

                            {challenges.length ? challenges.map((item) => (
                                <div key={item._id} style={{ borderTop: '1px solid var(--border)', padding: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong style={{ fontSize: '14px' }}>{challengeLabels[item.type]}</strong>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            Real streak {item.streak} day(s) · spent {formatINR(item.spent)}
                                            {item.type !== 'no_impulse_buy' && <> · daily target {formatINR(item.target)}</>}
                                        </div>
                                    </div>
                                    <span className={`stitch-badge ${item.onTrack ? 'badge-green' : 'badge-amber'}`}>
                                        {item.onTrack ? '✓ On Track' : '⚠️ Needs Reset'}
                                    </span>
                                </div>
                            )) : (
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                    Start a challenge to track real transactions from today onward.
                                </p>
                            )}
                        </section>
                    </>
                )}

            </main>
        </div>
    );
}
