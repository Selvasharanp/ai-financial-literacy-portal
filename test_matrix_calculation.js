const roundMoney = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// Test Scenario from User Prompt:
// Participants: Sharan, Suresh, Kabilan, Vishal
// Expense 1: Sharan pays ₹3,000 for (Sharan, Suresh, Kabilan, Vishal) -> ₹750 each
// Expense 2: Suresh pays ₹1,200 for (Sharan, Suresh, Kabilan, Vishal) -> ₹300 each

const participants = [
  { id: 'p_sharan', name: 'Sharan' },
  { id: 'p_suresh', name: 'Suresh' },
  { id: 'p_kabilan', name: 'Kabilan' },
  { id: 'p_vishal', name: 'Vishal' }
];

const expenses = [
  {
    description: 'Expense 1: Group Dinner',
    amount: 3000,
    paidBy: 'p_sharan',
    sharedWith: ['p_sharan', 'p_suresh', 'p_kabilan', 'p_vishal']
  },
  {
    description: 'Expense 2: Group Transport',
    amount: 1200,
    paidBy: 'p_suresh',
    sharedWith: ['p_sharan', 'p_suresh', 'p_kabilan', 'p_vishal']
  }
];

function calculateTrip(participants, expenses) {
  const participantMap = {};
  participants.forEach(p => {
    participantMap[p.id] = { id: p.id, name: p.name, totalPaid: 0, fairShare: 0, netBalance: 0 };
  });

  expenses.forEach(exp => {
    const amount = exp.amount;
    const count = exp.sharedWith.length;
    const costPerPerson = amount / count;

    if (participantMap[exp.paidBy]) {
      participantMap[exp.paidBy].totalPaid += amount;
    }
    exp.sharedWith.forEach(pId => {
      if (participantMap[pId]) {
        participantMap[pId].fairShare += costPerPerson;
      }
    });
  });

  Object.values(participantMap).forEach(p => {
    p.totalPaid = roundMoney(p.totalPaid);
    p.fairShare = roundMoney(p.fairShare);
    p.netBalance = roundMoney(p.totalPaid - p.fairShare);
  });

  // Debtors & Creditors
  const debtors = [];
  const creditors = [];

  Object.values(participantMap).forEach(p => {
    if (p.netBalance < -0.01) debtors.push({ id: p.id, name: p.name, amount: Math.abs(p.netBalance) });
    else if (p.netBalance > 0.01) creditors.push({ id: p.id, name: p.name, amount: p.netBalance });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settleAmount = Math.min(debtor.amount, creditor.amount);

    if (settleAmount > 0.01) {
      settlements.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: roundMoney(settleAmount)
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount <= 0.01) i++;
    if (creditor.amount <= 0.01) j++;
  }

  // Matrix
  const pIdToIndex = {};
  participants.forEach((p, idx) => pIdToIndex[p.id] = idx);
  const n = participants.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));

  settlements.forEach(s => {
    matrix[pIdToIndex[s.fromId]][pIdToIndex[s.toId]] = s.amount;
  });

  return { participantSummary: Object.values(participantMap), settlements, matrix };
}

const result = calculateTrip(participants, expenses);
console.log("=== PARTICIPANT SUMMARY ===");
console.table(result.participantSummary);

console.log("=== OPTIMAL SETTLEMENT INSTRUCTIONS ===");
console.log(result.settlements);

console.log("=== 2D PAYMENT MATRIX ===");
console.log("Headers:", participants.map(p => p.name));
result.matrix.forEach((row, rIdx) => {
  console.log(`${participants[rIdx].name} pays:`, row);
});
