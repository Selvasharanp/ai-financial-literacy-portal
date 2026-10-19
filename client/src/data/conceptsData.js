// client/src/data/conceptsData.js
// 8 Core Financial Education Concepts for FinWise AI Literacy Hub

export const CONCEPTS_DATA = [
  {
    id: 'budgeting-saving',
    title: 'Budgeting & Saving: The 50/30/20 Rule',
    category: 'Budgeting and Saving',
    estimatedMinutes: 4,
    summary: 'A simple, stress-free method to divide your monthly income between essentials, lifestyle, and future wealth.',
    explanation: [
      'Budgeting is not about restriction or giving up the things you love. It is about intentionally directing every rupee where you want it to go before the month begins, rather than wondering where it went at the end.',
      'The gold-standard framework for beginners is the 50/30/20 Rule:',
      '• 50% for Needs: Non-negotiable living essentials required for survival and livelihood. This includes housing rent, groceries, electricity, water, commuting to work, medicine, and minimum debt payments.',
      '• 30% for Wants: Discretionary lifestyle spending that brings comfort and enjoyment. This includes dining out, weekend entertainment, shopping, movies, and streaming subscriptions.',
      '• 20% for Savings & Investments: Securing your emergency safety cushion, funding monthly SIPs in mutual funds, and paying down debt ahead of schedule.'
    ],
    example: {
      title: 'Realistic Example: ₹50,000 Monthly Take-Home Salary',
      description: 'Here is how a ₹50,000 monthly income splits under the 50/30/20 rule:',
      items: [
        { label: 'Essential Needs (50%)', amount: '₹25,000', note: 'Rent: ₹15k, Groceries: ₹6k, Utilities & Commute: ₹4k' },
        { label: 'Flexible Wants (30%)', amount: '₹15,000', note: 'Dining out: ₹6k, Shopping: ₹5k, Entertainment: ₹4k' },
        { label: 'Savings & Investments (20%)', amount: '₹10,000', note: 'Index Fund SIP: ₹6k, Emergency Buffer: ₹4k' }
      ],
      result: 'In just 1 year, you effortlessly save ₹1,20,000 while fully enjoying your lifestyle without money stress.'
    },
    activity: {
      type: 'budget',
      title: 'Interactive 50/30/20 Budget Calculator',
      description: 'Adjust your monthly in-hand salary to calculate your exact monthly targets:'
    },
    takeaway: 'Pay yourself first. Automate your 20% savings on the day your salary arrives, and spend the remaining balance without guilt.'
  },
  {
    id: 'compound-interest',
    title: 'Compound Interest: The Wealth Multiplier',
    category: 'Compound Interest',
    estimatedMinutes: 5,
    summary: 'How earning interest on your previous interest causes your money to grow exponentially over time.',
    explanation: [
      'Simple interest earns returns only on your original principal deposit. Compound interest, however, earns returns on both your principal and the accumulated interest from all previous periods.',
      'In the first few years, compound interest looks slow and steady. But after 10, 15, or 20 years, your accumulated interest starts generating far more money every year than your original salary deposits. This exponential acceleration is what builds long-term wealth.',
      'The three key ingredients of compound interest are: Amount invested, Expected return rate, and most importantly, Time.'
    ],
    example: {
      title: 'Realistic Example: Investing ₹10,000 / Month at 12% Return',
      description: 'A disciplined monthly SIP into a broad equity index fund over 20 years:',
      items: [
        { label: 'At 10 Years', amount: '₹23.2 Lakhs', note: 'You invested ₹12 Lakhs • Interest gained: ₹11.2 Lakhs' },
        { label: 'At 20 Years', amount: '₹99.9 Lakhs', note: 'You invested ₹24 Lakhs • Interest gained: ₹75.9 Lakhs!' }
      ],
      result: 'Notice: During the second 10-year period, your wealth increased by over ₹76 Lakhs, even though your own deposits were only ₹12 Lakhs!'
    },
    activity: {
      type: 'compound',
      title: 'Interactive Compound Growth Simulator',
      description: 'See how your monthly investment multiplies across different time horizons:'
    },
    takeaway: 'Time in the market beats timing the market. Starting even 5 years earlier can double your eventual retirement wealth.'
  },
  {
    id: 'inflation',
    title: 'Inflation: The Silent Purchasing Power Eater',
    category: 'Inflation',
    estimatedMinutes: 4,
    summary: 'Why prices increase every year and how keeping cash in a savings account quietly reduces your wealth.',
    explanation: [
      'Inflation is the steady rise in the prices of goods and services over time. If annual inflation is 6%, an item that costs ₹100 today will cost ₹106 next year.',
      'The hidden danger of inflation is purchasing power erosion. If your money sits idle in a standard bank savings account earning 3% interest while inflation is 6%, your real purchasing power drops by 3% every single year.',
      'Even though your bank balance looks the same, that money buys fewer groceries, fuel, and medical services as time passes.'
    ],
    example: {
      title: 'Realistic Example: Household Expenses Over Time',
      description: 'If your family needs ₹30,000/month today for groceries and living essentials at 6% annual inflation:',
      items: [
        { label: 'Today', amount: '₹30,000 / month', note: 'Current baseline living expenses' },
        { label: 'In 10 Years', amount: '₹53,725 / month', note: 'Same exact goods cost 79% more' },
        { label: 'In 20 Years', amount: '₹96,214 / month', note: 'You need over triple the rupees for the same lifestyle!' }
      ],
      result: 'To preserve your wealth, your long-term money must be invested in assets that deliver higher returns than inflation after tax.'
    },
    activity: {
      type: 'inflation',
      title: 'Interactive Inflation Impact Calculator',
      description: 'See how future inflation increases the cost of your current expenses:'
    },
    takeaway: 'Cash in a bank account guarantees safety of principal, but guarantees loss of purchasing power. Invest to beat inflation.'
  },
  {
    id: 'loans-emi',
    title: 'Loans & EMI: Mastering Debt & Prepayments',
    category: 'Loans and EMI',
    estimatedMinutes: 5,
    summary: 'How monthly loan installments work and why making small prepayments saves lakhs in interest.',
    explanation: [
      'An Equated Monthly Installment (EMI) has two distinct parts: Principal repayment (paying down the original borrowed sum) and Interest charges (the fee the bank charges for lending you money).',
      'In long-term loans (like home loans), banks front-load the interest. During the first 5 years of a 20-year loan, up to 70–80% of every single EMI payment goes directly toward bank interest, barely reducing your actual debt!',
      'The good news: Any extra prepayment you make goes 100% directly toward reducing your principal, which immediately lowers your future interest calculations.'
    ],
    example: {
      title: 'Realistic Example: ₹30 Lakh Home Loan at 9% for 20 Years',
      description: 'The real numbers behind long-term bank borrowing:',
      items: [
        { label: 'Monthly EMI', amount: '₹26,992', note: 'Fixed monthly obligation' },
        { label: 'Total Repayment', amount: '₹64,78,034', note: 'Principal: ₹30L + Interest: ₹34.8L' },
        { label: 'Prepayment Hack', amount: 'Saves ~₹7,20,000', note: 'Paying just 1 extra EMI per year cuts tenure from 20 to 16 years!' }
      ],
      result: 'On long loans, you frequently pay more in interest than the loan itself unless you make disciplined prepayments.'
    },
    activity: {
      type: 'emi',
      title: 'Interactive EMI & Interest Calculator',
      description: 'Calculate the monthly EMI, total interest, and full repayment cost of any loan:'
    },
    takeaway: 'Avoid high-interest consumer debt. On long-term mortgages, prepaying small amounts early slashes years of debt and lakhs in interest.'
  },
  {
    id: 'credit-scores',
    title: 'Credit Scores: Building and Protecting Your CIBIL',
    category: 'Credit Scores',
    estimatedMinutes: 4,
    summary: 'How your 3-digit score influences loan approvals and interest rates, and the 2 habits to maintain a 750+ score.',
    explanation: [
      'In India, credit bureaus (such as CIBIL, Experian, and CRIF) assign individuals a score between 300 and 900 based on their debt track record:',
      '• 750 to 900 (Excellent): Prime borrower. You qualify for the lowest interest rates and instant credit card and loan approvals.',
      '• 650 to 749 (Average): Fair credit. Loans are approved, but at higher interest rates with stricter scrutiny.',
      '• Below 650 (High Risk): Poor credit. Very difficult to obtain loans or credit cards.',
      'Your score is driven primarily by on-time payment history (35%) and your credit utilization ratio (30%).'
    ],
    example: {
      title: 'Realistic Example: Loan Cost for High vs Average CIBIL Score',
      description: 'Two individuals applying for a ₹40,00,000 home loan for 20 years:',
      items: [
        { label: 'Priya (Score 790)', amount: '8.4% Rate • EMI: ₹34,460', note: 'Total interest paid: ₹42.7 Lakhs' },
        { label: 'Rahul (Score 660)', amount: '9.6% Rate • EMI: ₹37,542', note: 'Total interest paid: ₹50.1 Lakhs' }
      ],
      result: 'Priya saves ₹3,082 every single month, pocketing over ₹7,40,000 in savings simply by keeping a healthy credit score.'
    },
    activity: {
      type: 'credit',
      title: 'Interactive Credit Utilization Checker',
      description: 'Check whether your monthly credit card usage is safely inside the healthy 30% boundary:'
    },
    takeaway: 'Always pay 100% of your credit card bill before the due date, and keep your credit card spend below 30% of your credit limit.'
  },
  {
    id: 'insurance',
    title: 'Insurance: Protecting What Matters Most',
    category: 'Insurance',
    estimatedMinutes: 4,
    summary: 'Why pure term life insurance and comprehensive health insurance must come before any investment.',
    explanation: [
      'Insurance is not an investment tool; it is a financial seatbelt. Its purpose is to absorb catastrophic financial shock so your family never falls into debt or liquidates savings due to illness or loss of life.',
      'Every earner needs two essential policies:',
      '1. Pure Term Life Insurance: Provides a large sum (10–15x your annual salary) to your dependents in case of untimely death. It has no investment gimmicks and is very affordable.',
      '2. Comprehensive Health Insurance: Covers hospitalization, day-care procedures, and critical treatments, shielding your hard-earned savings from medical inflation.'
    ],
    example: {
      title: 'Realistic Example: Pure Term Cover vs Endowment Plan',
      description: 'A 28-year-old non-smoker earning ₹7,00,000 per year:',
      items: [
        { label: 'Pure Term Insurance', amount: '₹1 Crore Cover', note: 'Costs only ~₹800 to ₹1,000 per month' },
        { label: 'Endowment / ULIP Plan', amount: '₹2 Lakhs Cover', note: 'Costs the same ₹1,000/month with mediocre 4-5% return' }
      ],
      result: 'By taking pure term cover, you secure 50x higher coverage for your family while keeping your remaining savings free to grow in equity mutual funds.'
    },
    activity: {
      type: 'insurance',
      title: 'Term Life Insurance Cover Estimator',
      description: 'Calculate the recommended life cover based on your annual income and liabilities:'
    },
    takeaway: 'Never mix insurance with investments. Buy a pure Term Life plan and a comprehensive Health cover, and invest your wealth separately.'
  },
  {
    id: 'taxes',
    title: 'Taxes: Direct Taxes & Old vs New Regime',
    category: 'Taxes',
    estimatedMinutes: 5,
    summary: 'How to compare the Old and New tax regimes to keep more of your hard-earned paycheck.',
    explanation: [
      'In India, salaried taxpayers can choose between two tax regimes each financial year:',
      '• New Tax Regime (Default): Offers lower slab rates and eliminates paperwork. In FY 2024–25, standard deduction (₹75,000) and rebate make income up to ₹7.75 Lakhs completely tax-free.',
      '• Old Tax Regime: Features higher tax slab rates, but permits deductions like Section 80C (up to ₹1.5L in EPF/ELSS/PPF), Section 80D (health insurance), House Rent Allowance (HRA), and home loan interest.',
      'The choice comes down to math: If your total eligible deductions exceed ₹2.5–3 Lakhs, the Old Regime may save you money. Otherwise, the New Regime is simpler and cheaper.'
    ],
    example: {
      title: 'Realistic Example: Comparing Regimes on a ₹9,00,000 Salary',
      description: 'Tax comparison for an annual CTC of ₹9 Lakhs:',
      items: [
        { label: 'New Tax Regime', amount: 'Tax: ~₹35,000', note: 'Standard deduction of ₹75,000 with zero paperwork' },
        { label: 'Old Regime (No Deductions)', amount: 'Tax: ~₹96,200', note: 'Higher tax brackets without deductions' },
        { label: 'Old Regime (₹3L Deductions)', amount: 'Tax: ~₹30,000', note: 'Slightly lower tax, but requires ₹3L locked in HRA/80C' }
      ],
      result: 'For most young earners, the New Regime provides lower tax with total freedom over how you spend or invest your money.'
    },
    activity: {
      type: 'tax',
      title: 'Old vs New Tax Regime Estimator',
      description: 'Compare your estimated tax liability between the two regimes:'
    },
    takeaway: 'If your total eligible deductions are below ₹2.5–3 Lakhs, the New Tax Regime is cleaner, hassle-free, and usually saves more tax.'
  },
  {
    id: 'stocks-mutual-funds',
    title: 'Stocks & Mutual Funds: Growing Real Wealth',
    category: 'Stocks and Mutual Funds',
    estimatedMinutes: 5,
    summary: 'How equity ownership and broad index funds outpace inflation without the stress of daily stock picking.',
    explanation: [
      'To build long-term wealth, your investments must grow faster than inflation. Equities (stocks) represent fractional ownership in real, revenue-producing companies.',
      'There are three primary ways people invest in equities:',
      '• Individual Stocks: Buying shares of one company. High potential gains, but high risk if that single company fails.',
      '• Actively Managed Mutual Funds: A fund manager pools money from investors to pick 40–60 companies, charging a 1–2% yearly expense fee.',
      '• Broad Index Funds (Nifty 50): Automatically invests in India’s top 50 blue-chip companies at ultra-low fees (~0.1%). It removes manager risk and captures the growth of the overall Indian economy.'
    ],
    example: {
      title: 'Realistic Example: ₹5,000 Monthly SIP in Nifty 50 Index',
      description: 'Long-term compounding at historical average 12.5% CAGR:',
      items: [
        { label: 'After 5 Years', amount: '₹4.12 Lakhs', note: 'Total Invested: ₹3.0 Lakhs' },
        { label: 'After 10 Years', amount: '₹11.61 Lakhs', note: 'Total Invested: ₹6.0 Lakhs' },
        { label: 'After 15 Years', amount: '₹25.23 Lakhs', note: 'Total Invested: ₹9.0 Lakhs • Capital Gain: ₹16.2 Lakhs!' }
      ],
      result: 'A disciplined monthly SIP turns a modest ₹5,000/month into a major corpus without needing to watch market charts.'
    },
    activity: {
      type: 'sip',
      title: 'Interactive SIP Wealth Calculator',
      description: 'See the power of systematic investing across different monthly amounts and durations:'
    },
    takeaway: 'Avoid speculative day-trading and hot tips. Start a regular monthly SIP in a low-cost broad index fund and let compounding work for you.'
  }
];

export const SUGGESTED_AI_QUESTIONS = [
  'How does the 50/30/20 budget rule work with a realistic example?',
  'Explain compound interest and the Rule of 72 in simple terms.',
  'Why does inflation hurt my savings if money is sitting in a bank account?',
  'How does prepaying an extra EMI on a home loan save so much interest?',
  'What is a credit utilization ratio and how do I keep my CIBIL score above 750?',
  'Why is pure term insurance better than an endowment policy?',
  'What is the difference between the Old and New tax regimes in India?',
  'What is the difference between a direct index fund and an active mutual fund?'
];
