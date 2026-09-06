const startOfDay = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

const sum = (items) => items.reduce((total, item) => total + Number(item.amount || 0), 0);
const formatINR = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

exports.analyzeTransactions = (transactions, now = new Date()) => {
    const expenses = transactions.filter((transaction) => transaction.type === 'expense');
    const incomes = transactions.filter((transaction) => transaction.type === 'income');
    if (!expenses.length) {
        return { alerts: [], summary: 'Log your income and expenses to unlock personalised spending insights.', mistakeTags: [] };
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const pastStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const currentByCategory = {};
    const pastByCategory = {};
    expenses.forEach((transaction) => {
        const date = new Date(transaction.date);
        const category = transaction.category.toLowerCase();
        if (date >= monthStart) currentByCategory[category] = (currentByCategory[category] || 0) + transaction.amount;
        if (date >= pastStart && date < monthStart) pastByCategory[category] = (pastByCategory[category] || 0) + transaction.amount;
    });

    const alerts = [];
    Object.entries(currentByCategory).forEach(([category, currentSpend]) => {
        const threeMonthAverage = (pastByCategory[category] || 0) / 3;
        if (threeMonthAverage > 0) {
            const percentage = ((currentSpend - threeMonthAverage) / threeMonthAverage) * 100;
            if (percentage > 20) alerts.push({ type: 'overspend', category, percentage: Math.round(percentage), title: `${category} spending is ${Math.round(percentage)}% above your 3-month average`, tag: `overspending-${category}` });
        }
    });

    const daily = {};
    expenses.filter((transaction) => new Date(transaction.date) < startOfDay(now)).forEach((transaction) => {
        const key = startOfDay(transaction.date).toISOString().slice(0, 10);
        daily[key] = (daily[key] || 0) + transaction.amount;
    });
    const values = Object.values(daily);
    if (values.length >= 3) {
        const mean = values.reduce((total, value) => total + value, 0) / values.length;
        const deviation = Math.sqrt(values.reduce((total, value) => total + ((value - mean) ** 2), 0) / values.length);
        const todaySpend = sum(expenses.filter((transaction) => startOfDay(transaction.date).getTime() === startOfDay(now).getTime()));
        if (todaySpend > mean + (1.5 * deviation)) alerts.push({ type: 'spike', category: 'daily-spending', title: 'Today’s spending is unusually high compared with your daily history', tag: 'impulse-shopping' });
    }

    const currentExpenses = expenses.filter((transaction) => new Date(transaction.date) >= monthStart);
    const categoryTotals = currentExpenses.reduce((totals, transaction) => {
        totals[transaction.category] = (totals[transaction.category] || 0) + Number(transaction.amount);
        return totals;
    }, {});
    const topCategory = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0];
    let summary;
    if (!incomes.length) {
        summary = `You have recorded ${formatINR(sum(expenses))} of expenses but no income yet. Add your income to calculate an accurate balance and savings rate.`;
    } else if (!currentExpenses.length) {
        summary = `You have recorded income, but no expenses for this month yet. Log day-to-day spending for useful category insights.`;
    } else if (alerts.length) {
        summary = `${alerts.length} spending pattern${alerts.length > 1 ? 's' : ''} need your attention. ${alerts[0].title}.`;
    } else {
        summary = `This month you have logged ${currentExpenses.length} expense${currentExpenses.length === 1 ? '' : 's'} totalling ${formatINR(sum(currentExpenses))}${topCategory ? `; your largest category is ${topCategory[0]} (${formatINR(topCategory[1])})` : ''}. Keep logging to build a 3-month baseline for overspend alerts.`;
    }
    return { alerts, summary, mistakeTags: alerts.map((alert) => alert.tag) };
};
