const money = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(amount) || 0);
const sum = (items) => items.reduce((total, item) => total + Number(item.amount || 0), 0);
const issue = (type, tag, title, whatHappened, whyItMatters, friendlyExplanation, action, metrics = {}, priority = 'MEDIUM') => ({
    type,
    tag,
    title,
    whatHappened,
    whyItMatters,
    friendlyExplanation,
    action,
    metrics,
    priority // 'HIGH', 'MEDIUM', 'LOW'
});

exports.analyzeTransactions = (transactions = [], goals = [], now = new Date(), openingBalance = 0) => {
    const expenses = transactions.filter((item) => item.type === 'expense');
    const incomes = transactions.filter((item) => item.type === 'income' && item.isCredited !== false);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
    const historyStart = new Date(now.getFullYear(), now.getMonth() - 3, 1, 0, 0, 0);

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const elapsedDays = Math.max(1, now.getDate());
    const remainingDays = Math.max(0, daysInMonth - elapsedDays);

    const currentExpenses = expenses.filter((item) => new Date(item.date) >= monthStart && new Date(item.date) < nextMonthStart);
    const currentIncomes = incomes.filter((item) => new Date(item.date) >= monthStart && new Date(item.date) < nextMonthStart);

    const currentIncome = sum(currentIncomes);
    const currentSpend = sum(currentExpenses);

    // Available balance calculation
    const totalIncome = sum(incomes);
    const totalExpenses = sum(expenses);
    const balance = openingBalance + totalIncome - totalExpenses;

    // Spending pace & month management calculations
    const averageDailySpend = elapsedDays > 0 ? (currentSpend / elapsedDays) : 0;
    const estimatedRemainingSpend = Math.round(averageDailySpend * remainingDays);
    const isManageableMonth = remainingDays === 0 ? true : (balance >= estimatedRemainingSpend);

    // Data Confidence determination
    const historyExpenses = expenses.filter((item) => new Date(item.date) >= historyStart && new Date(item.date) < monthStart);
    let dataConfidence = 'multi_month';
    if (transactions.length < 3) {
        dataConfidence = 'very_little_data';
    } else if (historyExpenses.length === 0) {
        dataConfidence = 'one_month';
    }

    const current = {};
    const history = {};
    const alerts = [];

    // Category breakdown
    expenses.forEach((item) => {
        const date = new Date(item.date);
        const category = String(item.category || 'General').toLowerCase();
        const amount = Number(item.amount || 0);
        if (date >= monthStart && date < nextMonthStart) {
            current[category] = (current[category] || 0) + amount;
        }
        if (date >= historyStart && date < monthStart) {
            history[category] = (history[category] || 0) + amount;
        }
    });

    const toDateKey = (d) => {
        const date = new Date(d);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    // 1. DATA CONFIDENCE: Limited Data Handling
    if (dataConfidence === 'very_little_data') {
        alerts.push(issue(
            'data-confidence',
            'limited-data-notice',
            'Building your financial pattern profile',
            `You have recorded ${transactions.length} transaction(s) so far. Analysis and remaining month estimates are based on limited transaction activity.`,
            'Logging regular income and expense activity unlocks richer category insights and trend forecasting.',
            "You've recently started tracking your finances. Explore these baseline numbers while we learn your spending patterns.",
            'Log your daily income and expense transactions to refine your personalized financial guidance.',
            { transactionCount: transactions.length, balance },
            'LOW'
        ));
    }

    // 2. HIGH PRIORITY: Unmanageable Remaining Month (Estimated spend > Balance)
    if (dataConfidence !== 'very_little_data' && balance < estimatedRemainingSpend && remainingDays > 0 && averageDailySpend > 0 && balance >= 0) {
        const dailyBudgetForRemaining = Math.round(balance / Math.max(1, remainingDays));
        alerts.push(issue(
            'month-viability',
            'tight-remaining-days',
            'Remaining month spending pace requires attention',
            `Your estimated remaining spend is ${money(estimatedRemainingSpend)} for the next ${remainingDays} days (based on a daily average of ${money(Math.round(averageDailySpend))}), but your available balance is ${money(balance)}.`,
            'When projected spending exceeds available liquidity, cash may become tight before the next income.',
            `A small adjustment to daily non-essential purchases will help stretch your available balance safely.`,
            `Target keeping your spending below ${money(dailyBudgetForRemaining)} per day for the remaining ${remainingDays} days.`,
            { balance, estimatedRemainingSpend, remainingDays, averageDailySpend },
            'HIGH'
        ));
    }

    // 3. HIGH PRIORITY: High Expenses relative to Income
    if (currentIncome > 0 && currentSpend > currentIncome * 0.85) {
        const percentUsed = Math.round((currentSpend / currentIncome) * 100);
        alerts.push(issue(
            'budget-adherence',
            'high-expense-ratio',
            'Monthly expenses are taking most of your income',
            `You have logged ${money(currentSpend)} of expenses against ${money(currentIncome)} of credited income this month (${percentUsed}% used).`,
            'When expenses consume almost all income, available liquidity becomes constrained.',
            'Focusing on flexible spending categories can help protect your liquidity.',
            'Review non-essential category expenses and pause flexible purchases until your next payday.',
            { currentSpend, currentIncome, percentUsed },
            'HIGH'
        ));
    }

    // 4. SPENDING VELOCITY: Recent 7-day velocity vs Prior Pace
    if (elapsedDays >= 5 && currentExpenses.length >= 4) {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
        const recentExpenses = currentExpenses.filter((item) => new Date(item.date) >= sevenDaysAgo);
        const priorExpenses = currentExpenses.filter((item) => new Date(item.date) < sevenDaysAgo);

        const recent7DaysSpend = Math.round(sum(recentExpenses) / Math.min(7, elapsedDays));
        const priorDays = Math.max(1, elapsedDays - Math.min(7, elapsedDays));
        const priorPace = priorDays > 0 ? Math.round(sum(priorExpenses) / priorDays) : 0;

        if (priorPace > 0 && recent7DaysSpend > priorPace * 1.4 && (recent7DaysSpend - priorPace) >= 200) {
            const surgePriority = balance < estimatedRemainingSpend ? 'HIGH' : 'MEDIUM';
            alerts.push(issue(
                'spending-velocity',
                'spending-velocity-surge',
                'Recent spending pace has accelerated',
                `Your recent spending pace increased to ${money(recent7DaysSpend)}/day, compared to ${money(priorPace)}/day earlier this month.`,
                'A sudden increase in daily spending velocity consumes available balance faster than expected.',
                'Keeping an eye on daily spending velocity helps maintain a smooth financial pace throughout the month.',
                `Aim to adjust daily flexible spending back toward ${money(priorPace)}/day.`,
                { recent7DaysSpend, priorPace },
                surgePriority
            ));
        }
    }

    // 5. SPENDING SPIKES & BALANCE IMPACT
    const daily = {};
    currentExpenses.forEach((item) => {
        const key = toDateKey(item.date);
        daily[key] = (daily[key] || 0) + Number(item.amount || 0);
    });
    const dailyValues = Object.values(daily);
    const todayKey = toDateKey(now);
    const todaySpend = daily[todayKey] || 0;

    if (dailyValues.length >= 3 && todaySpend > 0) {
        const average = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
        if (todaySpend > average * 1.75 && todaySpend >= 500) {
            const multiplier = (todaySpend / average).toFixed(1);
            const spikeCategory = currentExpenses.find(t => toDateKey(t.date) === todayKey)?.category || 'General';
            const spikePriority = balance < estimatedRemainingSpend ? 'HIGH' : 'MEDIUM';

            alerts.push(issue(
                'spending-spike',
                'spending-spike',
                `Unusual spending spike in ${spikeCategory}`,
                `You spent ${money(todaySpend)} today (${multiplier}x higher than your daily average of ${money(Math.round(average))}). This single purchase reduced your available balance to ${money(balance)}.`,
                'Unusual daily spikes can strain monthly liquidity if repeated.',
                'A single high-spend day is normal. Taking a short pause keeps it from becoming a trend.',
                'Take a 24-hour pause before any further non-essential purchases today.',
                { current: todaySpend, average: Math.round(average), multiplier, category: spikeCategory, balance },
                spikePriority
            ));
        }
    }

    // 6. CATEGORY OVERSPENDING & MOM COMPARISON
    Object.entries(current).forEach(([category, spent]) => {
        const average = (history[category] || 0) / Math.max(1, dataConfidence === 'multi_month' ? 3 : 1);
        if (average > 0 && spent > average * 1.25 && spent >= 500) {
            const label = category[0].toUpperCase() + category.slice(1);
            const friendly = category === 'food'
                ? `Your Food spending this month is ${money(spent)}, compared with ${money(average)} in previous history.`
                : category === 'shopping'
                ? `Your Shopping spending this month is ${money(spent)}, compared with ${money(average)} in previous history.`
                : `Your ${label} spending is higher than your recent average.`;
            alerts.push(issue(
                'overspend',
                `overspending-${category}`,
                `${label} spending is above your recent average`,
                `You spent ${money(spent)} on ${category} this month, compared with a recent average of ${money(Math.round(average))}.`,
                'Category increases quietly reduce available cash buffer.',
                friendly,
                `Set a limit on flexible ${category} purchases for the remaining days.`,
                { current: spent, average: Math.round(average) },
                'MEDIUM'
            ));
        }
    });

    // 7. HIGH SUBSCRIPTIONS
    const subscriptions = sum(currentExpenses.filter((item) => /(subscription|netflix|spotify|prime|hotstar|youtube|gym|membership|apple|google)/i.test(`${item.title} ${item.category}`)));
    if (subscriptions >= 1000 || (subscriptions > 0 && currentIncome > 0 && subscriptions > currentIncome * 0.05)) {
        alerts.push(issue(
            'subscriptions',
            'high-subscription-spending',
            'Subscriptions are taking a noticeable share',
            `You have logged ${money(subscriptions)} in subscription spending this month.`,
            'Small recurring payments accumulate over time.',
            'Reviewing active subscriptions helps keep recurring costs lean.',
            'Check your active subscriptions and pause any service you are not actively using.',
            { current: subscriptions },
            'MEDIUM'
        ));
    }

    // 8. LOW PRIORITY: Positive / Healthy Spending & Manageable Month Recognition
    const highPriorityAlerts = alerts.filter(a => a.priority === 'HIGH');

    if (highPriorityAlerts.length === 0 && isManageableMonth && remainingDays > 0 && balance > 0) {
        alerts.push(issue(
            'manageable-pace',
            'manageable-month-pace',
            'Current spending pace looks manageable',
            `Your current spending pace averages ${money(Math.round(averageDailySpend))}/day. Based on this, your estimated remaining spend of ${money(estimatedRemainingSpend)} for ${remainingDays} day(s) is manageable with your balance of ${money(balance)}.`,
            'Maintaining a steady spending pace ensures financial stability throughout the month.',
            'Your current spending pace looks manageable for the remaining days of the month. Maintaining this pattern consistently is a reasonable approach.',
            'Keep up your steady spending routine for the rest of the month.',
            { balance, estimatedRemainingSpend, remainingDays, averageDailySpend },
            'LOW'
        ));
    }

    if (highPriorityAlerts.length === 0 && currentIncome > 0 && currentSpend <= currentIncome * 0.7 && balance > 0 && dataConfidence !== 'very_little_data') {
        alerts.push(issue(
            'healthy-spending',
            'spending-under-control',
            'Your spending is currently under control',
            `You spent ${money(currentSpend)} out of ${money(currentIncome)} income this month (${Math.round((currentSpend / currentIncome) * 100)}% used).`,
            'Keeping expenses comfortably below income maintains healthy liquidity.',
            'Your spending is currently under control and your current spending pace looks sustainable.',
            'Maintain this healthy financial balance.',
            { currentSpend, currentIncome },
            'LOW'
        ));
    }

    // 9. LOW PRIORITY: Goal Context Awareness (New Goal & Consistent Monthly Goal Recognition)
    goals.filter((goal) => goal.status === 'active').forEach((goal) => {
        const goalAgeDays = goal.createdAt ? Math.max(0, Math.ceil((now - new Date(goal.createdAt)) / 86400000)) : 0;
        const currentAmount = Number(goal.currentAmount || 0);

        if (goalAgeDays <= 45) {
            alerts.push(issue(
                'new-goal-support',
                'new-goal-encouragement',
                `Goal Progress: ${goal.targetName}`,
                `You have saved ${money(currentAmount)} toward ${goal.targetName} (Target: ${money(goal.targetAmount)}).`,
                'Long-term goals are built through steady, regular habits.',
                `You've recently started working toward this goal. Focus on building a consistent contribution habit and review the amount as your financial situation changes.`,
                `Continue contributing comfortably toward ${goal.targetName} as your budget allows.`,
                { goalName: goal.targetName, currentAmount, targetAmount: goal.targetAmount },
                'LOW'
            ));
        } else if (currentAmount > 0) {
            alerts.push(issue(
                'goal-consistency',
                'consistent-goal-progress',
                `Consistent Goal Progress: ${goal.targetName}`,
                `You have accumulated ${money(currentAmount)} toward ${goal.targetName} (Target: ${money(goal.targetAmount)}).`,
                'Regular monthly contributions steadily move you closer to your financial milestones.',
                `Your monthly contribution pattern toward ${goal.targetName} is progressing consistently.`,
                `Maintain your monthly goal allocation for ${goal.targetName}.`,
                { goalName: goal.targetName, currentAmount },
                'LOW'
            ));
        }
    });

    // Priority Sorting: HIGH (1) -> MEDIUM (2) -> LOW (3)
    const priorityRank = { HIGH: 1, MEDIUM: 2, LOW: 3 };
    alerts.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

    // Financial Health Score Calculation
    const savingsRate = currentIncome ? Math.max(0, (currentIncome - currentSpend) / currentIncome) : 0;
    const baseScore = isManageableMonth ? 75 : 50;
    const score = Math.max(0, Math.min(100, Math.round(
        baseScore +
        (currentIncome > 0 ? Math.min(15, savingsRate * 50) : 10) -
        (highPriorityAlerts.length * 10) +
        (balance >= 0 ? 5 : -15)
    )));

    const health = {
        score,
        label: score >= 80 ? 'Strong' : score >= 60 ? 'Building' : score >= 40 ? 'Needs attention' : 'At risk',
        savingsRate: Math.round(savingsRate * 100),
        balance,
        currentIncome,
        currentSpend,
        averageDailySpend: Math.round(averageDailySpend),
        estimatedRemainingSpend,
        remainingDays,
        isManageableMonth,
        dataConfidence,
        components: {
            budgetAdherence: currentIncome ? Math.round(Math.max(0, Math.min(100, (1 - (currentSpend / currentIncome)) * 100))) : 80,
            spendingBehavior: Math.max(0, 100 - highPriorityAlerts.length * 20),
            monthViability: isManageableMonth ? 90 : 40,
            goalProgress: goals.length ? 85 : 70
        }
    };

    // Summary Text Generation (Context-Aware, Real Numbers)
    let summary = '';
    if (dataConfidence === 'very_little_data') {
        summary = `You have recorded ${transactions.length} transaction(s) so far. Available balance is ${money(balance)}. Log more activity to build your personalized trend insights.`;
    } else if (highPriorityAlerts.length > 0) {
        const topHigh = highPriorityAlerts[0];
        summary = `${topHigh.title}. ${topHigh.whatHappened}`;
    } else if (isManageableMonth) {
        summary = `Your current spending pace looks manageable for the remaining ${remainingDays} days of the month. Available balance of ${money(balance)} covers your estimated remaining spend of ${money(estimatedRemainingSpend)}.`;
    } else {
        summary = `You are keeping your finances organized. Continue monitoring your spending pace for the remaining ${remainingDays} days.`;
    }

    return {
        alerts,
        summary,
        mistakeTags: [...new Set(alerts.map((item) => item.tag))],
        health,
        categoryTotals: current,
        dataConfidence
    };
};
