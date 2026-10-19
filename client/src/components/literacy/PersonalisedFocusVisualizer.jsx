// client/src/components/literacy/PersonalisedFocusVisualizer.jsx
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
    PieChart, 
    Pie, 
    Cell, 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    Tooltip, 
    Legend, 
    ResponsiveContainer, 
    LineChart, 
    Line,
    CartesianGrid
} from 'recharts';
import { 
    TrendingUp, 
    TrendingDown, 
    Target, 
    Wallet, 
    Sparkles, 
    ArrowRight, 
    HelpCircle, 
    AlertCircle, 
    ShieldCheck, 
    CheckCircle2, 
    Zap,
    BookOpen,
    Info,
    Calendar,
    Layers
} from 'lucide-react';
import { formatINR } from '../../utils/currency';

// Harmonious color palette matching the theme
const CATEGORY_COLORS = [
    '#183630', // Deep Forest Green
    '#E5C690', // Champagne Gold
    '#059669', // Emerald
    '#2563eb', // Royal Blue
    '#d97706', // Amber
    '#7c3aed', // Purple
    '#db2777', // Rose
    '#0891b2', // Teal
    '#4b5563'  // Slate
];

export default function PersonalisedFocusVisualizer({ 
    transactions = [], 
    goals = [], 
    userProfile = null, 
    recommendationData = null, 
    onExploreSimulator,
    onOpenLesson
}) {
    const [activeChartTab, setActiveChartTab] = useState('category'); // 'category' | 'income-expense' | 'budget-50-30-20' | 'goals'

    // Compute deterministic financial statistics from actual transactions
    const metrics = useMemo(() => {
        const expenses = transactions.filter(t => t.type === 'expense');
        const incomes = transactions.filter(t => t.type === 'income' && t.isCredited !== false);

        const totalExpense = expenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const totalIncome = incomes.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        
        // Income base: transactions or confirmed profile income
        const effectiveMonthlyIncome = totalIncome > 0 ? totalIncome : (Number(userProfile?.income) || 0);

        // Category breakdown
        const categoryMap = {};
        expenses.forEach(t => {
            const cat = t.category ? String(t.category).trim() : 'General';
            const normalizedCat = cat.charAt(0).toUpperCase() + cat.slice(1);
            categoryMap[normalizedCat] = (categoryMap[normalizedCat] || 0) + (Number(t.amount) || 0);
        });

        const categoryData = Object.entries(categoryMap)
            .map(([name, amount], index) => ({
                name,
                value: amount,
                percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
                color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
            }))
            .sort((a, b) => b.value - a.value);

        // 50/30/20 classification
        // Essentials (Needs): groceries, food, rent, bills, utility, health, commute, transport, education
        // Discretionary (Wants): dining out, shopping, entertainment, travel, electronics, leisure
        let needsTotal = 0;
        let wantsTotal = 0;

        expenses.forEach(t => {
            const cat = String(t.category || '').toLowerCase();
            const title = String(t.title || '').toLowerCase();
            const isNeed = /(rent|grocery|groceries|utilit|bill|electric|water|gas|health|medic|pharma|transit|commute|fuel|transport|education|tuition)/i.test(`${cat} ${title}`);
            const isDiscretionary = /(shopping|dining|restaurant|cafe|swiggy|zomato|movie|netflix|entertain|travel|trip|gadget|game|vacation)/i.test(`${cat} ${title}`);
            
            if (isNeed) {
                needsTotal += Number(t.amount) || 0;
            } else if (isDiscretionary) {
                wantsTotal += Number(t.amount) || 0;
            } else {
                // If General or Food without dining context, split 50/50 or default to needs
                if (cat.includes('food')) {
                    needsTotal += (Number(t.amount) || 0) * 0.6;
                    wantsTotal += (Number(t.amount) || 0) * 0.4;
                } else {
                    needsTotal += Number(t.amount) || 0;
                }
            }
        });

        needsTotal = Math.round(needsTotal);
        wantsTotal = Math.round(wantsTotal);
        const actualSavings = Math.max(0, effectiveMonthlyIncome - totalExpense);

        // Ideal 50/30/20 targets
        const idealNeeds = Math.round(effectiveMonthlyIncome * 0.50);
        const idealWants = Math.round(effectiveMonthlyIncome * 0.30);
        const idealSavings = Math.round(effectiveMonthlyIncome * 0.20);

        const budgetComparison = [
            {
                name: 'Needs (50%)',
                actual: needsTotal,
                ideal: idealNeeds,
                status: needsTotal <= idealNeeds ? 'Healthy' : 'Exceeding'
            },
            {
                name: 'Wants (30%)',
                actual: wantsTotal,
                ideal: idealWants,
                status: wantsTotal <= idealWants ? 'Healthy' : 'Exceeding'
            },
            {
                name: 'Savings (20%)',
                actual: actualSavings,
                ideal: idealSavings,
                status: actualSavings >= idealSavings ? 'Healthy' : 'Below Target'
            }
        ];

        // Active Goals data
        const goalData = goals
            .filter(g => g.status === 'active')
            .map(g => ({
                id: g._id,
                name: g.targetName,
                saved: Number(g.currentAmount) || 0,
                target: Number(g.targetAmount) || 1,
                percent: Math.min(100, Math.round(((Number(g.currentAmount) || 0) / (Number(g.targetAmount) || 1)) * 100))
            }));

        return {
            totalExpense,
            totalIncome,
            effectiveMonthlyIncome,
            categoryData,
            budgetComparison,
            needsTotal,
            wantsTotal,
            actualSavings,
            goalData,
            hasData: transactions.length > 0
        };
    }, [transactions, goals, userProfile]);

    // Derive evidence-based personalised learning lesson
    const primaryLesson = useMemo(() => {
        const topCategory = metrics.categoryData[0];
        const foodCategory = metrics.categoryData.find(c => c.name.toLowerCase().includes('food'));
        const shoppingCategory = metrics.categoryData.find(c => c.name.toLowerCase().includes('shop'));
        const savingsRate = metrics.effectiveMonthlyIncome > 0 
            ? Math.round((metrics.actualSavings / metrics.effectiveMonthlyIncome) * 100) 
            : 0;

        if (!metrics.hasData) {
            return {
                title: 'Start with Foundational Budgeting',
                badge: 'Welcome to Financial Tracking',
                observation: 'No transactions recorded yet.',
                evidence: 'Your financial ledger has 0 logged expenses and income items so far.',
                whyItMatters: 'Recording daily income and expenses gives you exact clarity on where your money flows and prevents cash crunches.',
                concept: 'The 50/30/20 Rule: Allocating every rupee into Needs, Wants, and Savings.',
                action: 'Log your first 3 expenses or salary credit on the Dashboard to see your personalized visual analytics.',
                whatIfQuery: 'What if I save 20% of my income every month?',
                targetLessonId: 'budgeting-50-30-20'
            };
        }

        // Case 1: Food spending represents over 25% of all expenses
        if (foodCategory && foodCategory.percentage >= 25 && foodCategory.value >= 1500) {
            return {
                title: 'Managing Food & Dining Out Pace',
                badge: 'Spending Pattern Detected',
                observation: `Food spending takes ${foodCategory.percentage}% of your total expenses.`,
                evidence: `You spent ${formatINR(foodCategory.value)} out of ${formatINR(metrics.totalExpense)} on Food & Dining.`,
                whyItMatters: 'Frequent food delivery and cafe purchases often add convenience markups and surge fees that quietly consume available cash buffer.',
                concept: 'Micro-Expense Compounding: How trimming just 1–2 delivery orders per week frees substantial annual liquidity.',
                action: 'Try setting a weekly food cap and cook 2 additional meals at home this week.',
                whatIfQuery: 'What if I reduce my food spending by 20%?',
                targetLessonId: 'food-dining-management'
            };
        }

        // Case 2: Shopping / discretionary spending takes > 30% of total expenses
        if (shoppingCategory && shoppingCategory.percentage >= 25 && shoppingCategory.value >= 2000) {
            return {
                title: 'Taming Shopping & Impulse Purchases',
                badge: 'High Discretionary Allocation',
                observation: `Shopping accounts for ${shoppingCategory.percentage}% of your expenses.`,
                evidence: `You spent ${formatINR(shoppingCategory.value)} on shopping out of ${formatINR(metrics.totalExpense)} total logged expenses.`,
                whyItMatters: 'Unplanned shopping purchases provide short-term dopamine but reduce liquidity needed for emergency peace of mind.',
                concept: 'The 24-Hour Rule: Adding non-essential desires to a wishlist for 24 hours to filter out impulse reactions.',
                action: 'Adopt the 24-hour pause rule for any shopping item over ₹1,000.',
                whatIfQuery: 'What if I reduce my shopping expenses by 15%?',
                targetLessonId: 'smart-purchase-filter'
            };
        }

        // Case 3: Wants exceed ideal 30% threshold
        if (metrics.effectiveMonthlyIncome > 0 && metrics.wantsTotal > metrics.effectiveMonthlyIncome * 0.35) {
            return {
                title: 'Rebalancing Wants vs. Needs',
                badge: 'Budget Allocation Opportunity',
                observation: `Flexible lifestyle spending is currently ${formatINR(metrics.wantsTotal)}, above the recommended 30% target of ${formatINR(Math.round(metrics.effectiveMonthlyIncome * 0.30))}.`,
                evidence: `Wants currently represent ${Math.round((metrics.wantsTotal / metrics.effectiveMonthlyIncome) * 100)}% of your monthly income.`,
                whyItMatters: 'When discretionary lifestyle spending exceeds 30%, it directly cannibalizes money that should build your emergency buffer.',
                concept: 'Intentional Spending: Maximizing enjoyment from fewer, high-satisfaction purchases while trimming mindless leaks.',
                action: 'Review recurring entertainment and dining habits to align flexible spending within the 30% target.',
                whatIfQuery: 'What if I reduce my flexible spending by 15%?',
                targetLessonId: 'budgeting-50-30-20'
            };
        }

        // Case 4: Healthy spending pace
        if (savingsRate >= 20 && metrics.totalExpense > 0) {
            return {
                title: 'Accelerating Wealth & Milestone Goals',
                badge: 'Strong Financial Health',
                observation: `You maintain a healthy ${savingsRate}% savings rate with spending well under control.`,
                evidence: `You have an estimated monthly surplus of ${formatINR(metrics.actualSavings)} out of ${formatINR(metrics.effectiveMonthlyIncome)} income.`,
                whyItMatters: 'A steady surplus is the ultimate springboard for long-term compounding and early financial freedom.',
                concept: 'Compound Interest & Systematic Wealth: Turning surplus cash into an engine that generates passive returns.',
                action: 'Put your monthly surplus to work by setting up a disciplined monthly SIP or emergency buffer.',
                whatIfQuery: `What if I save ${formatINR(Math.round(metrics.actualSavings * 0.5))} more every month?`,
                targetLessonId: 'compound-interest-wealth'
            };
        }

        // Default: General balanced optimization
        return {
            title: `Optimizing Your Top Expense: ${topCategory ? topCategory.name : 'Expenses'}`,
            badge: 'Category Insight',
            observation: topCategory ? `${topCategory.name} is your largest expense category (${topCategory.percentage}%).` : 'Reviewing your expense distribution.',
            evidence: topCategory ? `You have spent ${formatINR(topCategory.value)} on ${topCategory.name}.` : `Total expenses logged: ${formatINR(metrics.totalExpense)}.`,
            whyItMatters: 'Focusing on your largest expense category yields the highest financial return for your optimization efforts.',
            concept: 'The 80/20 Spending Principle: 20% of your categories cause 80% of your financial impact.',
            action: `Analyze your recent ${topCategory ? topCategory.name : 'expense'} transactions to spot 1 recurring charge you can trim.`,
            whatIfQuery: topCategory ? `What if I reduce ${topCategory.name} spending by 15%?` : 'What if I save ₹2,000 more every month?',
            targetLessonId: 'budgeting-50-30-20'
        };
    }, [metrics]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Visual Learning Header */}
            <div style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, #112722 100%)',
                color: '#ffffff',
                borderRadius: '16px',
                padding: '24px 28px',
                border: '1px solid var(--border-dark)',
                boxShadow: '0 8px 24px rgba(24, 54, 48, 0.12)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{
                            background: 'rgba(229, 198, 144, 0.2)',
                            color: 'var(--gold)',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            Data-Driven Financial Education
                        </span>
                    </div>
                    <h2 style={{
                        margin: 0,
                        fontSize: '24px',
                        fontWeight: 800,
                        letterSpacing: '-0.02em',
                        color: 'var(--text-light)'
                    }}>
                        Your Personalised Visual Learning Hub
                    </h2>
                    <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-dark-muted)', maxWidth: '650px' }}>
                        These interactive visualisations are derived from your authenticated transaction history and active goals. 
                        Every chart is designed to teach a concrete financial principle you can immediately act upon.
                    </p>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    border: '1px solid rgba(229, 198, 144, 0.2)'
                }}>
                    <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-dark-muted)', display: 'block' }}>Monthly Expenses</span>
                        <strong style={{ fontSize: '18px', color: 'var(--text-light)' }}>{formatINR(metrics.totalExpense)}</strong>
                    </div>
                    <div style={{ width: '1px', height: '32px', background: 'rgba(229, 198, 144, 0.2)' }} />
                    <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-dark-muted)', display: 'block' }}>Estimated Surplus</span>
                        <strong style={{ fontSize: '18px', color: metrics.actualSavings > 0 ? '#10b981' : 'var(--gold)' }}>
                            {formatINR(metrics.actualSavings)}
                        </strong>
                    </div>
                </div>
            </div>

            {/* Visualisations Card with Tabs */}
            <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                padding: '24px',
                boxShadow: '0 4px 16px rgba(24, 54, 48, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
            }}>
                {/* Chart Tab Navigation */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '14px'
                }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[
                            { id: 'category', label: '1. Spending Composition (Donut)' },
                            { id: 'income-expense', label: '2. Cash Flow (Income vs. Expense)' },
                            { id: 'budget-50-30-20', label: '3. 50/30/20 Budget Adherence' },
                            { id: 'goals', label: `4. Active Goals Progress (${metrics.goalData.length})` }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveChartTab(tab.id)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: activeChartTab === tab.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                                    background: activeChartTab === tab.id ? 'var(--primary)' : 'var(--bg-subtle)',
                                    color: activeChartTab === tab.id ? '#ffffff' : 'var(--text-main)',
                                    fontSize: '12px',
                                    fontWeight: activeChartTab === tab.id ? 700 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Info size={14} /> Currency formatted in INR (₹)
                    </span>
                </div>

                {/* TAB 1: CATEGORY SPENDING COMPOSITION (DONUT CHART) */}
                {activeChartTab === 'category' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
                                    Category Spending Distribution
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                                    Visual breakdown of how your expenses are divided across categories this month.
                                </p>
                            </div>
                            <div style={{
                                background: '#ecfdf5',
                                color: '#065f46',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                border: '1px solid #a7f3d0'
                            }}>
                                💡 Financial Lesson: The 80/20 rule — 20% of categories represent 80% of outflow
                            </div>
                        </div>

                        {metrics.categoryData.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'center' }}>
                                {/* Donut Chart */}
                                <div style={{ height: '260px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={metrics.categoryData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={95}
                                                paddingAngle={3}
                                                label={({ name, percentage }) => `${name} (${percentage}%)`}
                                            >
                                                {metrics.categoryData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => formatINR(value)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Category Legend Table */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Expense Breakdown by Share:
                                    </span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {metrics.categoryData.slice(0, 5).map((cat, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '10px 14px',
                                                    background: 'var(--bg-subtle)',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--border)'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: cat.color }} />
                                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                                                        {cat.name}
                                                    </span>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <strong style={{ fontSize: '13px', color: 'var(--text-main)', display: 'block' }}>
                                                        {formatINR(cat.value)}
                                                    </strong>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                        {cat.percentage}% of expenses
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                padding: '36px',
                                textAlign: 'center',
                                background: 'var(--bg-subtle)',
                                borderRadius: '12px',
                                border: '1px dashed var(--border)'
                            }}>
                                <AlertCircle size={28} color="var(--gold)" style={{ margin: '0 auto 8px auto' }} />
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: 'var(--text-main)' }}>
                                    No Expense Transactions Yet
                                </h4>
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                                    Log transactions on the Dashboard to see your category spending donut chart rendered live.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: CASH FLOW (INCOME VS EXPENSE COMPARISON) */}
                {activeChartTab === 'income-expense' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
                                    Monthly Cash Flow Comparison
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                                    Compares total cash inflow against total outflow to measure your monthly net surplus.
                                </p>
                            </div>
                            <div style={{
                                background: '#eff6ff',
                                color: '#1e40af',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                border: '1px solid #bfdbfe'
                            }}>
                                💡 Financial Lesson: Cash flow surplus determines your speed to financial resilience
                            </div>
                        </div>

                        <div style={{ height: '260px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[
                                        { category: 'Monthly Inflow (Income)', amount: metrics.effectiveMonthlyIncome, fill: '#059669' },
                                        { category: 'Monthly Outflow (Expenses)', amount: metrics.totalExpense, fill: '#dc2626' },
                                        { category: 'Net Monthly Surplus', amount: Math.max(0, metrics.actualSavings), fill: '#183630' }
                                    ]}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                >
                                    <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                                    <YAxis tickFormatter={(val) => `₹${val / 1000}k`} tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(value) => formatINR(value)} />
                                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                        {[
                                            <Cell key="cell-0" fill="#059669" />,
                                            <Cell key="cell-1" fill="#dc2626" />,
                                            <Cell key="cell-2" fill="#183630" />
                                        ]}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* TAB 3: 50/30/20 BUDGET BENCHMARK VS ACTUAL */}
                {activeChartTab === 'budget-50-30-20' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
                                    50/30/20 Budget Benchmark vs. Actual Spending
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                                    Compares your actual Needs, Wants, and Savings against universal healthy benchmarks based on your income ({formatINR(metrics.effectiveMonthlyIncome)}).
                                </p>
                            </div>
                            <div style={{
                                background: '#ecfdf5',
                                color: '#065f46',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                border: '1px solid #a7f3d0'
                            }}>
                                💡 Financial Lesson: 50% Essentials · 30% Lifestyle · 20% Wealth & Savings
                            </div>
                        </div>

                        <div style={{ height: '260px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={metrics.budgetComparison}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                >
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis tickFormatter={(val) => `₹${val / 1000}k`} tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(value) => formatINR(value)} />
                                    <Legend />
                                    <Bar dataKey="actual" name="Your Actual Spending (₹)" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="ideal" name="Ideal Target Benchmark (₹)" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* TAB 4: ACTIVE GOALS PROGRESS */}
                {activeChartTab === 'goals' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
                                    Active Financial Goals Progress
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                                    Tracks your real savings progress toward committed milestones and targets.
                                </p>
                            </div>
                            <div style={{
                                background: '#fef3c7',
                                color: '#92400e',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                border: '1px solid #fde68a'
                            }}>
                                💡 Financial Lesson: Reverse goal engineering — break large milestones into steady monthly habits
                            </div>
                        </div>

                        {metrics.goalData.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {metrics.goalData.map(goal => (
                                    <div
                                        key={goal.id}
                                        style={{
                                            padding: '16px 20px',
                                            borderRadius: '12px',
                                            background: 'var(--bg-subtle)',
                                            border: '1px solid var(--border)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Target size={18} color="var(--primary)" />
                                                <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                                                    {goal.name}
                                                </strong>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>
                                                    {formatINR(goal.saved)}
                                                </span>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    {' '}of {formatINR(goal.target)} ({goal.percent}%)
                                                </span>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div style={{
                                            height: '10px',
                                            background: '#e2e8f0',
                                            borderRadius: '999px',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${goal.percent}%`,
                                                background: goal.percent >= 100 ? '#10b981' : 'var(--primary)',
                                                borderRadius: '999px',
                                                transition: 'width 0.4s ease'
                                            }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{
                                padding: '36px',
                                textAlign: 'center',
                                background: 'var(--bg-subtle)',
                                borderRadius: '12px',
                                border: '1px dashed var(--border)'
                            }}>
                                <Target size={28} color="var(--primary)" style={{ margin: '0 auto 8px auto' }} />
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: 'var(--text-main)' }}>
                                    No Active Goals Found
                                </h4>
                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                                    Create a savings goal in the Goals Tracker to visualize your milestone pace and funding velocity.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Evidence-Based Personalised Lesson Card */}
            <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '2px solid var(--primary)',
                padding: '24px 28px',
                boxShadow: '0 6px 20px rgba(24, 54, 48, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            background: 'var(--primary)',
                            color: '#ffffff',
                            padding: '8px',
                            borderRadius: '10px'
                        }}>
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {primaryLesson.badge}
                            </span>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                                {primaryLesson.title}
                            </h3>
                        </div>
                    </div>

                    {primaryLesson.targetLessonId && onOpenLesson && (
                        <button
                            onClick={() => onOpenLesson(primaryLesson.targetLessonId)}
                            style={{
                                background: 'var(--bg-subtle)',
                                border: '1px solid var(--border)',
                                color: 'var(--primary)',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer'
                            }}
                        >
                            Open Full Interactive Lesson <ArrowRight size={14} />
                        </button>
                    )}
                </div>

                {/* 5-Point Educational Breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {/* Point 1: Observed Pattern */}
                    <div style={{ padding: '16px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <strong style={{ fontSize: '12px', color: 'var(--primary)', display: 'block', textTransform: 'uppercase' }}>
                            1. Observed Spending Pattern
                        </strong>
                        <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                            {primaryLesson.observation}
                        </p>
                    </div>

                    {/* Point 2: Supporting Real Data */}
                    <div style={{ padding: '16px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <strong style={{ fontSize: '12px', color: 'var(--primary)', display: 'block', textTransform: 'uppercase' }}>
                            2. Supporting Transaction Data
                        </strong>
                        <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                            {primaryLesson.evidence}
                        </p>
                    </div>

                    {/* Point 3: Financial Impact */}
                    <div style={{ padding: '16px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <strong style={{ fontSize: '12px', color: '#b45309', display: 'block', textTransform: 'uppercase' }}>
                            3. Why It Matters Financially
                        </strong>
                        <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                            {primaryLesson.whyItMatters}
                        </p>
                    </div>

                    {/* Point 4: Concept to Learn */}
                    <div style={{ padding: '16px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <strong style={{ fontSize: '12px', color: '#1d4ed8', display: 'block', textTransform: 'uppercase' }}>
                            4. Concept You Will Learn
                        </strong>
                        <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                            {primaryLesson.concept}
                        </p>
                    </div>
                </div>

                {/* Point 5: Practical Action & What-If Bridge */}
                <div style={{
                    padding: '18px 22px',
                    borderRadius: '12px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px'
                }}>
                    <div style={{ maxWidth: '520px' }}>
                        <strong style={{ fontSize: '12px', color: '#15803d', display: 'block', textTransform: 'uppercase' }}>
                            5. Practical Action to Try This Week
                        </strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#166534', fontWeight: 600, lineHeight: '1.5' }}>
                            {primaryLesson.action}
                        </p>
                    </div>

                    {primaryLesson.whatIfQuery && onExploreSimulator && (
                        <button
                            onClick={() => onExploreSimulator(primaryLesson.whatIfQuery)}
                            style={{
                                background: 'var(--primary)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '10px',
                                fontSize: '13px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(24, 54, 48, 0.2)'
                            }}
                        >
                            <Zap size={16} color="var(--gold)" />
                            Explore this scenario in What-If Simulator
                            <ArrowRight size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
