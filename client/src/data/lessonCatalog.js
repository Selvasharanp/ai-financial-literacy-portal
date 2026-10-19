// client/src/data/lessonCatalog.js
// Structured, interactive financial lessons for the FinWise Knowledge Library

export const LESSON_CATALOG = [
    {
        id: 'budgeting-50-30-20',
        title: 'Building a 50/30/20 Monthly Budget',
        category: 'budgeting',
        categoryLabel: 'Budgeting & Allocation',
        difficulty: 'beginner',
        estimatedMinutes: 5,
        summary: 'Learn how to split your net income into 50% Needs, 30% Wants, and 20% Savings for automatic financial balance.',
        learningObjective: 'Master the universal 50/30/20 budget framework to balance immediate survival needs, lifestyle enjoyments, and future wealth creation.',
        
        explanation: `The 50/30/20 rule is an intuitive budgeting method that groups all your money into three clear buckets:
1. **Needs (50%)**: Essential expenses required for survival and livelihood (housing/rent, groceries, electricity, essential commute, healthcare).
2. **Wants (30%)**: Lifestyle expenses that bring comfort and joy but can be postponed or reduced if needed (dining out, entertainment, shopping, vacations, hobbies).
3. **Savings & Debt (20%)**: Building your financial safety net, paying down loans, and funding long-term goals (emergency fund, SIP investments, retirement, milestone savings).`,

        visualType: 'chart',
        chartConfig: {
            type: 'budget-allocation',
            title: 'Ideal 50/30/20 Allocation vs. Typical Overspending Trap',
            ideal: [
                { name: 'Needs (Essentials)', percent: 50, color: '#183630' },
                { name: 'Wants (Lifestyle)', percent: 30, color: '#E5C690' },
                { name: 'Savings & Goals', percent: 20, color: '#059669' }
            ],
            commonTrap: [
                { name: 'Needs (Essentials)', percent: 55, color: '#183630' },
                { name: 'Wants (Lifestyle)', percent: 40, color: '#dc2626' },
                { name: 'Savings & Goals', percent: 5, color: '#f59e0b' }
            ]
        },

        flowchartId: 'cash-flow-hierarchy',

        workedExample: {
            title: 'Step-by-Step 50/30/20 Calculation',
            description: 'Here is how your income translates into concrete monthly targets:',
            formula: 'Target = Monthly Income × Allocation Percentage',
            calculate: (profile, transactions) => {
                const income = profile?.income || (transactions.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0)) || 50000;
                return [
                    { label: 'Total Net Monthly Income', value: income, isBase: true },
                    { label: 'Essential Needs Cap (50%)', value: Math.round(income * 0.50), note: 'Maximum to spend on rent, groceries, bills' },
                    { label: 'Flexible Wants Limit (30%)', value: Math.round(income * 0.30), note: 'Dining out, shopping, entertainment cap' },
                    { label: 'Target Savings & Goals (20%)', value: Math.round(income * 0.20), note: 'Directly committed to emergency buffer or SIP' }
                ];
            }
        },

        practicalSteps: [
            'Calculate your predictable monthly in-hand income.',
            'Group your fixed recurring expenses (rent, utilities, groceries) and ensure they stay under 50%.',
            'Automate your 20% savings transfer on the day your salary arrives before spending on wants.',
            'Enjoy your 30% flexible spending guilt-free knowing your essentials and future are protected.'
        ],

        interactiveExercise: {
            type: 'budget-slider',
            title: 'Interactive 50/30/20 Simulator',
            instructions: 'Slide the income value to see how ideal bucket limits adjust automatically:',
            defaultIncome: 50000,
            min: 15000,
            max: 200000,
            step: 5000
        },

        quiz: [
            {
                question: 'Which of the following is considered an essential "Need" under the 50/30/20 rule?',
                options: [
                    'Weekend restaurant dining with friends',
                    'Monthly apartment rent and essential groceries',
                    'Premium movie streaming subscription',
                    'New fashion accessories on sale'
                ],
                correctIndex: 1,
                explanation: 'Needs are non-negotiable living costs required for daily survival, health, and livelihood, such as housing rent and basic food groceries.'
            },
            {
                question: 'If your monthly income is ₹60,000, what is your recommended monthly savings target under this rule?',
                options: [
                    '₹6,000 (10%)',
                    '₹12,000 (20%)',
                    '₹18,000 (30%)',
                    '₹30,000 (50%)'
                ],
                correctIndex: 1,
                explanation: 'Under the 50/30/20 rule, 20% of net income goes to savings and debt reduction: 20% of ₹60,000 = ₹12,000.'
            },
            {
                question: 'What is the most effective way to ensure you save your 20% target each month?',
                options: [
                    'Save whatever leftover money remains on the last day of the month',
                    'Pay yourself first by automating savings right when your salary arrives',
                    'Stop spending on all food and travel',
                    'Take a personal loan to invest'
                ],
                correctIndex: 1,
                explanation: 'Paying yourself first removes willpower friction. Automating the savings transfer prevents lifestyle inflation from consuming your surplus.'
            }
        ],

        whatIfQuery: 'What if I save 20% of my income every month?'
    },

    {
        id: 'food-dining-management',
        title: 'Controlling Food & Dining Delivery Spending',
        category: 'food',
        categoryLabel: 'Food & Dining',
        difficulty: 'beginner',
        estimatedMinutes: 4,
        summary: 'Understand the hidden compounding cost of frequent food delivery and small dining habits.',
        learningObjective: 'Learn how small, frequent food delivery orders quietly accumulate into major budget drains, and discover sustainable moderation techniques.',
        
        explanation: `Food is an essential human need, but modern app deliveries and spontaneous cafe visits blur the line between essential sustenance and discretionary comfort.
- **Convenience Tax**: Delivery fees, surge charges, packaging, and platform markups often add 30–50% to meal costs compared to groceries or cooking.
- **The Frequency Multiplier**: Spending ₹350 on food delivery 4 times a week amounts to ~₹5,600/month or over ₹67,000/year.
- **Sustainable Moderation**: You don't need to quit ordering food entirely. Reducing just 1–2 orders per week preserves flexibility while freeing significant cash flow.`,

        visualType: 'chart',
        chartConfig: {
            type: 'cost-comparison',
            title: 'Annual Cost: Home Cooking vs. Dining Out vs. Food Delivery Apps',
            data: [
                { category: 'Home Cooking', monthly: 4500, annual: 54000, color: '#059669' },
                { category: 'Mixed (Cook + Weekend Out)', monthly: 8500, annual: 102000, color: '#E5C690' },
                { category: 'Frequent Food Apps (4x/wk)', monthly: 14000, annual: 168000, color: '#dc2626' }
            ]
        },

        flowchartId: 'smart-purchase-filter',

        workedExample: {
            title: 'Real Impact of a 20% Food Spending Trim',
            description: 'Calculates the tangible cash saved by trimming discretionary food orders:',
            formula: 'Monthly Savings = Current Food Spend × 20%',
            calculate: (profile, transactions) => {
                const foodTx = transactions.filter(t => t.type === 'expense' && String(t.category).toLowerCase().includes('food'));
                const foodSpend = foodTx.reduce((s, t) => s + (Number(t.amount) || 0), 0) || 8000;
                const monthlySavings = Math.round(foodSpend * 0.20);
                const annualSavings = monthlySavings * 12;
                return [
                    { label: 'Current Food Spending', value: foodSpend, isBase: true },
                    { label: 'Modest 20% Reduction Target', value: monthlySavings, note: 'Equivalent to cutting ~1 delivery order per week' },
                    { label: 'New Monthly Food Budget', value: foodSpend - monthlySavings, note: 'Healthy and sustainable budget' },
                    { label: 'Annual Cash Freed for Goals', value: annualSavings, note: 'Can fund a vacation or emergency fund' }
                ];
            }
        },

        practicalSteps: [
            'Set a weekly dining & delivery cap rather than a vague monthly promise.',
            'Designate 2 specific "treat days" per week for restaurant food, keeping weekdays home-prepared.',
            'Delete saved payment cards from delivery apps to introduce friction before ordering.',
            'Redirect saved money directly into a dedicated goal so you see the tangible reward.'
        ],

        interactiveExercise: {
            type: 'expense-trimmer',
            title: 'Food Delivery Reduction Calculator',
            instructions: 'Adjust how many food deliveries you replace with groceries per week:',
            defaultCount: 2,
            averageCostPerOrder: 350,
            homeMealCost: 100
        },

        quiz: [
            {
                question: 'Why does food delivery spending often grow unnoticed compared to rent or utility bills?',
                options: [
                    'Food delivery companies hide transaction amounts from bank statements',
                    'It consists of many small, frequent transactions that fly under the mental radar',
                    'Food orders are legally classified as tax investments',
                    'It is impossible to view transaction history on delivery apps'
                ],
                correctIndex: 1,
                explanation: 'Small daily transactions (micro-spends) trigger less immediate pain of paying than a large single bill, but together they compound into substantial sums.'
            },
            {
                question: 'If you reduce your weekly food delivery from 4 times to 2 times, saving ₹700/week, how much do you save in a year?',
                options: [
                    '₹8,400',
                    '₹18,200',
                    '₹36,400',
                    '₹52,000'
                ],
                correctIndex: 2,
                explanation: '₹700 per week multiplied by 52 weeks in a year equals ₹36,400 saved annually!'
            }
        ],

        whatIfQuery: 'What if I reduce my food spending by 20%?'
    },

    {
        id: 'smart-purchase-filter',
        title: 'Needs vs. Wants: The Smart Purchase Filter',
        category: 'shopping',
        categoryLabel: 'Shopping & Impulse Control',
        difficulty: 'beginner',
        estimatedMinutes: 5,
        summary: 'A visual decision framework to stop buyer remorse and master intentional spending.',
        learningObjective: 'Master the 24-hour pause rule and multi-stage decision filter to eliminate impulsive purchases before they hurt your balance.',
        
        explanation: `Impulse buying occurs when emotional anticipation overrides rational evaluation. 
Retail platforms engineer high-pressure tactics like flash sales, countdown timers, and one-click checkouts specifically to bypass your rational filters.

The **Smart Purchase Filter** is a simple 3-stage mental checkpoint:
1. **The Need Check**: Is this solving an immediate survival or productivity problem, or is it an emotional want?
2. **The Liquidity Check**: Can you pay cash right now without dipping into your emergency buffer or borrowing?
3. **The 24-Hour Rule**: If it's a want over ₹1,000, place it on a 24-hour wishlist. In over 70% of cases, the dopamine urgency fades by morning.`,

        visualType: 'flowchart',
        flowchartId: 'smart-purchase-filter',

        workedExample: {
            title: 'Evaluating an Impulse Gadget / Fashion Purchase (₹6,000)',
            description: 'Running a real purchase evaluation through the decision filter:',
            formula: 'Balance - Purchase Cost ≥ Emergency Reserve',
            calculate: (profile, transactions) => {
                const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const balance = (profile?.openingBalance || 0) + totalIncome - totalExpense;
                const purchaseCost = 6000;
                const bufferRequired = 10000;
                const balanceAfter = balance - purchaseCost;
                return [
                    { label: 'Current Available Balance', value: balance, isBase: true },
                    { label: 'Intended Purchase Cost', value: purchaseCost },
                    { label: 'Post-Purchase Balance', value: balanceAfter, note: balanceAfter >= bufferRequired ? 'Safe liquidity remains' : 'Cuts into safety buffer!' },
                    { label: 'Recommendation', value: balanceAfter >= bufferRequired ? 'Wait 24 hours, then buy if still desired' : 'Save for 1 month first before purchasing', isText: true }
                ];
            }
        },

        practicalSteps: [
            'Create a digital "30-Day Wishlist" notes page on your phone.',
            'Whenever you feel an impulse to buy a non-essential item, write the item and date down instead of buying.',
            'If you still genuinely want the item after 30 days and have the cash surplus, buy it guilt-free.',
            'Unsubscribe from marketing emails that alert you to flash sales and seasonal discounts.'
        ],

        interactiveExercise: {
            type: 'purchase-evaluator',
            title: 'Test an Impulse Purchase Before Buying',
            instructions: 'Enter an item name and price to run it through the Smart Purchase Filter:',
            defaultItem: 'Wireless Headphones',
            defaultPrice: 4500
        },

        quiz: [
            {
                question: 'What is the primary psychological benefit of implementing the 24-Hour Rule?',
                options: [
                    'Prices usually drop by 50% after 24 hours',
                    'It allows emotional dopamine excitement to cool down so rational logic evaluates value',
                    'Banks offer bonus cashbacks on transactions delayed by 24 hours',
                    'It cancels all return policies'
                ],
                correctIndex: 1,
                explanation: 'Impulse buying is driven by short-lived dopamine spikes. Waiting 24 hours lets emotional urgency fade, allowing you to evaluate whether the purchase adds genuine utility.'
            },
            {
                question: 'When is a non-essential purchase considered financially safe to make?',
                options: [
                    'Whenever your credit card has available limit',
                    'When you can pay cash in full without draining your emergency buffer or missing goal savings',
                    'Only when it is on a 50% discount during a festival',
                    'Whenever your friend approves of the purchase'
                ],
                correctIndex: 1,
                explanation: 'Safe spending means purchasing from disposable surplus without compromising your emergency safety reserves or committed financial goals.'
            }
        ],

        whatIfQuery: 'Can I buy a laptop worth ₹87,000?'
    },

    {
        id: 'emergency-fund-blueprint',
        title: 'Building a Liquid Emergency Safety Buffer',
        category: 'emergency-fund',
        categoryLabel: 'Safety Net & Reserves',
        difficulty: 'beginner',
        estimatedMinutes: 5,
        summary: 'How to calculate your true survival number and build a 3-month buffer that prevents high-interest debt.',
        learningObjective: 'Calculate your exact monthly essential survival cost and build a step-by-step emergency fund roadmap.',
        
        explanation: `An emergency fund is the financial foundation of peace of mind. Without liquid savings, any unexpected life event—medical expense, laptop repair, job transition, or sudden travel—forces you into high-interest credit card debt or emergency loans.

- **Phase 1: Starter Safety Buffer (₹10,000–₹25,000)**: Protects against daily minor disruptions like vehicle repairs or appliance breakdowns.
- **Phase 2: 1-Month Basic Survival Reserve**: Covers essential rent, food, and bills for 30 days.
- **Phase 3: 3 to 6-Month Full Living Cushion**: Complete security against job loss, freelance dry spells, or medical leave.
- **Where to Keep It**: In liquid, low-risk accounts: high-yield savings accounts or instant-redemption liquid mutual funds. Never lock it in volatile stocks or illiquid assets.`,

        visualType: 'flowchart',
        flowchartId: 'emergency-fund-pyramid',

        workedExample: {
            title: 'Your Personal Emergency Fund Target Calculation',
            description: 'Calculated using your actual monthly essential expenses:',
            formula: 'Target = Monthly Essential Expenses × Months of Safety',
            calculate: (profile, transactions) => {
                const expenseTx = transactions.filter(t => t.type === 'expense');
                const monthlySpend = expenseTx.reduce((s, t) => s + (Number(t.amount) || 0), 0) || 30000;
                const essentialSpend = Math.round(monthlySpend * 0.70); // 70% typical essentials
                return [
                    { label: 'Estimated Monthly Essential Needs', value: essentialSpend, isBase: true },
                    { label: 'Phase 1: Starter Buffer', value: Math.min(25000, essentialSpend), note: 'Immediate protection against minor surprises' },
                    { label: 'Phase 2: 1-Month Essential Cushion', value: essentialSpend, note: 'Complete 30-day survival buffer' },
                    { label: 'Phase 3: 3-Month Emergency Reserve', value: essentialSpend * 3, note: 'Target resilience against career transitions' }
                ];
            }
        },

        practicalSteps: [
            'Separate your emergency money from your daily spending account so you aren\'t tempted to tap it.',
            'Start with an achievable milestone: save ₹1,000 to ₹2,000 each month consistently.',
            'Define what counts as a genuine emergency: unexpected, necessary, and urgent (not a holiday sale).',
            'Replenish the fund immediately whenever you are forced to make an emergency withdrawal.'
        ],

        interactiveExercise: {
            type: 'emergency-calculator',
            title: 'Emergency Cushion Target Calculator',
            instructions: 'Select your target security cushion to calculate your savings milestone:',
            defaultMonths: 3,
            minMonths: 1,
            maxMonths: 6
        },

        quiz: [
            {
                question: 'Where should your emergency fund be stored for optimal safety?',
                options: [
                    'Cryptocurrency tokens for maximum upside',
                    'In high-risk volatile stocks',
                    'In a high-yield savings account or instant liquid mutual fund',
                    'Locked into a 10-year real estate investment'
                ],
                correctIndex: 2,
                explanation: 'Emergency funds require immediate liquidity and capital preservation. High-yield savings accounts or liquid funds ensure your money is accessible within hours without risk of capital loss.'
            },
            {
                question: 'Which of the following is a valid emergency to use this fund for?',
                options: [
                    'Buying designer clothes on a limited-time 40% discount',
                    'Sudden medical hospital emergency or urgent vehicle engine repair',
                    'Booking a flight for a spontaneous weekend trip',
                    'Buying gifts during a friend\'s birthday'
                ],
                correctIndex: 1,
                explanation: 'A true emergency meets three criteria: unexpected, necessary, and urgent. Medical emergencies and unexpected critical repairs qualify; lifestyle events do not.'
            }
        ],

        whatIfQuery: 'What if I save ₹2,000 more every month?'
    },

    {
        id: 'subscription-audit',
        title: 'The 30-Day Subscription & Recurring Bill Audit',
        category: 'subscriptions',
        categoryLabel: 'Subscriptions & Recurring',
        difficulty: 'beginner',
        estimatedMinutes: 4,
        summary: 'Identify zombie subscriptions and silent monthly drains to free up recurring cash flow.',
        learningObjective: 'Learn how to conduct a recurring service audit and implement a rotation strategy for digital entertainment.',
        
        explanation: `Digital subscriptions thrive on **financial inertia**—the tendency to keep paying for a service simply because cancelling takes effort.
- **The Micro-Drain Effect**: A ₹299 OTT plan, a ₹199 music plan, a ₹599 gym app, and a ₹499 cloud backup total over ₹1,596/month or ~₹19,000/year.
- **The "Rotate, Don't Stack" Method**: Instead of maintaining 4 streaming subscriptions simultaneously, subscribe to only one active service per month. Watch your desired shows, cancel, and switch to another the next month.
- **Annual Plan Traps**: Only commit to annual subscriptions for utility tools you've actively used for at least 3 consecutive months.`,

        visualType: 'chart',
        chartConfig: {
            type: 'cost-comparison',
            title: 'Concurrent Subscriptions vs. Monthly Rotation Strategy',
            data: [
                { category: '4 Active Subscriptions', monthly: 1600, annual: 19200, color: '#dc2626' },
                { category: 'Rotation (1 active at a time)', monthly: 400, annual: 4800, color: '#059669' }
            ]
        },

        flowchartId: 'budget-overrun-remedy',

        workedExample: {
            title: 'Compounding Value of Auditing 2 Subscriptions',
            description: 'Cancelling 2 inactive subscriptions at ₹399 and ₹499 per month:',
            formula: 'Freed Monthly Cash = Sum of Cancelled Recurring Fees',
            calculate: (profile, transactions) => {
                const monthlyFreed = 898; // ~₹898/month
                const annualFreed = monthlyFreed * 12;
                const fiveYearSIP = Math.round(annualFreed * 5 * 1.3); // with growth
                return [
                    { label: 'Cancelled Services Total', value: monthlyFreed, isBase: true },
                    { label: 'Annual Cash Restored', value: annualFreed, note: 'Directly back into your bank account' },
                    { label: '5-Year Wealth if Invested at 12%', value: fiveYearSIP, note: 'Compound growth of small recurring savings' }
                ];
            }
        },

        practicalSteps: [
            'Review last month\'s bank and credit card statement line-by-line for all recurring auto-debit charges.',
            'Cancel any streaming service or digital app you haven\'t opened in the past 14 days.',
            'Turn off auto-renew on mobile app store subscriptions so each billing cycle requires intentional opt-in.',
            'Adopt the "1-in, 1-out" rule: to subscribe to a new service, cancel an existing one.'
        ],

        interactiveExercise: {
            type: 'subscription-toggle',
            title: 'Interactive Subscription Audit Calculator',
            instructions: 'Toggle the common digital services below to see your potential annual savings:'
        },

        quiz: [
            {
                question: 'What is the "Rotate, Don\\\'t Stack" strategy for entertainment subscriptions?',
                options: [
                    'Sharing passwords with strangers online',
                    'Maintaining only one active streaming service at a time and switching when you finish a show',
                    'Buying lifetime subscriptions to every service simultaneously',
                    'Using credit cards to pay for annual memberships'
                ],
                correctIndex: 1,
                explanation: 'Rotating means subscribing to one service at a time, watching your series, and canceling before subscribing to the next. You get 100% of the entertainment for 25% of the cost.'
            }
        ],

        whatIfQuery: 'What if I reduce my bills and subscriptions by ₹1,000?'
    },

    {
        id: 'goal-milestone-planning',
        title: 'Goal Milestone Planning & Consistent Savings',
        category: 'goals',
        categoryLabel: 'Milestones & Habits',
        difficulty: 'intermediate',
        estimatedMinutes: 5,
        summary: 'Break intimidating financial targets into automatic monthly habits that guarantee success.',
        learningObjective: 'Learn how reverse goal engineering and milestone pacing eliminate financial overwhelm and ensure goal achievement.',
        
        explanation: `Big financial targets (buying a vehicle, building an emergency fund, taking a major trip) feel impossible when viewed as a massive lump sum.
- **Reverse Goal Engineering**: Divide the total target cost by the number of months until your target date to discover your exact monthly pace.
- **Consistency Over Intensity**: Contributing ₹3,000 every single month for 2 years (₹72,000) is far more achievable and sustainable than trying to save ₹50,000 in two panicked months.
- **Visual Milestone Tracking**: Breaking a goal into 25%, 50%, and 75% checkpoints triggers positive dopamine reinforcements that maintain savings stamina.`,

        visualType: 'flowchart',
        flowchartId: 'cash-flow-hierarchy',

        workedExample: {
            title: 'Reverse Engineering a ₹1,20,000 Goal in 12 Months',
            description: 'Calculating the exact monthly contribution pace:',
            formula: 'Monthly Required = Target Amount ÷ Months',
            calculate: (profile, transactions) => {
                const target = 120000;
                const months = 12;
                const monthlyRequired = Math.round(target / months);
                return [
                    { label: 'Total Goal Target Amount', value: target, isBase: true },
                    { label: 'Target Horizon', value: `${months} Months`, isText: true },
                    { label: 'Required Monthly Contribution', value: monthlyRequired, note: 'Automate this transfer on payday' },
                    { label: 'Quarterly Milestone (Every 3 Mo)', value: monthlyRequired * 3, note: 'Celebrate each 25% checkpoint' }
                ];
            }
        },

        practicalSteps: [
            'Give every goal an emotional name and a hard target date (e.g., "Kyoto Trip Nov 2027").',
            'Calculate the monthly contribution required and verify it fits within your 20% savings budget.',
            'Open a dedicated sub-account or goal bucket so funds don\'t mingle with everyday spending.',
            'Treat your monthly goal contribution as a mandatory non-negotiable bill paid to your future self.'
        ],

        interactiveExercise: {
            type: 'goal-calculator',
            title: 'Interactive Goal Pace Calculator',
            instructions: 'Enter a target amount and desired timeline to calculate your monthly pace:',
            defaultTarget: 60000,
            defaultMonths: 12
        },

        quiz: [
            {
                question: 'What is the most common reason people fail to achieve large savings goals?',
                options: [
                    'Banks refuse to accept monthly deposits',
                    'Relying on saving whatever money happens to be left at the end of the month without a defined pace',
                    'Setting goals with deadlines longer than 3 days',
                    'Saving in fixed deposits'
                ],
                correctIndex: 1,
                explanation: 'Without reverse-engineering a specific monthly savings pace and automating contributions, everyday lifestyle spending naturally consumes any leftover balance.'
            }
        ],

        whatIfQuery: 'What if I save ₹5,000 more every month?'
    },

    {
        id: 'compound-interest-wealth',
        title: 'The Power of Compound Interest & Wealth Building',
        category: 'investing',
        categoryLabel: 'Wealth Building',
        difficulty: 'intermediate',
        estimatedMinutes: 6,
        summary: 'Understand how compounding turns small, patient monthly contributions into exponential wealth over time.',
        learningObjective: 'Master the mechanics of compound returns and understand why starting early matters far more than starting with large amounts.',
        
        explanation: `Simple interest earns returns only on your original principal. **Compound interest** earns returns on your principal PLUS all previously accumulated returns.
- **The Snowball Effect**: In the early years, compounding feels slow. But after 7–10 years, the returns earned each year begin to exceed the actual money you contributed that year.
- **The Cost of Waiting**: Starting to invest ₹3,000/month at age 22 generates over double the wealth by age 50 compared to someone who waits until age 32 and invests ₹6,000/month!
- **Discipline Beats Timing**: Consistent monthly contributions through index funds or mutual funds outperform trying to guess market tops and bottoms.`,

        visualType: 'chart',
        chartConfig: {
            type: 'compound-growth',
            title: '15-Year Growth: Total Contributions vs. Compounded Value (at 12% p.a.)',
            data: [
                { year: 'Year 1', invested: 36000, value: 38400 },
                { year: 'Year 3', invested: 108000, value: 130000 },
                { year: 'Year 5', invested: 180000, value: 247000 },
                { year: 'Year 8', invested: 288000, value: 480000 },
                { year: 'Year 10', invested: 360000, value: 700000 },
                { year: 'Year 12', invested: 432000, value: 1010000 },
                { year: 'Year 15', invested: 540000, value: 1500000 }
            ]
        },

        flowchartId: 'cash-flow-hierarchy',

        workedExample: {
            title: '10-Year SIP of ₹3,000/Month at 12% Annualized Return',
            description: 'Compounding projection of disciplined small investments:',
            formula: 'A = P × [((1 + r)^n - 1) / r] × (1 + r)',
            calculate: (profile, transactions) => {
                const monthly = 3000;
                const totalInvested = monthly * 12 * 10; // 360,000
                const estimatedValue = 697000; // ~7 Lakhs at 12%
                const returnsEarned = estimatedValue - totalInvested;
                return [
                    { label: 'Monthly Investment', value: monthly, isBase: true },
                    { label: 'Total Capital Invested (10 Yrs)', value: totalInvested },
                    { label: 'Pure Compounded Growth Earned', value: returnsEarned, note: 'Money made by your money' },
                    { label: 'Total Accumulated Wealth', value: estimatedValue, note: 'Nearly 2x your total investment' }
                ];
            }
        },

        practicalSteps: [
            'Ensure high-interest debts are cleared and an emergency fund is in place before investing.',
            'Start an automatic monthly SIP into a broad-market index fund (e.g., Nifty 50).',
            'Increase your monthly investment by 5–10% every year as your salary grows.',
            'Ignore short-term market volatility; time in the market consistently beats timing the market.'
        ],

        interactiveExercise: {
            type: 'sip-calculator',
            title: 'Interactive Compound Growth Simulator',
            instructions: 'Adjust the monthly investment and timeframe to see exponential wealth accumulation:',
            defaultMonthly: 3000,
            defaultYears: 10,
            ratePercent: 12
        },

        quiz: [
            {
                question: 'What is the most critical factor that accelerates compound interest?',
                options: [
                    'Timing the exact bottom of the stock market',
                    'Time—giving your investments decades to multiply upon past earnings',
                    'Checking portfolio value daily',
                    'Borrowing money to invest'
                ],
                correctIndex: 1,
                explanation: 'Time is the exponent in the compounding equation. The longer returns have to generate additional returns, the more dramatic the exponential growth curve becomes.'
            }
        ],

        whatIfQuery: 'What if I save ₹3,000 more every month?'
    }
];

export const FLOWCHART_DIAGRAMS = {
    'smart-purchase-filter': {
        id: 'smart-purchase-filter',
        title: 'The Smart Purchase Decision Tree',
        subtitle: 'Run any non-essential purchase through this 3-stage filter to prevent impulse regret.',
        nodes: [
            {
                id: 'start',
                title: 'Desire to Make a Purchase',
                description: 'You see an item online or in a shop that costs > ₹1,000.',
                type: 'start',
                branches: [
                    { label: 'Check Necessity', nextId: 'check-need' }
                ]
            },
            {
                id: 'check-need',
                title: 'Question 1: Is this an Essential Need?',
                description: 'Will not buying this immediately impact your health, job, shelter, or basic sustenance?',
                type: 'decision',
                branches: [
                    { label: 'YES (Essential Need)', nextId: 'need-yes', actionType: 'proceed' },
                    { label: 'NO (Lifestyle Want)', nextId: 'check-afford', actionType: 'filter' }
                ]
            },
            {
                id: 'need-yes',
                title: '✅ Essential Need Approved',
                description: 'Buy with confidence. Compare prices or check for coupons, but prioritize prompt fulfilment.',
                type: 'result-success'
            },
            {
                id: 'check-afford',
                title: 'Question 2: Is it Affordable from Cash Surplus?',
                description: 'Can you pay 100% in cash today without dipping into your emergency buffer or borrowing on credit?',
                type: 'decision',
                branches: [
                    { label: 'YES (Cash Available)', nextId: 'check-pause', actionType: 'proceed' },
                    { label: 'NO (Would Drain Buffer)', nextId: 'afford-no', actionType: 'stop' }
                ]
            },
            {
                id: 'afford-no',
                title: '🛑 Save First, Buy Later',
                description: 'Do not finance non-essentials. Set up a savings goal and revisit when you have the cash surplus ready.',
                type: 'result-warning'
            },
            {
                id: 'check-pause',
                title: 'Question 3: The 24-Hour Pause Rule',
                description: 'Add the item to a wishlist and wait 24 hours. Do you still genuinely want and value it tomorrow morning?',
                type: 'decision',
                branches: [
                    { label: 'YES (Still genuinely desired)', nextId: 'pause-yes', actionType: 'proceed' },
                    { label: 'NO (Urge faded)', nextId: 'pause-no', actionType: 'saved' }
                ]
            },
            {
                id: 'pause-yes',
                title: '🎉 Intentional Purchase Approved',
                description: 'You have verified need, affordability, and lasting desire. Enjoy your purchase completely guilt-free!',
                type: 'result-success'
            },
            {
                id: 'pause-no',
                title: '💰 Impulsive Bullet Dodged!',
                description: 'Congratulations! You just prevented buyer remorse and protected your hard-earned money.',
                type: 'result-celebrate'
            }
        ]
    },

    'cash-flow-hierarchy': {
        id: 'cash-flow-hierarchy',
        title: 'The Cash Flow Allocation Flowchart',
        subtitle: 'The step-by-step priority order for every rupee of your monthly income.',
        nodes: [
            {
                id: 'start',
                title: 'Income Hits Your Bank Account',
                description: 'Salary, freelance earnings, or business cash flow arrives.',
                type: 'start',
                branches: [
                    { label: 'Step 1: Fund Essentials', nextId: 'step-needs' }
                ]
            },
            {
                id: 'step-needs',
                title: 'Priority 1: Essential Needs (Max 50%)',
                description: 'Rent, groceries, utilities, transit, medicine, minimum loan EMIs.',
                type: 'step',
                branches: [
                    { label: 'Step 2: Emergency Buffer', nextId: 'step-emergency' }
                ]
            },
            {
                id: 'step-emergency',
                title: 'Priority 2: Emergency Safety Buffer',
                description: 'Do you have at least 1–3 months of essential expenses in liquid savings?',
                type: 'decision',
                branches: [
                    { label: 'NO: Fund Buffer First', nextId: 'buffer-priority', actionType: 'filter' },
                    { label: 'YES: Buffer Complete', nextId: 'step-goals', actionType: 'proceed' }
                ]
            },
            {
                id: 'buffer-priority',
                title: '🛡️ Build Your Safety Shield',
                description: 'Direct your 20% savings bucket into your liquid emergency fund until 1 month minimum is reached.',
                type: 'result-warning'
            },
            {
                id: 'step-goals',
                title: 'Priority 3: Wealth Goals & Investments (20%)',
                description: 'Long-term SIPs, retirement funds, and committed savings goals.',
                type: 'step',
                branches: [
                    { label: 'Step 4: Flexible Wants', nextId: 'step-wants' }
                ]
            },
            {
                id: 'step-wants',
                title: 'Priority 4: Guilt-Free Lifestyle Wants (30%)',
                description: 'Dining out, hobbies, shopping, vacations. Spend with total peace of mind.',
                type: 'result-success'
            }
        ]
    },

    'budget-overrun-remedy': {
        id: 'budget-overrun-remedy',
        title: 'Budget Overrun Recovery Decision Tree',
        subtitle: 'What to do when monthly spending exceeds your target pace.',
        nodes: [
            {
                id: 'start',
                title: 'Spending Exceeding Budget',
                description: 'Mid-month check shows expenses higher than the planned 50% or 30% benchmarks.',
                type: 'start',
                branches: [
                    { label: 'Diagnose Overrun', nextId: 'diagnose' }
                ]
            },
            {
                id: 'diagnose',
                title: 'Where did the surge occur?',
                description: 'Inspect transaction categories in Where Did My Money Go.',
                type: 'decision',
                branches: [
                    { label: 'Single Spike (One-off purchase)', nextId: 'spike-remedy', actionType: 'filter' },
                    { label: 'Micro-leak (Dining/Shopping)', nextId: 'leak-remedy', actionType: 'proceed' },
                    { label: 'Fixed Bill Increase (Rent/Utility)', nextId: 'fixed-remedy', actionType: 'stop' }
                ]
            },
            {
                id: 'spike-remedy',
                title: '⚡ One-Time Spike Protocol',
                description: 'Acknowledge the event. Freeze all discretionary shopping for the remaining days of the month to let cash flow re-stabilize.',
                type: 'result-warning'
            },
            {
                id: 'leak-remedy',
                title: '🍽️ Micro-Leak Protocol',
                description: 'Switch to a weekly cash envelope or food delivery cap. Pausing 2 app orders per week restores balance within 10 days.',
                type: 'result-success'
            },
            {
                id: 'fixed-remedy',
                title: '🏠 Fixed Cost Realignment',
                description: 'Your baseline needs expanded. Rebalance the budget: trim 5% from flexible wants or investigate cheaper alternative plans.',
                type: 'result-warning'
            }
        ]
    },

    'emergency-fund-pyramid': {
        id: 'emergency-fund-pyramid',
        title: 'The Emergency Fund Milestones Pyramid',
        subtitle: 'Four progressive checkpoints from vulnerable to financially bulletproof.',
        nodes: [
            {
                id: 'start',
                title: 'Start at Ground Zero',
                description: 'Evaluate your current liquid safety cushion.',
                type: 'start',
                branches: [
                    { label: 'Milestone 1', nextId: 'm1' }
                ]
            },
            {
                id: 'm1',
                title: 'Checkpoint 1: Starter Shield (₹10,000–₹25,000)',
                description: 'Immediate buffer for daily minor surprises (appliance breakdown, puncture).',
                type: 'step',
                branches: [
                    { label: 'Milestone 2', nextId: 'm2' }
                ]
            },
            {
                id: 'm2',
                title: 'Checkpoint 2: 1-Month Survival Cushion',
                description: 'Full 30-day coverage of rent, basic groceries, and essential utility bills.',
                type: 'step',
                branches: [
                    { label: 'Milestone 3', nextId: 'm3' }
                ]
            },
            {
                id: 'm3',
                title: 'Checkpoint 3: 3-Month Resilience Reserve',
                description: 'Solid defense against temporary career transitions or medical leaves.',
                type: 'step',
                branches: [
                    { label: 'Milestone 4', nextId: 'm4' }
                ]
            },
            {
                id: 'm4',
                title: 'Checkpoint 4: 6-Month Bulletproof Fortress',
                description: 'Ultimate security and career freedom. You can navigate any economic storm with total confidence.',
                type: 'result-celebrate'
            }
        ]
    }
};
