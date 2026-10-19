const REGIONAL_COST_INDICES = {
    Mumbai: 1.3,
    Delhi: 1.2,
    Bengaluru: 1.2,
    Pune: 1.05,
    Hyderabad: 1,
    Chennai: 1,
    Kolkata: 0.9,
    Ahmedabad: 0.9,
    Jaipur: 0.8,
    'Tier 2': 0.8,
    'Tier 3': 0.65
};

const getRegionalIndex = (location) => REGIONAL_COST_INDICES[location] || 1;

const buildBenchmark = (transactions, location) => {
    const expenses = transactions.filter((transaction) => transaction.type === 'expense');
    const monthTotals = expenses.reduce((totals, transaction) => {
        const date = new Date(transaction.date);
        if (Number.isNaN(date.getTime())) return totals;
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        totals[key] = (totals[key] || 0) + Number(transaction.amount);
        return totals;
    }, {});
    const values = Object.values(monthTotals);
    const baselineMonthlySpend = values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
    const costIndex = getRegionalIndex(location);
    const adjustedBudgetLimit = baselineMonthlySpend === null ? null : Math.round(baselineMonthlySpend * costIndex);

    return { costIndex, baselineMonthlySpend, adjustedBudgetLimit, hasRegionalIndex: Boolean(REGIONAL_COST_INDICES[location]) };
};

module.exports = { buildBenchmark, getRegionalIndex };
