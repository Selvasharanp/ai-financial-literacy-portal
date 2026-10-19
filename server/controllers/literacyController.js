const LiteracyContent = require('../models/LiteracyContent');
const Transaction = require('../models/Transaction');
const Goal = require('../models/Goal');
const User = require('../models/User');
const { analyzeTransactions } = require('../services/insightEngine');

const starterContent = [
    // Foundational / General
    { title: 'Build a simple monthly budget', content: 'Assign every rupee a job: essentials, savings, and flexible spending. Review it weekly.', category: 'general', tags: ['general', 'foundational', 'poor-budget-adherence'], difficulty: 'beginner' },
    { title: 'Understanding cash flow tracking', content: 'Track income against daily expenses to see where your money goes each month.', category: 'general', tags: ['general', 'foundational'], difficulty: 'beginner' },

    // Food Spending Management
    { title: 'How to control food delivery spending', content: 'Set a weekly food cap, plan a few meals, and check your food total before ordering.', category: 'food', tags: ['overspending-food', 'food'], difficulty: 'beginner' },
    { title: 'Needs vs. Wants: Managing dining out', content: 'Differentiate daily essential sustenance from dining out experiences to maintain control.', category: 'food', tags: ['overspending-food', 'food', 'discretionary'], difficulty: 'intermediate' },

    // Shopping / Impulse Buys / Spikes
    { title: 'Spend less on shopping without feeling deprived', content: 'Use a 24-hour pause for non-essential wants and keep a wish list before buying.', category: 'shopping', tags: ['overspending-shopping', 'spending-spike', 'impulse'], difficulty: 'beginner' },
    { title: 'Delayed gratification & smart purchasing', content: 'Waiting 24 to 48 hours before big impulse buys reduces unnecessary purchases by 40%.', category: 'shopping', tags: ['spending-spike', 'impulse'], difficulty: 'intermediate' },

    // Subscriptions
    { title: 'Audit your monthly subscriptions', content: 'Review recurring digital charges once a month and keep only services you actively use.', category: 'subscriptions', tags: ['high-subscription-spending', 'subscriptions'], difficulty: 'beginner' },

    // Emergency Fund / Buffer
    { title: 'Building your first emergency safety buffer', content: 'Aim to keep at least 1 month of essential living costs in liquid available balance.', category: 'emergency-fund', tags: ['emergency-fund', 'buffer', 'tight-remaining-days'], difficulty: 'beginner' },

    // Goal Planning & Consistent Contribution Recognition
    { title: 'Building a consistent monthly savings habit', content: 'Set realistic monthly goal contributions. Focus on consistency over large single amounts.', category: 'goals', tags: ['new-goal-encouragement', 'consistent-goal-progress', 'goal-planning'], difficulty: 'beginner' },
    { title: 'Setting & milestone-tracking financial goals', content: 'Break large long-term goals into monthly milestones to keep progress visible and achievable.', category: 'goals', tags: ['goal-planning', 'consistent-goal-progress'], difficulty: 'intermediate' },

    // Advanced Topics for Healthy Spending
    { title: 'Introduction to investing & wealth building', content: 'Once your monthly expenses are stable, explore low-cost index funds and long-term asset growth.', category: 'investing', tags: ['investing', 'healthy-spending', 'advanced'], difficulty: 'intermediate' },
    { title: 'The power of compound interest', content: 'Reinvesting returns over time allows compound interest to accelerate wealth growth exponentially.', category: 'investing', tags: ['compound-interest', 'healthy-spending', 'advanced'], difficulty: 'intermediate' },
    { title: 'Credit awareness & credit score basics', content: 'Maintaining low credit utilization and paying bills on time builds a strong credit score.', category: 'credit', tags: ['credit', 'healthy-spending', 'advanced'], difficulty: 'intermediate' }
];

const contentOrStarter = async () => {
    const content = await LiteracyContent.find();
    return content.length ? [...content, ...starterContent] : starterContent;
};

exports.getAllContent = async (req, res) => {
    try {
        res.json(await contentOrStarter());
    } catch {
        res.status(500).json({ error: 'Failed to fetch literacy content' });
    }
};

exports.getRecommendedContent = async (req, res) => {
    try {
        const [transactions, goals, user, library] = await Promise.all([
            Transaction.find({ userId: req.user.id }),
            Goal.find({ userId: req.user.id }),
            User.findById(req.user.id).select('openingBalance'),
            contentOrStarter()
        ]);

        const analysis = analyzeTransactions(transactions, goals, new Date(), user?.openingBalance || 0);

        // Rotation offset for repetition avoidance
        const rotateIndex = Number(req.query.rotate || 0);

        // Behavior signals
        const isNewUser = transactions.length === 0 && (user?.openingBalance || 0) === 0;
        const currentExpenses = transactions.filter(t => t.type === 'expense');
        const foodExpenses = currentExpenses.filter(t => String(t.category).toLowerCase() === 'food');
        const foodTotal = foodExpenses.reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const totalExpenses = currentExpenses.reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const hasFoodOverspend = analysis.alerts.some(a => a.tag?.includes('food')) || (totalExpenses > 0 && foodTotal / totalExpenses > 0.25);
        const hasHighSubscriptions = analysis.alerts.some(a => a.tag === 'high-subscription-spending');
        const hasSpendingSpike = analysis.alerts.some(a => a.tag === 'spending-spike' || a.tag?.includes('shopping'));
        const hasLowBuffer = analysis.health.balance < 5000 || analysis.alerts.some(a => a.tag === 'tight-remaining-days');
        const hasNewGoal = goals.some(g => g.status === 'active') && analysis.alerts.some(a => a.tag === 'new-goal-encouragement');
        const hasConsistentGoal = goals.some(g => g.status === 'active' && Number(g.currentAmount) > 0);
        const isHealthySpending = analysis.health.isManageableMonth && (!analysis.alerts.length || analysis.alerts.every(a => a.priority === 'LOW'));

        let targetTags = ['general', 'foundational'];
        let detectedIssue = 'Personalized Financial Literacy';
        let customExplanation = '';

        if (isNewUser) {
            targetTags = ['foundational', 'general'];
            detectedIssue = 'Start with the essentials';
            customExplanation = "You've recently started tracking your finances. Explore these fundamentals while we learn your spending patterns.";
        } else if (hasFoodOverspend) {
            targetTags = ['overspending-food', 'food', 'discretionary'];
            detectedIssue = 'Food & dining spending management';
            customExplanation = 'Food spending is taking a noticeable share of your expenses. Small adjustments can free up extra cash buffer.';
        } else if (hasHighSubscriptions) {
            targetTags = ['high-subscription-spending', 'subscriptions'];
            detectedIssue = 'Subscription audit & recurring expenses';
            customExplanation = 'Recurring subscriptions quietly accumulate over time. Auditing active services helps keep costs lean.';
        } else if (hasSpendingSpike) {
            targetTags = ['spending-spike', 'overspending-shopping', 'impulse'];
            detectedIssue = 'Impulse control & spending spikes';
            customExplanation = 'Managing single-day spending spikes and impulse purchases helps keep your monthly budget predictable.';
        } else if (hasLowBuffer) {
            targetTags = ['emergency-fund', 'buffer', 'tight-remaining-days'];
            detectedIssue = 'Building an emergency safety buffer';
            customExplanation = 'Maintaining a liquid emergency buffer protects you from unexpected cash flow crunches.';
        } else if (hasNewGoal) {
            targetTags = ['new-goal-encouragement', 'goal-planning'];
            detectedIssue = 'Goal planning & habit building';
            customExplanation = "You've recently started working toward a goal. Focus on building a steady monthly contribution habit.";
        } else if (hasConsistentGoal && !analysis.alerts.some(a => a.priority === 'HIGH')) {
            targetTags = ['consistent-goal-progress', 'wealth-building', 'goal-planning'];
            detectedIssue = 'Recognizing consistent goal contributions';
            customExplanation = 'Great job maintaining consistent goal contributions! Keep progressing steadily toward your milestone.';
        } else if (isHealthySpending) {
            targetTags = ['investing', 'compound-interest', 'healthy-spending', 'advanced'];
            detectedIssue = 'Healthy spending: Explore advanced financial literacy topics';
            customExplanation = 'Your spending is currently under control and your pace looks sustainable. Explore wealth building topics below.';
        }

        // Match educational content from library
        let matchingContent = library.filter(item => item.tags && item.tags.some(tag => targetTags.includes(tag)));
        if (!matchingContent.length) {
            matchingContent = library.filter(item => item.tags && item.tags.includes('general'));
        }

        // Apply rotation for repetition avoidance
        const selectedIndex = rotateIndex % Math.max(1, matchingContent.length);
        const selectedLearning = matchingContent[selectedIndex] || matchingContent[0];

        const recommendations = [{
            type: isHealthySpending ? 'positive_reinforcement' : 'behavior_learning',
            tag: targetTags[0],
            title: detectedIssue,
            whatHappened: customExplanation || (analysis.alerts[0]?.whatHappened || 'Your financial behavior has been analyzed.'),
            whyItMatters: 'Targeted learning helps turn financial habits into long-term financial freedom.',
            friendlyExplanation: customExplanation,
            action: selectedLearning ? selectedLearning.title : 'Explore this topic',
            learning: selectedLearning ? {
                title: selectedLearning.title,
                content: selectedLearning.content,
                category: selectedLearning.category,
                difficulty: selectedLearning.difficulty
            } : null
        }];

        res.json({
            detectedIssue,
            health: analysis.health,
            recommendations,
            availableModules: matchingContent.map(m => m.title)
        });

    } catch (err) {
        console.error('[Literacy] Recommendation request failed:', err);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
};

exports.addContent = async (req, res) => {
    try {
        const newContent = new LiteracyContent(req.body);
        await newContent.save();
        res.status(201).json(newContent);
    } catch {
        res.status(500).json({ error: 'Failed to add content' });
    }
};
