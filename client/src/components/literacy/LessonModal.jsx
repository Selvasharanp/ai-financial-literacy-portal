// client/src/components/literacy/LessonModal.jsx
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, 
    BookOpen, 
    CheckCircle2, 
    Check, 
    ArrowRight, 
    Sparkles, 
    Zap, 
    HelpCircle, 
    Calculator, 
    Sliders, 
    CheckSquare, 
    TrendingUp, 
    BarChart3,
    Clock,
    Award
} from 'lucide-react';
import { 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell, 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    Tooltip, 
    Legend, 
    LineChart, 
    Line 
} from 'recharts';
import { formatINR } from '../../utils/currency';
import InteractiveFlowchart from './InteractiveFlowchart';

export default function LessonModal({ 
    lesson, 
    onClose, 
    userProfile, 
    transactions = [], 
    onExploreSimulator,
    isCompleted = false,
    onToggleComplete 
}) {
    if (!lesson) return null;

    const [activeSection, setActiveSection] = useState('overview'); // 'overview' | 'visual' | 'exercise' | 'quiz'
    
    // Quiz state: { [questionIdx]: selectedOptionIdx }
    const [quizAnswers, setQuizAnswers] = useState({});
    
    // Interactive Exercise state
    const [sliderIncome, setSliderIncome] = useState(lesson.interactiveExercise?.defaultIncome || 50000);
    const [trimmerDeliveries, setTrimmerDeliveries] = useState(lesson.interactiveExercise?.defaultCount || 2);
    const [purchasePrice, setPurchasePrice] = useState(lesson.interactiveExercise?.defaultPrice || 4500);
    const [emergencyMonths, setEmergencyMonths] = useState(lesson.interactiveExercise?.defaultMonths || 3);
    const [sipMonthly, setSipMonthly] = useState(lesson.interactiveExercise?.defaultMonthly || 3000);
    const [sipYears, setSipYears] = useState(lesson.interactiveExercise?.defaultYears || 10);
    
    // Subscriptions checklist exercise
    const [activeSubs, setActiveSubs] = useState([
        { name: 'Video Streaming (OTT)', cost: 299, active: true },
        { name: 'Music Streaming', cost: 199, active: true },
        { name: 'Fitness / Gym App', cost: 599, active: true },
        { name: 'Cloud Storage', cost: 130, active: true },
        { name: 'Gaming Subscription', cost: 499, active: false }
    ]);

    // Calculate worked example using user's real financial records
    const workedData = useMemo(() => {
        if (!lesson.workedExample?.calculate) return [];
        return lesson.workedExample.calculate(userProfile, transactions);
    }, [lesson, userProfile, transactions]);

    const hasRealUserData = useMemo(() => {
        return transactions.length > 0 || (userProfile?.income && userProfile.income > 0);
    }, [transactions, userProfile]);

    const handleAnswerQuiz = (qIdx, optIdx) => {
        if (quizAnswers[qIdx] !== undefined) return; // locked once answered
        setQuizAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
    };

    const quizScore = useMemo(() => {
        if (!lesson.quiz) return { answered: 0, correct: 0, total: 0 };
        const total = lesson.quiz.length;
        let correct = 0;
        let answered = 0;
        lesson.quiz.forEach((q, idx) => {
            if (quizAnswers[idx] !== undefined) {
                answered++;
                if (quizAnswers[idx] === q.correctIndex) correct++;
            }
        });
        return { answered, correct, total };
    }, [lesson.quiz, quizAnswers]);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(24, 54, 48, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 15 }}
                style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    width: '100%',
                    maxWidth: '860px',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(24, 54, 48, 0.25)',
                    border: '1px solid var(--border)'
                }}
            >
                {/* Modal Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            background: 'rgba(229, 198, 144, 0.2)',
                            color: 'var(--gold)',
                            padding: '8px',
                            borderRadius: '10px'
                        }}>
                            <BookOpen size={22} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    color: 'var(--gold)'
                                }}>
                                    {lesson.categoryLabel || lesson.category} · {lesson.difficulty}
                                </span>
                                <span style={{
                                    fontSize: '11px',
                                    color: 'var(--text-dark-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <Clock size={11} /> {lesson.estimatedMinutes} min
                                </span>
                            </div>
                            <h2 style={{
                                margin: '2px 0 0 0',
                                fontSize: '20px',
                                fontWeight: 800,
                                letterSpacing: '-0.02em',
                                color: 'var(--text-light)'
                            }}>
                                {lesson.title}
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ffffff',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '8px',
                            display: 'flex'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Section Navigation Tabs */}
                <div style={{
                    display: 'flex',
                    background: 'var(--bg-subtle)',
                    borderBottom: '1px solid var(--border)',
                    padding: '0 24px',
                    gap: '8px',
                    overflowX: 'auto'
                }}>
                    {[
                        { id: 'overview', label: '1. Lesson & Concept' },
                        { id: 'visual', label: '2. Visual Diagram & Math' },
                        { id: 'exercise', label: '3. Interactive Exercise' },
                        { id: 'quiz', label: `4. Knowledge Quiz (${quizScore.answered}/${quizScore.total})` }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSection(tab.id)}
                            style={{
                                padding: '12px 16px',
                                border: 'none',
                                background: 'transparent',
                                borderBottom: activeSection === tab.id ? '3px solid var(--primary)' : '3px solid transparent',
                                color: activeSection === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: activeSection === tab.id ? 700 : 500,
                                fontSize: '13px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Modal Body with Scroll */}
                <div style={{
                    padding: '24px',
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px'
                }}>
                    {/* SECTION 1: OVERVIEW & LEARNING OBJECTIVE */}
                    {activeSection === 'overview' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Learning Objective Box */}
                            <div style={{
                                background: '#eff6ff',
                                padding: '16px 20px',
                                borderRadius: '12px',
                                border: '1px solid #bfdbfe',
                                display: 'flex',
                                gap: '12px',
                                alignItems: 'flex-start'
                            }}>
                                <Sparkles size={20} color="#1d4ed8" style={{ marginTop: '2px', flexShrink: 0 }} />
                                <div>
                                    <strong style={{ fontSize: '13px', color: '#1e40af', display: 'block', textTransform: 'uppercase' }}>
                                        Learning Objective
                                    </strong>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#1e3a8a', lineHeight: '1.5' }}>
                                        {lesson.learningObjective}
                                    </p>
                                </div>
                            </div>

                            {/* Core Explanation */}
                            <div>
                                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 10px 0', color: 'var(--text-main)' }}>
                                    Core Financial Concept
                                </h3>
                                <div style={{
                                    fontSize: '14px',
                                    color: 'var(--text-main)',
                                    lineHeight: '1.7',
                                    whiteSpace: 'pre-line'
                                }}>
                                    {lesson.explanation}
                                </div>
                            </div>

                            {/* Practical Action Steps */}
                            {lesson.practicalSteps && (
                                <div style={{
                                    background: 'var(--bg-subtle)',
                                    padding: '20px',
                                    borderRadius: '14px',
                                    border: '1px solid var(--border)'
                                }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                                        💡 Practical Steps You Can Take Right Now:
                                    </h4>
                                    <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-main)' }}>
                                        {lesson.practicalSteps.map((step, idx) => (
                                            <li key={idx} style={{ lineHeight: '1.5' }}>{step}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Next Tab Button */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                                <button
                                    onClick={() => setActiveSection('visual')}
                                    style={{
                                        background: 'var(--primary)',
                                        color: '#ffffff',
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Explore Visual Model & Math <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SECTION 2: VISUAL DIAGRAMS & WORKED CALCULATIONS */}
                    {activeSection === 'visual' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Visual Chart or Diagram */}
                            {lesson.chartConfig && (
                                <div style={{
                                    background: '#ffffff',
                                    padding: '20px',
                                    borderRadius: '14px',
                                    border: '1px solid var(--border)'
                                }}>
                                    <h4 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 700 }}>
                                        📊 {lesson.chartConfig.title}
                                    </h4>
                                    
                                    {lesson.chartConfig.type === 'budget-allocation' && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                                            <div style={{ padding: '16px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>
                                                    Target 50/30/20 Ideal Allocation
                                                </span>
                                                <div style={{ height: '160px' }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie data={lesson.chartConfig.ideal} dataKey="percent" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${percent}%`}>
                                                                {lesson.chartConfig.ideal.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip formatter={(value) => `${value}%`} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                            <div style={{ padding: '16px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626', display: 'block', marginBottom: '8px' }}>
                                                    Common Lifestyle Creep Trap
                                                </span>
                                                <div style={{ height: '160px' }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie data={lesson.chartConfig.commonTrap} dataKey="percent" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${percent}%`}>
                                                                {lesson.chartConfig.commonTrap.map((entry, index) => (
                                                                    <Cell key={`cell-trap-${index}`} fill={entry.color} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip formatter={(value) => `${value}%`} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {lesson.chartConfig.type === 'cost-comparison' && (
                                        <div style={{ height: '220px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={lesson.chartConfig.data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                                                    <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                                                    <YAxis tickFormatter={(val) => `₹${val / 1000}k`} tick={{ fontSize: 11 }} />
                                                    <Tooltip formatter={(val) => formatINR(val)} />
                                                    <Legend />
                                                    <Bar dataKey="monthly" name="Monthly Cost" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="annual" name="Annual Cost" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}

                                    {lesson.chartConfig.type === 'compound-growth' && (
                                        <div style={{ height: '240px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={lesson.chartConfig.data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                                                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                                                    <YAxis tickFormatter={(val) => `₹${val / 1000}k`} tick={{ fontSize: 11 }} />
                                                    <Tooltip formatter={(val) => formatINR(val)} />
                                                    <Legend />
                                                    <Line type="monotone" dataKey="invested" name="Total Capital Invested" stroke="#64748b" strokeWidth={2} />
                                                    <Line type="monotone" dataKey="value" name="Compounded Portfolio Value" stroke="#059669" strokeWidth={3} dot={{ r: 4 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Interactive Flowchart Diagram */}
                            {lesson.flowchartId && (
                                <InteractiveFlowchart flowchartId={lesson.flowchartId} />
                            )}

                            {/* Step-by-Step Worked Example */}
                            {lesson.workedExample && (
                                <div style={{
                                    background: '#ffffff',
                                    padding: '20px',
                                    borderRadius: '14px',
                                    border: '1px solid var(--border)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                                                🧮 {lesson.workedExample.title}
                                            </h4>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                                                {lesson.workedExample.description}
                                            </p>
                                        </div>
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            background: hasRealUserData ? '#ecfdf5' : '#fffbeb',
                                            color: hasRealUserData ? '#047857' : '#b45309',
                                            border: hasRealUserData ? '1px solid #a7f3d0' : '1px solid #fde68a'
                                        }}>
                                            {hasRealUserData ? '✓ Calculated Using Your Real Records' : 'Hypothetical Baseline Example'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                        {workedData.map((item, idx) => (
                                            <div 
                                                key={idx}
                                                style={{
                                                    padding: '14px',
                                                    background: item.isBase ? 'var(--primary)' : 'var(--bg-subtle)',
                                                    color: item.isBase ? '#ffffff' : 'var(--text-main)',
                                                    borderRadius: '10px',
                                                    border: '1px solid var(--border)'
                                                }}
                                            >
                                                <span style={{ fontSize: '11px', fontWeight: 600, color: item.isBase ? 'var(--gold)' : 'var(--text-muted)', display: 'block' }}>
                                                    {item.label}
                                                </span>
                                                <strong style={{ fontSize: '18px', display: 'block', margin: '4px 0' }}>
                                                    {item.isText ? item.value : formatINR(item.value)}
                                                </strong>
                                                {item.note && (
                                                    <span style={{ fontSize: '11px', color: item.isBase ? '#e2e8f0' : '#64748b', lineHeight: '1.3', display: 'block' }}>
                                                        {item.note}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Navigation */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button
                                    onClick={() => setActiveSection('overview')}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid var(--border)',
                                        padding: '10px 16px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Back to Concept
                                </button>
                                <button
                                    onClick={() => setActiveSection('exercise')}
                                    style={{
                                        background: 'var(--primary)',
                                        color: '#ffffff',
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Try Interactive Exercise <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SECTION 3: INTERACTIVE EXERCISES */}
                    {activeSection === 'exercise' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{
                                background: '#ffffff',
                                padding: '24px',
                                borderRadius: '16px',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '20px'
                            }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                                        🛠️ {lesson.interactiveExercise?.title || 'Interactive Financial Exercise'}
                                    </h4>
                                    <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                                        {lesson.interactiveExercise?.instructions}
                                    </p>
                                </div>

                                {/* EXERCISE 1: BUDGET SLIDER */}
                                {lesson.interactiveExercise?.type === 'budget-slider' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: 700 }}>Adjust Monthly In-Hand Income:</span>
                                                <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>{formatINR(sliderIncome)}/mo</strong>
                                            </div>
                                            <input
                                                type="range"
                                                min={lesson.interactiveExercise.min || 15000}
                                                max={lesson.interactiveExercise.max || 200000}
                                                step={lesson.interactiveExercise.step || 5000}
                                                value={sliderIncome}
                                                onChange={(e) => setSliderIncome(Number(e.target.value))}
                                                style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                                            />
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #183630' }}>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>Needs Budget (50%)</span>
                                                <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0' }}>{formatINR(Math.round(sliderIncome * 0.50))}</h4>
                                                <span style={{ fontSize: '12px', color: '#64748b' }}>For rent, food groceries, utilities</span>
                                            </div>
                                            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid #E5C690' }}>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>Wants Budget (30%)</span>
                                                <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0' }}>{formatINR(Math.round(sliderIncome * 0.30))}</h4>
                                                <span style={{ fontSize: '12px', color: '#64748b' }}>For dining out, shopping, entertainment</span>
                                            </div>
                                            <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', borderLeft: '4px solid #059669' }}>
                                                <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 700 }}>Savings & Goals (20%)</span>
                                                <h4 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0', color: '#15803d' }}>{formatINR(Math.round(sliderIncome * 0.20))}</h4>
                                                <span style={{ fontSize: '12px', color: '#166534' }}>Directly to buffer or investments</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* EXERCISE 2: EXPENSE TRIMMER */}
                                {lesson.interactiveExercise?.type === 'expense-trimmer' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 600 }}>Deliveries replaced per week:</span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {[1, 2, 3, 4, 5].map(num => (
                                                    <button
                                                        key={num}
                                                        onClick={() => setTrimmerDeliveries(num)}
                                                        style={{
                                                            width: '38px',
                                                            height: '38px',
                                                            borderRadius: '8px',
                                                            border: trimmerDeliveries === num ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                            background: trimmerDeliveries === num ? 'var(--primary)' : '#ffffff',
                                                            color: trimmerDeliveries === num ? '#ffffff' : 'var(--text-main)',
                                                            fontWeight: 700,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {num}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                                            <div style={{ padding: '16px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Weekly Savings</span>
                                                <h4 style={{ fontSize: '22px', fontWeight: 800, color: '#059669', margin: '4px 0' }}>
                                                    +{formatINR(trimmerDeliveries * 250)}
                                                </h4>
                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Saving ₹250 difference per meal</span>
                                            </div>
                                            <div style={{ padding: '16px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Monthly Savings</span>
                                                <h4 style={{ fontSize: '22px', fontWeight: 800, color: '#059669', margin: '4px 0' }}>
                                                    +{formatINR(Math.round(trimmerDeliveries * 250 * 4.33))}
                                                </h4>
                                                <span style={{ fontSize: '11px', color: '#64748b' }}>Added directly to surplus</span>
                                            </div>
                                            <div style={{ padding: '16px', background: '#ecfdf5', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                                                <span style={{ fontSize: '12px', color: '#047857', fontWeight: 600 }}>Annual Cash Reclaimed</span>
                                                <h4 style={{ fontSize: '24px', fontWeight: 800, color: '#047857', margin: '4px 0' }}>
                                                    +{formatINR(trimmerDeliveries * 250 * 52)}
                                                </h4>
                                                <span style={{ fontSize: '11px', color: '#065f46' }}>Enough for a flight or emergency buffer!</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* EXERCISE 3: SUBSCRIPTION TOGGLE */}
                                {lesson.interactiveExercise?.type === 'subscription-toggle' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                                            {activeSubs.map((sub, idx) => (
                                                <div 
                                                    key={idx}
                                                    onClick={() => {
                                                        const next = [...activeSubs];
                                                        next[idx].active = !next[idx].active;
                                                        setActiveSubs(next);
                                                    }}
                                                    style={{
                                                        padding: '12px 14px',
                                                        borderRadius: '10px',
                                                        border: sub.active ? '1px solid var(--primary)' : '1px dashed var(--border)',
                                                        background: sub.active ? '#ffffff' : 'var(--bg-subtle)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <div>
                                                        <span style={{ fontSize: '13px', fontWeight: 600, display: 'block', color: sub.active ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                                            {sub.name}
                                                        </span>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatINR(sub.cost)}/mo</span>
                                                    </div>
                                                    <span style={{
                                                        fontSize: '11px',
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        background: sub.active ? 'var(--primary)' : '#e2e8f0',
                                                        color: sub.active ? '#ffffff' : '#64748b',
                                                        fontWeight: 700
                                                    }}>
                                                        {sub.active ? 'Active' : 'Cancelled'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Summary of cancellations */}
                                        {(() => {
                                            const cancelled = activeSubs.filter(s => !s.active);
                                            const monthlySaved = cancelled.reduce((s, c) => s + c.cost, 0);
                                            return (
                                                <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                                    <div>
                                                        <span style={{ fontSize: '12px', color: '#166534', fontWeight: 700 }}>
                                                            Cancelled {cancelled.length} Services:
                                                        </span>
                                                        <h4 style={{ fontSize: '20px', fontWeight: 800, color: '#15803d', margin: '2px 0 0 0' }}>
                                                            Save +{formatINR(monthlySaved)}/month ({formatINR(monthlySaved * 12)}/year)
                                                        </h4>
                                                    </div>
                                                    <span style={{ fontSize: '12px', color: '#166534' }}>
                                                        Click any card above to toggle active status
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* EXERCISE 4: SIP COMPOUND GROWTH CALCULATOR */}
                                {lesson.interactiveExercise?.type === 'sip-calculator' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                                            <div>
                                                <span style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Monthly SIP: {formatINR(sipMonthly)}</span>
                                                <input
                                                    type="range"
                                                    min={1000}
                                                    max={25000}
                                                    step={500}
                                                    value={sipMonthly}
                                                    onChange={(e) => setSipMonthly(Number(e.target.value))}
                                                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                                                />
                                            </div>
                                            <div>
                                                <span style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Time Horizon: {sipYears} Years</span>
                                                <input
                                                    type="range"
                                                    min={3}
                                                    max={25}
                                                    step={1}
                                                    value={sipYears}
                                                    onChange={(e) => setSipYears(Number(e.target.value))}
                                                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                                                />
                                            </div>
                                        </div>

                                        {(() => {
                                            const totalInvested = sipMonthly * 12 * sipYears;
                                            const monthlyRate = 0.12 / 12;
                                            const totalMonths = sipYears * 12;
                                            const futureVal = Math.round(sipMonthly * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate));
                                            const gains = futureVal - totalInvested;
                                            return (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                                    <div style={{ padding: '14px', background: 'var(--bg-subtle)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Invested</span>
                                                        <strong style={{ fontSize: '18px', display: 'block', margin: '4px 0' }}>{formatINR(totalInvested)}</strong>
                                                    </div>
                                                    <div style={{ padding: '14px', background: 'var(--bg-subtle)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Estimated Growth (12%)</span>
                                                        <strong style={{ fontSize: '18px', color: '#059669', display: 'block', margin: '4px 0' }}>+{formatINR(gains)}</strong>
                                                    </div>
                                                    <div style={{ padding: '14px', background: 'var(--primary)', color: '#ffffff', borderRadius: '10px' }}>
                                                        <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 600 }}>Total Future Wealth</span>
                                                        <strong style={{ fontSize: '20px', display: 'block', margin: '4px 0' }}>{formatINR(futureVal)}</strong>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>

                            {/* What-If Simulator Action Bridge */}
                            {lesson.whatIfQuery && onExploreSimulator && (
                                <div style={{
                                    background: 'var(--bg-subtle)',
                                    padding: '18px 20px',
                                    borderRadius: '14px',
                                    border: '1px solid var(--border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '14px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Zap size={22} color="var(--primary)" />
                                        <div>
                                            <strong style={{ fontSize: '14px', color: 'var(--text-main)', display: 'block' }}>
                                                Simulate this scenario with your real data:
                                            </strong>
                                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                "{lesson.whatIfQuery}"
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            onExploreSimulator(lesson.whatIfQuery);
                                            onClose();
                                        }}
                                        style={{
                                            background: 'var(--primary)',
                                            color: '#ffffff',
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Explore in What-If Simulator <ArrowRight size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Navigation */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button
                                    onClick={() => setActiveSection('visual')}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid var(--border)',
                                        padding: '10px 16px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Back to Visual Model
                                </button>
                                <button
                                    onClick={() => setActiveSection('quiz')}
                                    style={{
                                        background: 'var(--primary)',
                                        color: '#ffffff',
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Take Knowledge Quiz <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SECTION 4: KNOWLEDGE CHECK QUIZ */}
                    {activeSection === 'quiz' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                                        🎯 Knowledge Check
                                    </h4>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                                        Test your understanding of this financial concept. Immediate explanations are provided!
                                    </p>
                                </div>
                                <span style={{
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    background: 'var(--bg-subtle)',
                                    color: 'var(--text-main)'
                                }}>
                                    Score: {quizScore.correct} / {quizScore.total}
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {lesson.quiz?.map((q, qIdx) => {
                                    const selected = quizAnswers[qIdx];
                                    const isAnswered = selected !== undefined;
                                    const isCorrect = selected === q.correctIndex;

                                    return (
                                        <div
                                            key={qIdx}
                                            style={{
                                                padding: '20px',
                                                borderRadius: '14px',
                                                border: '1px solid var(--border)',
                                                background: '#ffffff',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '14px'
                                            }}
                                        >
                                            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                                                {qIdx + 1}. {q.question}
                                            </span>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {q.options.map((opt, optIdx) => {
                                                    let btnBg = '#f8fafc';
                                                    let btnBorder = '#e2e8f0';
                                                    let btnColor = 'var(--text-main)';

                                                    if (isAnswered) {
                                                        if (optIdx === q.correctIndex) {
                                                            btnBg = '#ecfdf5';
                                                            btnBorder = '#10b981';
                                                            btnColor = '#065f46';
                                                        } else if (optIdx === selected) {
                                                            btnBg = '#fef2f2';
                                                            btnBorder = '#ef4444';
                                                            btnColor = '#991b1b';
                                                        }
                                                    }

                                                    return (
                                                        <button
                                                            key={optIdx}
                                                            onClick={() => handleAnswerQuiz(qIdx, optIdx)}
                                                            disabled={isAnswered}
                                                            style={{
                                                                padding: '12px 16px',
                                                                borderRadius: '10px',
                                                                border: `1px solid ${btnBorder}`,
                                                                background: btnBg,
                                                                color: btnColor,
                                                                textAlign: 'left',
                                                                fontSize: '13px',
                                                                fontWeight: isAnswered && optIdx === q.correctIndex ? 700 : 500,
                                                                cursor: isAnswered ? 'default' : 'pointer',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center'
                                                            }}
                                                        >
                                                            <span>{opt}</span>
                                                            {isAnswered && optIdx === q.correctIndex && (
                                                                <CheckCircle2 size={16} color="#059669" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Explanation feedback */}
                                            {isAnswered && (
                                                <div style={{
                                                    padding: '12px 14px',
                                                    borderRadius: '8px',
                                                    background: isCorrect ? '#f0fdf4' : '#fffbeb',
                                                    border: isCorrect ? '1px solid #bbf7d0' : '1px solid #fde68a',
                                                    fontSize: '12px',
                                                    color: isCorrect ? '#166534' : '#92400e',
                                                    lineHeight: '1.4'
                                                }}>
                                                    <strong>{isCorrect ? '✓ Correct!' : 'Insight:'}</strong> {q.explanation}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Complete lesson button */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                paddingTop: '16px',
                                borderTop: '1px solid var(--border)'
                            }}>
                                <button
                                    onClick={() => setActiveSection('exercise')}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid var(--border)',
                                        padding: '10px 16px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Back to Exercise
                                </button>

                                <button
                                    onClick={() => {
                                        if (onToggleComplete) onToggleComplete(lesson.id);
                                    }}
                                    style={{
                                        padding: '10px 24px',
                                        borderRadius: '10px',
                                        background: isCompleted ? '#059669' : 'var(--primary)',
                                        color: '#ffffff',
                                        border: 'none',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {isCompleted ? (
                                        <>
                                            <Check size={16} /> Completed (Click to Toggle)
                                        </>
                                    ) : (
                                        <>
                                            <Award size={16} /> Mark Lesson Completed
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
