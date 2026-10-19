const { buildBenchmark } = require('./regionalBenchmark');

const sum = (items) => items.reduce((total, item) => total + Number(item.amount || 0), 0);
const dateKey = (date) => new Date(date).toISOString().slice(0, 10);

exports.buildFinancialDashboard = (transactions, goals, location, now = new Date(), openingBalance = 0) => {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const elapsedDays = Math.max(1, now.getDate());
    const remainingDays = Math.max(0, daysInMonth - elapsedDays);
    const expenses = transactions.filter((item) => item.type === 'expense');
    const currentExpenses = expenses.filter((item) => new Date(item.date) >= monthStart && new Date(item.date) < nextMonth);
    const currentIncome = sum(transactions.filter((item) => item.type === 'income' && item.isCredited !== false && new Date(item.date) >= monthStart && new Date(item.date) < nextMonth));
    const currentSpend = sum(currentExpenses);
    const totalBalance = openingBalance + sum(transactions.filter((item) => item.type === 'income' && item.isCredited !== false)) - sum(expenses);
    const averageDailySpend = currentSpend / elapsedDays;
    const projectedSpend = Math.round(averageDailySpend * daysInMonth);
    const benchmark = buildBenchmark(transactions, location);
    const budget = benchmark.adjustedBudgetLimit;
    const expectedSurplus = currentIncome ? currentIncome - projectedSpend : null;
    const daysUntilBroke = totalBalance > 0 && averageDailySpend > 0 ? Math.floor(totalBalance / averageDailySpend) : null;

    const historicalStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const currentByCategory = {};
    const historyByCategory = {};
    expenses.forEach((item) => {
        const date = new Date(item.date); const category = String(item.category || 'General'); const amount = Number(item.amount);
        if (date >= monthStart && date < nextMonth) currentByCategory[category] = (currentByCategory[category] || 0) + amount;
        if (date >= historicalStart && date < monthStart) historyByCategory[category] = (historyByCategory[category] || 0) + amount;
    });
    const categoryAlerts = Object.entries(currentByCategory).flatMap(([category, spent]) => {
        const historicalBudget = (historyByCategory[category] || 0) / 3 * benchmark.costIndex;
        const percentUsed = historicalBudget ? Math.round((spent / historicalBudget) * 100) : null;
        const percentMonth = Math.round((elapsedDays / daysInMonth) * 100);
        if (percentUsed !== null && percentUsed >= 75 && percentUsed > percentMonth) return [{ category, spent, budget: Math.round(historicalBudget), percentUsed, percentMonth, message: `You've used ${percentUsed}% of your ${category} guide, but only ${percentMonth}% of the month has passed.` }];
        return [];
    });

    const savingsThisMonth = sum(currentExpenses.filter((item) => String(item.category).toLowerCase() === 'savings'));
    const savingsPerDay = savingsThisMonth / elapsedDays;
    const goalProjections = goals.filter((goal) => goal.status === 'active').map((goal) => {
        const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.currentAmount));
        const projectedDays = savingsPerDay > 0 ? Math.ceil(remaining / savingsPerDay) : null;
        const daysToDeadline = goal.deadline ? Math.max(0, Math.ceil((new Date(goal.deadline) - now) / 86400000)) : null;
        return { id: goal._id, name: goal.targetName, target: goal.targetAmount, current: goal.currentAmount, remaining, projectedDays, daysToDeadline, onTrack: daysToDeadline === null || projectedDays === null ? null : projectedDays <= daysToDeadline };
    });
    return { forecast: { currentSpend, projectedSpend, budget, expectedSurplus, averageDailySpend, elapsedDays, remainingDays }, daysUntilBroke: { value: daysUntilBroke, balance: totalBalance, averageDailySpend, remainingDays }, categoryAlerts, goalProjections };
};
