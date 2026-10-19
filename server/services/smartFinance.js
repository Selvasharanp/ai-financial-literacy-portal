const sum = (items) => items.reduce((total, item) => total + Number(item.amount || 0), 0);
const monthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const nextMonthStart = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 1);
const isSavings = (item) => String(item.category || '').trim().toLowerCase() === 'savings';

const monthData = (transactions, date) => {
    const from = monthStart(date);
    const until = nextMonthStart(date);
    const inMonth = (item) => new Date(item.date) >= from && new Date(item.date) < until;
    const expenses = transactions.filter((item) => item.type === 'expense' && inMonth(item));
    const income = transactions.filter((item) => item.type === 'income' && inMonth(item));
    return { expenses, income, expenseTotal: sum(expenses), incomeTotal: sum(income), savings: sum(expenses.filter(isSavings)) };
};

exports.simulate = (transactions, goals, input, now = new Date()) => {
    const base = monthData(transactions, now);
    const categorySpend = sum(base.expenses.filter((item) => String(item.category || '').toLowerCase() === String(input.category || '').toLowerCase()));
    let cashChange = 0;
    let monthlyGoalContribution = 0;
    if (input.type === 'reduce_category') { cashChange = categorySpend * (Number(input.percent) / 100); monthlyGoalContribution = cashChange; }
    else if (input.type === 'save_more') { cashChange = -Number(input.amount); monthlyGoalContribution = Number(input.amount); }
    else if (input.type === 'one_time_expense') cashChange = -Number(input.amount);

    const baseSurplus = base.incomeTotal - base.expenseTotal;
    const currentBalance = sum(transactions.filter((item) => item.type === 'income')) - sum(transactions.filter((item) => item.type === 'expense'));
    const usableSavings = Math.max(0, base.savings);
    return {
        baseSurplus,
        monthlySurplus: baseSurplus + cashChange,
        monthlySavings: usableSavings + monthlyGoalContribution,
        projectedBalance: currentBalance + cashChange,
        goalEffects: goals.filter((goal) => goal.status === 'active').map((goal) => {
            const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.currentAmount));
            const beforeMonths = usableSavings > 0 ? remaining / usableSavings : null;
            const afterMonthlyContribution = usableSavings + monthlyGoalContribution;
            const afterMonths = afterMonthlyContribution > 0 ? remaining / afterMonthlyContribution : null;
            return { name: goal.targetName, monthsFaster: beforeMonths !== null && afterMonths !== null ? Math.max(0, Math.round(beforeMonths - afterMonths)) : null, projectedMonths: afterMonths === null ? null : Math.ceil(afterMonths) };
        })
    };
};

exports.recurring = (transactions) => {
    const groups = {};
    transactions.filter((item) => item.type === 'expense').forEach((item) => { const key = String(item.title || '').trim().toLowerCase(); if (key) (groups[key] ??= []).push(item); });
    return Object.entries(groups).flatMap(([key, items]) => {
        const distinctMonths = new Set(items.map((item) => `${new Date(item.date).getFullYear()}-${new Date(item.date).getMonth()}`));
        if (distinctMonths.size < 2) return [];
        const monthlyCost = sum(items) / distinctMonths.size;
        return [{ key, title: items[0].title, transactionIds: items.map((item) => item._id), monthlyCost: Math.round(monthlyCost), annualCost: Math.round(monthlyCost * 12), preference: items.find((item) => item.recurringPreference !== 'unset')?.recurringPreference || 'unset' }];
    }).sort((a, b) => b.monthlyCost - a.monthlyCost);
};

exports.summary = (transactions, goals, health, previousHealth, now = new Date()) => {
    const current = monthData(transactions, now);
    const previous = monthData(transactions, new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const categories = {}, previousCategories = {};
    current.expenses.filter((item) => !isSavings(item)).forEach((item) => { categories[item.category] = (categories[item.category] || 0) + Number(item.amount); });
    previous.expenses.filter((item) => !isSavings(item)).forEach((item) => { previousCategories[item.category] = (previousCategories[item.category] || 0) + Number(item.amount); });
    const highest = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
    const biggestChange = [...new Set([...Object.keys(categories), ...Object.keys(previousCategories)])].map((category) => ({ category, amount: (categories[category] || 0) - (previousCategories[category] || 0) })).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0] || null;
    return {
        income: current.incomeTotal, expenses: current.expenseTotal, savings: current.savings,
        savingsRate: current.incomeTotal ? Math.round((current.savings / current.incomeTotal) * 100) : null,
        highestCategory: highest ? { name: highest[0], amount: highest[1] } : null,
        biggestChange, healthScore: health.score, healthScoreChange: previousHealth ? health.score - previousHealth.score : null,
        goalProgress: goals.map((goal) => ({ name: goal.targetName, current: goal.currentAmount, target: goal.targetAmount })), insight: health.label,
        recommendedAction: health.isManageableMonth
            ? (highest ? `Review ${highest[0]} spending before your next purchase.` : 'Your spending pace looks manageable for the remaining days.')
            : 'Focus on managing daily non-essential purchases for the remaining days of the month.'
    };
};

exports.challengeProgress = (challenge, transactions, now = new Date()) => {
    const finish = new Date(challenge.endsAt);
    const effectiveNow = now < finish ? now : finish;
    const from = new Date(challenge.startedAt);
    const expenses = transactions.filter((item) => item.type === 'expense' && !isSavings(item) && new Date(item.date) >= from && new Date(item.date) <= effectiveNow);
    const impulse = expenses.filter((item) => /shopping|entertainment/i.test(`${item.category} ${item.title}`));
    const daily = {};
    expenses.forEach((item) => { const key = new Date(item.date).toISOString().slice(0, 10); daily[key] = (daily[key] || 0) + Number(item.amount); });
    const elapsedDays = Math.min(7, Math.max(1, Math.floor((effectiveNow - from) / 86400000) + 1));
    const onTrack = challenge.type === 'no_impulse_buy' ? impulse.length === 0 : Object.values(daily).every((spent) => spent <= challenge.target);
    return { ...challenge.toObject(), elapsedDays, spent: sum(expenses), impulseSpend: sum(impulse), onTrack, streak: onTrack ? elapsedDays : 0 };
};
