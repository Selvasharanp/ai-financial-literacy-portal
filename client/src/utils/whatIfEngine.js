/**
 * WHAT-IF FINANCIAL SIMULATOR ENGINE (Client ES Module)
 * 
 * Integer-Paise Arithmetic & Deterministic Financial Calculations
 * Multi-Turn Conversational Intent & Scenario Parsing
 */

// 1 INR = 100 Paise
export const toPaise = (amount) => Math.round(Number(amount || 0) * 100);
export const fromPaise = (paise) => Number((Number(paise || 0) / 100).toFixed(2));

export const formatINR = (amount) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(Number(amount) || 0);

// Standard Category Mappings
const CATEGORY_SYNONYMS = {
    Food: ['food', 'dining', 'eating', 'eat', 'restaurant', 'groceries', 'ordering food', 'order food', 'takeout', 'swiggy', 'zomato', 'dinner', 'lunch', 'breakfast', 'snacks', 'coffee'],
    Transport: ['transport', 'travel', 'fuel', 'petrol', 'diesel', 'commute', 'cab', 'uber', 'ola', 'bus', 'train', 'metro', 'auto', 'flight'],
    Entertainment: ['entertainment', 'movie', 'movies', 'fun', 'game', 'games', 'gaming', 'party', 'subscriptions', 'subscription', 'netflix', 'spotify', 'hotstar', 'prime', 'ott'],
    Shopping: ['shopping', 'clothes', 'clothing', 'fashion', 'shoes', 'electronics', 'gadgets', 'mall', 'amazon', 'flipkart'],
    Bills: ['rent', 'bill', 'bills', 'utility', 'utilities', 'electricity', 'water', 'wifi', 'internet', 'broadband', 'maintenance']
};

/**
 * Match category name from text
 */
export function identifyCategory(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    for (const [cat, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
        for (const syn of synonyms) {
            const regex = new RegExp(`\\b${syn}\\b`, 'i');
            if (regex.test(lower)) return cat;
        }
    }
    return null;
}

/**
 * Extract time duration in months
 */
export function extractDurationMonths(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    const wordNumbers = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'twelve': 12 };
    
    const match = lower.match(/(?:for|over|in)\s+(\d+|one|two|three|four|five|six|twelve)\s+(month|months|yr|year|years)/i);
    if (match) {
        const valStr = match[1];
        const num = wordNumbers[valStr] || Number(valStr);
        const unit = match[2].toLowerCase();
        if (unit.startsWith('year') || unit === 'yr') {
            return num * 12;
        }
        return num;
    }
    return null;
}

/**
 * Extract frequency from text
 */
export function extractFrequency(text) {
    if (!text) return 'monthly';
    const lower = text.toLowerCase();
    if (/\b(every week|per week|weekly|a week)\b/i.test(lower)) return 'weekly';
    if (/\b(every year|per year|yearly|annual|annually|a year)\b/i.test(lower)) return 'yearly';
    return 'monthly';
}

/**
 * Parse an isolated single-change clause
 */
export function parseSingleClause(clause, context = null) {
    const raw = clause.trim();
    const lower = raw.toLowerCase();

    // Percentage
    const pctMatch = raw.match(/(\d+(?:\.\d+)?)%/);
    const pct = pctMatch ? Number(pctMatch[1]) : null;

    // Fixed currency amount (₹2,000, Rs. 1500, 87,000, 500)
    const amtMatch = raw.match(/(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d+)(?:\s*(?:rupees|rs|inr))?/i);
    let fixedAmount = null;
    if (amtMatch && !pctMatch) {
        fixedAmount = Number(amtMatch[1].replace(/,/g, ''));
    }

    // Direction keywords
    const isIncrease = /\b(increase|increases|increasing|more|raise|raises|raised|add|adds|added|extra|boost|boosts|higher|spend more|spends more)\b/i.test(raw);
    const isReduce = /\b(reduce|reduces|reducing|decrease|decreases|decreasing|less|cut|cuts|cutting|trim|trims|lower|lowers|stop|stopped|drop|drops|spend less|spends less|cut down|cut back|saving|save)\b/i.test(raw);
    const isStopCompletely = /\b(stop|stopped|quit|eliminate|stop ordering|stopping)\b/i.test(raw);

    // Target detection
    let category = identifyCategory(raw);
    const isTotalSpending = /\b(total|overall|all spending|entire spending|monthly spending|everything)\b/i.test(raw);
    const isIncome = /\b(income|salary|earn|earnings|paycheck|take-home|wage|wages)\b/i.test(raw);
    
    // Explicit savings check
    const isAskingSavingsFromCut = category && (isStopCompletely || /\b(cut|reduce|stopped|stopping)\b/i.test(raw));
    const isSavings = (/\b(save|saving|savings|put aside|set aside|invest|investing|emergency fund)\b/i.test(raw)) && !isAskingSavingsFromCut;

    const isOneTimePurchase = /\b(buy|purchase|bought|laptop|phone|bike|car|tv|gadget|flight|vacation|one-time|one time)\b/i.test(raw) || 
                              /\b(can i afford|could i afford|afford to spend|afford a)\b/i.test(raw);

    // Pronoun resolution e.g. "What if I increase it by 20%?"
    const hasPronoun = /\b(it|that|this|them)\b/i.test(raw);
    let contextUsed = false;
    if (!category && hasPronoun && context?.lastCategory) {
        category = context.lastCategory;
        contextUsed = true;
    }

    // Determine target type
    let targetType = 'CATEGORY';
    if (isIncome) targetType = 'INCOME';
    else if (isOneTimePurchase) targetType = 'ONE_TIME_PURCHASE';
    else if (isSavings) targetType = 'SAVINGS';
    else if (isTotalSpending) targetType = 'OVERALL_SPENDING';
    else if (category) targetType = 'CATEGORY';
    else targetType = null; // Unspecified

    // Frequency & Duration
    const frequency = isOneTimePurchase ? 'one_time' : extractFrequency(raw);
    const durationMonths = extractDurationMonths(raw);

    // Direction
    let direction = 'REDUCE';
    if (isSavings) {
        direction = 'INCREASE';
    } else if (isIncrease) {
        direction = 'INCREASE';
    } else if (isReduce) {
        direction = 'REDUCE';
    } else if (isIncome && /\b(drop|drops|drops by|reduced|fall|lose|loss)\b/i.test(raw)) {
        direction = 'REDUCE';
    } else if (isIncome && /\b(raise|raise by|increase|bonus)\b/i.test(raw)) {
        direction = 'INCREASE';
    } else if (isOneTimePurchase) {
        direction = 'INCREASE';
    }

    // Change value
    let changeType = 'PERCENTAGE';
    let changeValue = null;

    if (isStopCompletely && category) {
        changeType = 'PERCENTAGE';
        changeValue = 100;
        direction = 'REDUCE';
    } else if (pct !== null) {
        changeType = 'PERCENTAGE';
        changeValue = pct;
    } else if (fixedAmount !== null) {
        changeType = 'FIXED_AMOUNT';
        changeValue = fixedAmount;
    }

    return {
        raw,
        targetType,
        category,
        direction,
        changeType,
        changeValue,
        frequency,
        durationMonths,
        contextUsed,
        isIncome,
        isOneTimePurchase,
        isSavings,
        isTotalSpending,
        hasPronoun
    };
}

/**
 * PARSE NATURAL LANGUAGE SCENARIO
 */
export function parseNaturalLanguageScenario(rawQuery, conversationContext = null) {
    if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
        return {
            query: rawQuery,
            isComplete: false,
            needsClarification: true,
            clarificationQuestion: 'What scenario would you like to simulate? (e.g., "What if I reduce food by 20%?" or "What if I save ₹2,000 more every month?")',
            clarificationOptions: ['Reduce food spending by 20%', 'Save ₹2,000 more every month', 'Buy a laptop for ₹60,000'],
            missingInputs: ['query']
        };
    }

    const lower = rawQuery.trim().toLowerCase();

    // 1. STRICT AMBIGUITY CHECK: Incomplete grammar (e.g. "What if I by 20%?")
    if (/\bwhat if i (?:by|at)\s+\d+%/i.test(lower) || /\bwhat if i\s+\d+%/i.test(lower)) {
        return {
            query: rawQuery,
            isComplete: false,
            needsClarification: true,
            clarificationQuestion: 'What would you like to change by 20% — for example, food spending, transport, or total spending?',
            clarificationOptions: ['Food Spending', 'Transport', 'Total Spending', 'Monthly Savings'],
            missingInputs: ['targetType', 'action'],
            components: []
        };
    }

    // 2. CHECK VAGUE SAVINGS QUESTION WITHOUT AMOUNT (e.g. "What if I save more?")
    if (/^(?:what if i|how about i|suppose i|can i)?\s*(?:save more|save extra|increase savings|start saving)\??$/i.test(lower) ||
        /\bwhat if i save more\b/i.test(lower) && !/\d+/.test(lower)) {
        return {
            query: rawQuery,
            isComplete: false,
            needsClarification: true,
            clarificationQuestion: 'How much more would you like to save each month — for example, ₹1,000, ₹2,000, or ₹5,000?',
            clarificationOptions: ['₹1,000', '₹2,000', '₹3,000', '₹5,000'],
            missingInputs: ['changeValue'],
            components: [{
                targetType: 'SAVINGS',
                direction: 'INCREASE',
                frequency: 'monthly'
            }]
        };
    }

    // 3. CHECK GOAL ACCELERATION QUESTION WITHOUT AMOUNT
    if (/\b(reach my .* goal|reach .* goal|goal sooner|reach goal faster)\b/i.test(lower) && !/\d+/.test(lower)) {
        return {
            query: rawQuery,
            isComplete: false,
            needsClarification: true,
            clarificationQuestion: 'How much extra would you like to save toward your goal each month — for example, ₹1,000, ₹2,000, or ₹5,000?',
            clarificationOptions: ['₹1,000', '₹2,000', '₹3,000', '₹5,000'],
            missingInputs: ['changeValue'],
            components: [{
                targetType: 'SAVINGS',
                direction: 'INCREASE',
                frequency: 'monthly'
            }]
        };
    }

    // 4. CHECK AMBIGUOUS PRONOUN WITHOUT CONTEXT
    if (/\b(increase it|reduce it|cut it)\b/i.test(lower) && !conversationContext?.lastCategory) {
        return {
            query: rawQuery,
            isComplete: false,
            needsClarification: true,
            clarificationQuestion: 'What expense does "it" refer to — for example, food spending, transport, or bills?',
            clarificationOptions: ['Food Spending', 'Transport', 'Bills', 'Total Spending'],
            missingInputs: ['targetType'],
            components: []
        };
    }

    // 5. CHECK STATUS QUO RUN-RATE
    if (/\b(continue at my current spending|continue spending at my current rate|current rate|current pace|status quo)\b/i.test(lower)) {
        return {
            query: rawQuery,
            scenarioType: 'STATUS_QUO',
            isComplete: true,
            needsClarification: false,
            components: [{
                targetType: 'OVERALL_SPENDING',
                direction: 'MAINTAIN',
                frequency: 'monthly'
            }]
        };
    }

    // 6. CHECK SAVE ALL MONEY LEFT AFTER EXPENSES
    if (/\b(save all the money left|save all money left|save my surplus|save left over)\b/i.test(lower)) {
        return {
            query: rawQuery,
            scenarioType: 'ADDITIONAL_SAVINGS',
            isComplete: true,
            needsClarification: false,
            components: [{
                targetType: 'SAVINGS',
                direction: 'INCREASE',
                changeType: 'ALL_SURPLUS',
                frequency: 'monthly'
            }]
        };
    }

    // 7. CHECK LOSS OF INCOME FOR DURATION
    if (/\b(lose my income|lose income|no income|without income|loss of income)\b/i.test(lower)) {
        const duration = extractDurationMonths(lower) || 2;
        return {
            query: rawQuery,
            scenarioType: 'INCOME_LOSS',
            isComplete: true,
            needsClarification: false,
            components: [{
                targetType: 'INCOME',
                direction: 'REDUCE',
                changeType: 'PERCENTAGE',
                changeValue: 100,
                durationMonths: duration,
                frequency: 'monthly'
            }]
        };
    }

    // 8. CHECK COMBINED SCENARIO
    const splitMatch = rawQuery.match(/^(.*?)\s+(?:and|but|while)\s+(.*)$/i);
    if (splitMatch && (/\b(reduce|cut|spend less|save|lower)\b/i.test(splitMatch[1]) || /\b(increase|spend more|raise|more)\b/i.test(splitMatch[1])) &&
                     (/\b(reduce|cut|spend less|save|lower)\b/i.test(splitMatch[2]) || /\b(increase|spend more|raise|more)\b/i.test(splitMatch[2]))) {
        const clause1 = parseSingleClause(splitMatch[1], conversationContext);
        const clause2 = parseSingleClause(splitMatch[2], conversationContext);

        if (clause1.targetType && clause2.targetType) {
            if (clause1.changeValue === null || clause2.changeValue === null) {
                return {
                    query: rawQuery,
                    isComplete: false,
                    needsClarification: true,
                    clarificationQuestion: 'By how much would you like to adjust each of these categories — for example, reduce food by 10% and increase transport by ₹500?',
                    clarificationOptions: ['10% and ₹500', '20% and ₹1,000'],
                    missingInputs: ['changeValue'],
                    components: [clause1, clause2]
                };
            }

            return {
                query: rawQuery,
                scenarioType: 'COMBINED',
                isComplete: true,
                needsClarification: false,
                components: [clause1, clause2],
                conversationContext: {
                    lastCategory: clause2.category || clause1.category
                }
            };
        }
    }

    // 9. PARSE AS SINGLE CLAUSE
    const parsed = parseSingleClause(rawQuery, conversationContext);

    // If target type is not identified and no amount
    if (!parsed.targetType && !parsed.category && parsed.changeValue === null) {
        return {
            query: rawQuery,
            isComplete: false,
            needsClarification: true,
            clarificationQuestion: 'Could you clarify your question? For example: "What if I reduce food spending by 20%?" or "What if I save ₹2,000 more every month?"',
            clarificationOptions: ['Reduce food spending by 20%', 'Save ₹2,000 more every month', 'Buy a laptop for ₹60,000'],
            missingInputs: ['intent'],
            components: []
        };
    }

    // Missing amount/percent check on category
    if (parsed.category && parsed.changeValue === null) {
        const pendingComp = {
            targetType: 'CATEGORY',
            category: parsed.category,
            direction: 'REDUCE',
            frequency: 'monthly'
        };
        return {
            query: rawQuery,
            isComplete: false,
            needsClarification: true,
            clarificationQuestion: `How much would you like to cut down on ${parsed.category} expenses — for example, 10%, 20%, or a specific amount like ₹500?`,
            clarificationOptions: ['10%', '20%', '30%', '₹500', '₹1,000'],
            missingInputs: ['amount_or_percentage'],
            components: [pendingComp],
            pendingClarification: {
                query: rawQuery,
                scenarioType: 'EXPENSE_CHANGE',
                components: [pendingComp]
            }
        };
    }

    // Determine Scenario Type
    let scenarioType = 'EXPENSE_CHANGE';
    if (parsed.isOneTimePurchase) scenarioType = 'ONE_TIME_PURCHASE';
    else if (parsed.isIncome) scenarioType = 'INCOME_CHANGE';
    else if (parsed.isSavings) scenarioType = 'ADDITIONAL_SAVINGS';

    return {
        query: rawQuery,
        scenarioType,
        isComplete: true,
        needsClarification: false,
        components: [parsed],
        conversationContext: {
            lastCategory: parsed.category,
            lastDirection: parsed.direction,
            lastChangeValue: parsed.changeValue
        }
    };
}

/**
 * DETERMINISTIC CALCULATION ENGINE
 */
export function calculateScenario(scenario, transactions = [], goals = [], userProfile = {}) {
    if (!scenario || scenario.needsClarification) {
        return {
            hasData: false,
            needsClarification: true,
            clarificationQuestion: scenario?.clarificationQuestion || 'Please clarify your scenario.',
            clarificationOptions: scenario?.clarificationOptions || [],
            query: scenario?.query || ''
        };
    }

    const safeTx = Array.isArray(transactions) ? transactions : [];
    const expenseTx = safeTx.filter(t => t.type === 'expense');
    const incomeTx = safeTx.filter(t => t.type === 'income');

    const totalExpensesPaise = expenseTx.reduce((sum, t) => sum + toPaise(t.amount), 0);
    const totalIncomePaise = incomeTx.reduce((sum, t) => sum + toPaise(t.amount), 0);

    const openingBalancePaise = toPaise(userProfile?.openingBalance || 0);
    const currentBalancePaise = openingBalancePaise + totalIncomePaise - totalExpensesPaise;

    const safeGoals = Array.isArray(goals) ? goals : [];
    const activeGoal = safeGoals.find(g => (Number(g.targetAmount) || 0) > (Number(g.currentAmount) || 0));

    // =========================================================================
    // 1. ONE-TIME PURCHASE / AFFORDABILITY CHECK
    // =========================================================================
    if (scenario.scenarioType === 'ONE_TIME_PURCHASE') {
        const comp = scenario.components[0];
        const costPaise = toPaise(comp.changeValue || 0);
        const costINR = fromPaise(costPaise);
        const balanceINR = fromPaise(currentBalancePaise);
        const projectedBalanceINR = fromPaise(currentBalancePaise - costPaise);
        const isAffordable = currentBalancePaise >= costPaise;
        const shortfallINR = isAffordable ? 0 : fromPaise(costPaise - currentBalancePaise);

        const monthlySurplusPaise = Math.max(0, totalIncomePaise - totalExpensesPaise);
        const monthsToSave = (monthlySurplusPaise > 0 && !isAffordable) 
            ? Math.ceil((costPaise - currentBalancePaise) / monthlySurplusPaise) 
            : null;

        let verdictText = '';
        if (isAffordable) {
            verdictText = `Yes, you can afford this one-time purchase of ${formatINR(costINR)}. Your current balance is ${formatINR(balanceINR)}, leaving ${formatINR(projectedBalanceINR)} after purchase.`;
        } else {
            verdictText = `A one-time purchase of ${formatINR(costINR)} exceeds your current available balance of ${formatINR(balanceINR)} by ${formatINR(shortfallINR)}. ${monthsToSave ? `At your current monthly savings rate, it would take approx ${monthsToSave} months to save for this.` : 'Consider building up your savings before making this purchase.'}`;
        }

        return {
            hasData: true,
            scenarioType: 'ONE_TIME_PURCHASE',
            query: scenario.query,
            purchaseCost: costINR,
            currentBalance: balanceINR,
            projectedBalance: projectedBalanceINR,
            isAffordable,
            shortfall: shortfallINR,
            monthsToSave,
            aiInsight: verdictText
        };
    }

    // =========================================================================
    // 2. ADDITIONAL SAVINGS SCENARIO (Never an expense!)
    // =========================================================================
    if (scenario.scenarioType === 'ADDITIONAL_SAVINGS') {
        const comp = scenario.components[0];
        let savingsPaise = 0;

        if (comp.changeType === 'ALL_SURPLUS') {
            savingsPaise = Math.max(0, totalIncomePaise - totalExpensesPaise);
        } else if (comp.changeType === 'FIXED_AMOUNT') {
            savingsPaise = toPaise(comp.changeValue || 0);
        } else if (comp.changeType === 'PERCENTAGE') {
            savingsPaise = Math.round((totalIncomePaise * (comp.changeValue || 0)) / 100);
        }

        if (comp.frequency === 'weekly') {
            savingsPaise = Math.round((savingsPaise * 52) / 12);
        } else if (comp.frequency === 'yearly') {
            savingsPaise = Math.round(savingsPaise / 12);
        }

        const plannedMonthlySavingsINR = fromPaise(savingsPaise);
        const projectedAnnualSavingsINR = plannedMonthlySavingsINR * 12;

        const totalIncomeINR = fromPaise(totalIncomePaise);
        const totalExpensesINR = fromPaise(totalExpensesPaise);
        const monthlySurplusINR = totalIncomeINR - totalExpensesINR;

        let affordabilityStatus = 'AFFORDABLE';
        let affordabilityMessage = '';

        if (incomeTx.length === 0) {
            affordabilityStatus = 'DATA_MISSING';
            affordabilityMessage = 'Insufficient income data recorded to confirm affordability. Add your income transactions to check feasibility.';
        } else if (monthlySurplusINR >= plannedMonthlySavingsINR) {
            affordabilityStatus = 'AFFORDABLE';
            affordabilityMessage = `Your current monthly surplus is ${formatINR(monthlySurplusINR)}, which is sufficient to comfortably support saving ${formatINR(plannedMonthlySavingsINR)} every month.`;
        } else {
            affordabilityStatus = 'TIGHT_OR_DEFICIT';
            const shortfallMonthly = plannedMonthlySavingsINR - Math.max(0, monthlySurplusINR);
            affordabilityMessage = `Your current monthly surplus is ${formatINR(monthlySurplusINR)}, which is less than your planned additional savings of ${formatINR(plannedMonthlySavingsINR)}/mo. To achieve this, consider trimming discretionary expenses by ${formatINR(shortfallMonthly)}/mo.`;
        }

        let hasGoalData = false;
        let goalName = null;
        let goalRemainingINR = null;
        let monthsToReachGoal = null;
        let goalImpactText = 'Goal impact unavailable — add a savings goal to calculate this.';

        if (activeGoal) {
            hasGoalData = true;
            goalName = activeGoal.targetName || activeGoal.name || 'Savings Goal';
            const targetPaise = toPaise(activeGoal.targetAmount || 0);
            const currentPaise = toPaise(activeGoal.currentAmount || 0);
            const remainingPaise = Math.max(0, targetPaise - currentPaise);
            goalRemainingINR = fromPaise(remainingPaise);

            if (savingsPaise > 0) {
                monthsToReachGoal = Math.ceil(remainingPaise / savingsPaise);
                goalImpactText = `Directing this ${formatINR(plannedMonthlySavingsINR)}/mo extra savings toward your "${goalName}" (${formatINR(goalRemainingINR)} remaining) will help you reach it in approximately ${monthsToReachGoal} month${monthsToReachGoal === 1 ? '' : 's'}.`;
            }
        }

        return {
            hasData: true,
            scenarioType: 'ADDITIONAL_SAVINGS',
            query: scenario.query,
            plannedMonthlySavings: plannedMonthlySavingsINR,
            projectedAnnualSavings: projectedAnnualSavingsINR,
            monthlySurplus: monthlySurplusINR,
            affordabilityStatus,
            affordabilityMessage,
            hasGoalData,
            goalName,
            goalRemaining: goalRemainingINR,
            monthsToReachGoal,
            goalImpactText,
            aiInsight: `Saving an additional ${formatINR(plannedMonthlySavingsINR)} each month builds ${formatINR(projectedAnnualSavingsINR)} in extra savings over 12 months, strengthening your financial resilience and safety cushion.`
        };
    }

    // =========================================================================
    // 3. INCOME CHANGE SCENARIO
    // =========================================================================
    if (scenario.scenarioType === 'INCOME_CHANGE') {
        const comp = scenario.components[0];
        const isInc = comp.direction === 'INCREASE';
        let changePaise = 0;

        if (comp.changeType === 'PERCENTAGE') {
            changePaise = Math.round((totalIncomePaise * comp.changeValue) / 100);
        } else {
            changePaise = toPaise(comp.changeValue || 0);
        }

        if (comp.frequency === 'weekly') {
            changePaise = Math.round((changePaise * 52) / 12);
        } else if (comp.frequency === 'yearly') {
            changePaise = Math.round(changePaise / 12);
        }

        const newIncomePaise = isInc 
            ? totalIncomePaise + changePaise 
            : Math.max(0, totalIncomePaise - changePaise);

        const originalIncomeINR = fromPaise(totalIncomePaise);
        const projectedIncomeINR = fromPaise(newIncomePaise);
        const changeAmountINR = fromPaise(changePaise);
        const monthlyIncomeDeltaINR = isInc ? changeAmountINR : -changeAmountINR;
        const annualIncomeDeltaINR = monthlyIncomeDeltaINR * 12;

        const originalSurplusINR = fromPaise(totalIncomePaise - totalExpensesPaise);
        const projectedSurplusINR = fromPaise(newIncomePaise - totalExpensesPaise);

        return {
            hasData: true,
            scenarioType: 'INCOME_CHANGE',
            query: scenario.query,
            direction: comp.direction,
            originalIncome: originalIncomeINR,
            projectedIncome: projectedIncomeINR,
            monthlyIncomeDelta: monthlyIncomeDeltaINR,
            annualIncomeDelta: annualIncomeDeltaINR,
            originalSurplus: originalSurplusINR,
            projectedSurplus: projectedSurplusINR,
            isSurplusPositive: projectedSurplusINR >= 0,
            aiInsight: isInc 
                ? `An income increase of ${formatINR(changeAmountINR)}/month raises your monthly income to ${formatINR(projectedIncomeINR)}, expanding your monthly surplus to ${formatINR(projectedSurplusINR)}.`
                : `An income drop of ${formatINR(changeAmountINR)}/month lowers your monthly income to ${formatINR(projectedIncomeINR)}, shifting your monthly surplus to ${formatINR(projectedSurplusINR)}.`
        };
    }

    // =========================================================================
    // 4. LOSS OF INCOME FOR DURATION
    // =========================================================================
    if (scenario.scenarioType === 'INCOME_LOSS') {
        const comp = scenario.components[0];
        const durationMonths = comp.durationMonths || 2;
        const monthlyExpensesINR = fromPaise(totalExpensesPaise);
        const monthlyIncomeINR = fromPaise(totalIncomePaise);

        if (monthlyExpensesINR === 0) {
            return {
                hasData: false,
                query: scenario.query,
                message: 'No recorded monthly expenses found to simulate income loss duration.'
            };
        }

        const totalDeficitINR = monthlyExpensesINR * durationMonths;
        const currentBalanceINR = fromPaise(currentBalancePaise);
        const projectedBalanceINR = currentBalanceINR - totalDeficitINR;

        return {
            hasData: true,
            scenarioType: 'INCOME_LOSS',
            query: scenario.query,
            durationMonths,
            monthlyExpenses: monthlyExpensesINR,
            monthlyIncomeLost: monthlyIncomeINR,
            totalDeficit: totalDeficitINR,
            currentBalance: currentBalanceINR,
            projectedBalance: projectedBalanceINR,
            aiInsight: `If you lose your income for ${durationMonths} months, ongoing monthly expenses of ${formatINR(monthlyExpensesINR)} will continue, resulting in a total shortfall of ${formatINR(totalDeficitINR)}. Your balance will drop from ${formatINR(currentBalanceINR)} to ${formatINR(projectedBalanceINR)}.`
        };
    }

    // =========================================================================
    // 5. STATUS QUO SIMULATION
    // =========================================================================
    if (scenario.scenarioType === 'STATUS_QUO') {
        const monthlyExpensesINR = fromPaise(totalExpensesPaise);
        const monthlyIncomeINR = fromPaise(totalIncomePaise);
        const monthlySurplusINR = monthlyIncomeINR - monthlyExpensesINR;

        return {
            hasData: true,
            scenarioType: 'STATUS_QUO',
            query: scenario.query,
            monthlySpending: monthlyExpensesINR,
            monthlyIncome: monthlyIncomeINR,
            monthlySurplus: monthlySurplusINR,
            projected3Months: monthlyExpensesINR * 3,
            projected6Months: monthlyExpensesINR * 6,
            projected12Months: monthlyExpensesINR * 12,
            aiInsight: `Continuing at your current monthly spending pace of ${formatINR(monthlyExpensesINR)} will total ${formatINR(monthlyExpensesINR * 3)} over 3 months and ${formatINR(monthlyExpensesINR * 12)} annually.`
        };
    }

    // =========================================================================
    // 6. COMBINED MULTI-CHANGE SCENARIO
    // =========================================================================
    if (scenario.scenarioType === 'COMBINED') {
        let totalMonthlyImpactPaise = 0;
        const componentsDetail = [];

        for (const comp of scenario.components) {
            const cat = comp.category;
            const catTx = expenseTx.filter(t => (t.category || '').toLowerCase() === (cat || '').toLowerCase());
            const catSpendingPaise = catTx.reduce((sum, t) => sum + toPaise(t.amount), 0);

            if (catSpendingPaise === 0 && comp.targetType === 'CATEGORY') {
                return {
                    hasData: false,
                    query: scenario.query,
                    message: `Not enough transaction data recorded for "${cat}" category to evaluate combined scenario.`
                };
            }

            let changePaise = 0;
            if (comp.changeType === 'PERCENTAGE') {
                changePaise = Math.round((catSpendingPaise * comp.changeValue) / 100);
            } else {
                changePaise = toPaise(comp.changeValue || 0);
            }

            if (comp.frequency === 'weekly') {
                changePaise = Math.round((changePaise * 52) / 12);
            }

            const isInc = comp.direction === 'INCREASE';
            const monthlyImpactPaise = isInc ? -changePaise : changePaise;
            totalMonthlyImpactPaise += monthlyImpactPaise;

            componentsDetail.push({
                category: cat || (comp.targetType === 'OVERALL_SPENDING' ? 'Total Spending' : 'Category'),
                direction: comp.direction,
                changeDescription: `${isInc ? '+' : '-'}${comp.changeType === 'PERCENTAGE' ? `${comp.changeValue}%` : formatINR(fromPaise(changePaise))}`,
                currentSpending: fromPaise(catSpendingPaise),
                newSpending: fromPaise(isInc ? catSpendingPaise + changePaise : Math.max(0, catSpendingPaise - changePaise)),
                monthlyImpact: fromPaise(monthlyImpactPaise)
            });
        }

        const currentTotalSpendingINR = fromPaise(totalExpensesPaise);
        const projectedTotalSpendingINR = fromPaise(Math.max(0, totalExpensesPaise - totalMonthlyImpactPaise));
        const netMonthlyImpactINR = fromPaise(totalMonthlyImpactPaise);
        const netAnnualImpactINR = fromPaise(totalMonthlyImpactPaise * 12);

        return {
            hasData: true,
            scenarioType: 'COMBINED',
            query: scenario.query,
            componentsDetail,
            currentTotalSpending: currentTotalSpendingINR,
            projectedTotalSpending: projectedTotalSpendingINR,
            netMonthlyImpact: netMonthlyImpactINR,
            netAnnualImpact: netAnnualImpactINR,
            isNetSavings: netMonthlyImpactINR > 0,
            aiInsight: `Combined changes result in a net ${netMonthlyImpactINR >= 0 ? `savings of ${formatINR(netMonthlyImpactINR)}` : `cost of ${formatINR(Math.abs(netMonthlyImpactINR))}`} per month. Total monthly spending changes from ${formatINR(currentTotalSpendingINR)} to ${formatINR(projectedTotalSpendingINR)}.`
        };
    }

    // =========================================================================
    // 7. EXPENSE CHANGE SCENARIO (Category or Overall)
    // =========================================================================
    const comp = scenario.components[0];
    const isCategory = comp.targetType === 'CATEGORY' && comp.category;
    const isOverall = comp.targetType === 'OVERALL_SPENDING';

    const categoryName = isCategory ? comp.category : 'Total Monthly Spending';
    let currentSpendingPaise = 0;

    if (isCategory) {
        const catTx = expenseTx.filter(t => (t.category || '').toLowerCase() === comp.category.toLowerCase());
        currentSpendingPaise = catTx.reduce((sum, t) => sum + toPaise(t.amount), 0);
        if (currentSpendingPaise === 0) {
            return {
                hasData: false,
                query: scenario.query,
                message: `Not enough transaction data recorded for "${comp.category}" category yet. Add transactions under ${comp.category} to simulate exact impact.`
            };
        }
    } else if (isOverall) {
        currentSpendingPaise = totalExpensesPaise;
        if (currentSpendingPaise === 0) {
            return {
                hasData: false,
                query: scenario.query,
                message: 'Not enough expense transactions recorded yet to run a simulation. Add expenses on the Transactions page first.'
            };
        }
    }

    let changePaise = 0;
    if (comp.changeType === 'PERCENTAGE') {
        changePaise = Math.round((currentSpendingPaise * comp.changeValue) / 100);
    } else {
        changePaise = toPaise(comp.changeValue || 0);
    }

    let frequencyNote = '';
    if (comp.frequency === 'weekly') {
        const originalWeeklyPaise = changePaise;
        changePaise = Math.round((changePaise * 52) / 12);
        frequencyNote = `Weekly change of ${formatINR(fromPaise(originalWeeklyPaise))} converted to monthly as ${formatINR(fromPaise(changePaise))}/mo (52 weeks ÷ 12 months).`;
    }

    const isInc = comp.direction === 'INCREASE';
    let newSpendingPaise = 0;
    if (isInc) {
        newSpendingPaise = currentSpendingPaise + changePaise;
    } else {
        changePaise = Math.min(currentSpendingPaise, changePaise);
        newSpendingPaise = Math.max(0, currentSpendingPaise - changePaise);
    }

    const currentSpendingINR = fromPaise(currentSpendingPaise);
    const newSpendingINR = fromPaise(newSpendingPaise);
    const changeAmountINR = fromPaise(changePaise);
    const monthlyImpactINR = isInc ? -changeAmountINR : changeAmountINR;
    const annualImpactINR = monthlyImpactINR * 12;

    let hasGoalData = false;
    let goalName = null;
    let goalImpactText = 'Goal impact unavailable — add a savings goal to calculate this.';

    if (activeGoal) {
        hasGoalData = true;
        goalName = activeGoal.targetName || activeGoal.name || 'Savings Goal';
        const remainingGoalPaise = toPaise(activeGoal.targetAmount) - toPaise(activeGoal.currentAmount);
        const remainingINR = fromPaise(remainingGoalPaise);

        if (!isInc && changePaise > 0) {
            const monthsToComplete = Math.ceil(remainingGoalPaise / changePaise);
            if (monthsToComplete > 0 && monthsToComplete <= 600) {
                goalImpactText = `Directing this ${formatINR(changeAmountINR)}/mo savings to your "${goalName}" (${formatINR(remainingINR)} remaining) will reach it in approx ${monthsToComplete} months.`;
            }
        } else if (isInc) {
            goalImpactText = `Increasing spending by ${formatINR(changeAmountINR)}/mo reduces available funds that could otherwise go toward your "${goalName}" goal.`;
        }
    }

    let aiInsight = '';
    if (isInc) {
        aiInsight = `Increasing your ${categoryName} by ${comp.changeType === 'PERCENTAGE' ? `${comp.changeValue}%` : formatINR(comp.changeValue)} would raise it from ${formatINR(currentSpendingINR)} to approximately ${formatINR(newSpendingINR)} per month. This would cost an additional ${formatINR(changeAmountINR)} each month, or ${formatINR(Math.abs(annualImpactINR))} over 12 months if continued.`;
    } else {
        aiInsight = `Reducing your ${categoryName} spending by ${comp.changeType === 'PERCENTAGE' ? `${comp.changeValue}%` : formatINR(comp.changeValue)} would lower it from ${formatINR(currentSpendingINR)} to ${formatINR(newSpendingINR)} per month. This frees up ${formatINR(changeAmountINR)} monthly, or ${formatINR(annualImpactINR)} over 12 months.`;
    }
    if (frequencyNote) {
        aiInsight += ` ${frequencyNote}`;
    }

    return {
        hasData: true,
        scenarioType: 'EXPENSE_CHANGE',
        query: scenario.query,
        direction: comp.direction,
        targetType: comp.targetType,
        categoryName,
        changeType: comp.changeType,
        changeValue: comp.changeValue,
        frequency: comp.frequency,
        frequencyNote,
        currentSpending: currentSpendingINR,
        newSpending: newSpendingINR,
        changeAmount: changeAmountINR,
        monthlyImpact: monthlyImpactINR,
        annualImpact: annualImpactINR,
        hasGoalData,
        goalName,
        goalImpactText,
        aiInsight
    };
}

/**
 * Main Entry Point for Simulation
 */
export function parseAndSimulateScenario(query, transactions = [], goals = [], userProfile = {}, conversationContext = null) {
    const scenario = parseNaturalLanguageScenario(query, conversationContext);
    return {
        ...calculateScenario(scenario, transactions, goals, userProfile),
        conversationContext: scenario.conversationContext || conversationContext
    };
}
