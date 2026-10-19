/**
 * Single source of truth calculation engine for Trip Splitter.
 * All internal arithmetic uses integer-paise (1 Rupee = 100 Paise)
 * to eliminate floating point rounding inaccuracies.
 */

const toPaise = (num) => Math.round((Number(num) || 0) * 100);
const fromPaise = (paise) => Math.round(paise) / 100;

function calculateTrip(participants = [], expenses = [], recordedSettlements = []) {
    // 1. Initialize participant map and indexing
    const participantMap = {};
    const participantIds = participants.map(p => p.id);
    const participantNames = participants.map(p => p.name);
    const pIdToIndex = {};

    participants.forEach((p, idx) => {
        pIdToIndex[p.id] = idx;
        participantMap[p.id] = {
            id: p.id,
            name: p.name,
            totalPaidPaise: 0,
            fairSharePaise: 0,
            settlementsPaidPaise: 0,
            settlementsReceivedPaise: 0
        };
    });

    const n = participants.length;

    // 2. Pairwise gross debt matrix (in paise):
    // pairwiseGrossPaise[i][j] = gross amount participant i owes participant j from expenses
    const pairwiseGrossPaise = Array.from({ length: n }, () => Array(n).fill(0));

    // 3. Process each expense
    let totalTripExpensePaise = 0;
    expenses.forEach(exp => {
        const amountPaise = toPaise(exp.amount);
        if (amountPaise <= 0) return;
        totalTripExpensePaise += amountPaise;

        const payerId = exp.paidBy;
        const payerIdx = pIdToIndex[payerId];

        // Participant subset included in this expense
        const rawShared = Array.isArray(exp.sharedWith) && exp.sharedWith.length > 0 
            ? exp.sharedWith 
            : [payerId];
        // Filter to only include valid participants in this trip
        const sharedWith = rawShared.filter(id => pIdToIndex[id] !== undefined);
        const count = sharedWith.length;
        if (count === 0) return;

        // Credit payer for the upfront amount paid
        if (participantMap[payerId]) {
            participantMap[payerId].totalPaidPaise += amountPaise;
        }

        if ((exp.splitType === 'custom' || exp.splitType === 'itemized') && Array.isArray(exp.participantShares) && exp.participantShares.length > 0) {
            // Custom amount or itemized split with unequal, specific participant shares
            exp.participantShares.forEach(share => {
                const pId = share.participantId;
                const sharePaise = toPaise(share.amount);
                if (sharePaise <= 0) return;

                // Debit participant's fair share
                if (participantMap[pId]) {
                    participantMap[pId].fairSharePaise += sharePaise;
                }

                // If participant is NOT the payer, participant owes the payer!
                const debtorIdx = pIdToIndex[pId];
                if (debtorIdx !== undefined && payerIdx !== undefined && debtorIdx !== payerIdx) {
                    pairwiseGrossPaise[debtorIdx][payerIdx] += sharePaise;
                }
            });
        } else {
            // Base share and remainder paise distribution for equal split
            const baseSharePaise = Math.floor(amountPaise / count);
            const remainderPaise = amountPaise % count;

            sharedWith.forEach((pId, idx) => {
                const extra = idx < remainderPaise ? 1 : 0;
                const indSharePaise = baseSharePaise + extra;

                // Debit participant's fair share
                if (participantMap[pId]) {
                    participantMap[pId].fairSharePaise += indSharePaise;
                }

                // If participant is NOT the payer, participant owes the payer!
                // (Payer's own share is their personal cost, not owed to themselves)
                const debtorIdx = pIdToIndex[pId];
                if (debtorIdx !== undefined && payerIdx !== undefined && debtorIdx !== payerIdx) {
                    pairwiseGrossPaise[debtorIdx][payerIdx] += indSharePaise;
                }
            });
        }
    });

    // 4. Process recorded settlement payments (money transfers between pairs)
    // directPaymentsPaise[i][j] = money participant i has paid directly to participant j in settlements
    const directPaymentsPaise = Array.from({ length: n }, () => Array(n).fill(0));

    recordedSettlements.forEach(s => {
        const sPaise = toPaise(s.amount);
        if (sPaise <= 0) return;

        const fromIdx = pIdToIndex[s.fromParticipantId];
        const toIdx = pIdToIndex[s.toParticipantId];

        if (participantMap[s.fromParticipantId]) {
            participantMap[s.fromParticipantId].settlementsPaidPaise += sPaise;
        }
        if (participantMap[s.toParticipantId]) {
            participantMap[s.toParticipantId].settlementsReceivedPaise += sPaise;
        }

        if (fromIdx !== undefined && toIdx !== undefined && fromIdx !== toIdx) {
            directPaymentsPaise[fromIdx][toIdx] += sPaise;
        }
    });

    // 5. Construct RUNNING PAIRWISE DEBT MATRIX (Section 4 & 5)
    // For each pair (i, j):
    // Net expense obligation:
    // i owed j: pairwiseGrossPaise[i][j]
    // j owed i: pairwiseGrossPaise[j][i]
    // Payments:
    // i paid j: directPaymentsPaise[i][j]
    // j paid i: directPaymentsPaise[j][i]
    // Net debt from i to j = (pairwiseGrossPaise[i][j] - pairwiseGrossPaise[j][i]) - (directPaymentsPaise[i][j] - directPaymentsPaise[j][i])
    // If net debt > 0: i owes j.
    // If net debt < 0: j owes i.
    // If net debt == 0: neither owes each other.
    // Never display simultaneous opposing debts between the same pair!

    const runningMatrixPaise = Array.from({ length: n }, () => Array(n).fill(0));
    const pairwiseDebts = []; // List of all active direct pairwise debts

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const netDebt_i_to_j = (pairwiseGrossPaise[i][j] - pairwiseGrossPaise[j][i])
                                 - (directPaymentsPaise[i][j] - directPaymentsPaise[j][i]);

            if (netDebt_i_to_j > 0) {
                runningMatrixPaise[i][j] = netDebt_i_to_j;
                runningMatrixPaise[j][i] = 0;
                pairwiseDebts.push({
                    fromId: participants[i].id,
                    fromName: participants[i].name,
                    toId: participants[j].id,
                    toName: participants[j].name,
                    amount: fromPaise(netDebt_i_to_j),
                    amountPaise: netDebt_i_to_j
                });
            } else if (netDebt_i_to_j < 0) {
                const debt_j_to_i = Math.abs(netDebt_i_to_j);
                runningMatrixPaise[j][i] = debt_j_to_i;
                runningMatrixPaise[i][j] = 0;
                pairwiseDebts.push({
                    fromId: participants[j].id,
                    fromName: participants[j].name,
                    toId: participants[i].id,
                    toName: participants[i].name,
                    amount: fromPaise(debt_j_to_i),
                    amountPaise: debt_j_to_i
                });
            } else {
                runningMatrixPaise[i][j] = 0;
                runningMatrixPaise[j][i] = 0;
            }
        }
    }

    const runningMatrix = runningMatrixPaise.map(row => row.map(val => fromPaise(val)));
    const rowTotals = runningMatrixPaise.map(row => fromPaise(row.reduce((sum, val) => sum + val, 0)));
    const colTotals = Array.from({ length: n }, (_, cIdx) => 
        fromPaise(runningMatrixPaise.reduce((sum, row) => sum + row[cIdx], 0))
    );

    // 6. Calculate Participant Summaries and Net Balances
    const participantSummary = [];
    const debtors = [];
    const creditors = [];

    participants.forEach((p, idx) => {
        const data = participantMap[p.id];
        const totalPaid = fromPaise(data.totalPaidPaise);
        const fairShare = fromPaise(data.fairSharePaise);
        const settlementsPaid = fromPaise(data.settlementsPaidPaise);
        const settlementsReceived = fromPaise(data.settlementsReceivedPaise);

        // Net balance:
        // (totalPaid - fairShare) + settlementsPaid - settlementsReceived
        // Matches colTotals[idx] - rowTotals[idx]
        const initialNetBalancePaise = data.totalPaidPaise - data.fairSharePaise;
        const netBalancePaise = initialNetBalancePaise + data.settlementsPaidPaise - data.settlementsReceivedPaise;
        const netBalance = fromPaise(netBalancePaise);

        participantSummary.push({
            id: p.id,
            name: p.name,
            totalPaid,
            fairShare,
            settlementsPaid,
            settlementsReceived,
            initialNetBalance: fromPaise(initialNetBalancePaise),
            netBalance,
            totalOwed: rowTotals[idx],
            totalToReceive: colTotals[idx]
        });

        if (netBalancePaise < 0) {
            debtors.push({ id: p.id, name: p.name, debtPaise: Math.abs(netBalancePaise) });
        } else if (netBalancePaise > 0) {
            creditors.push({ id: p.id, name: p.name, creditPaise: netBalancePaise });
        }
    });

    // 7. OPTIMIZED SETTLEMENT MODE (Section 6)
    // Kept strictly separate from the running pairwise matrix.
    // Minimizes transactions by matching largest debtor with largest creditor.
    const optimizedSettlements = [];
    const dList = debtors.map(d => ({ ...d }));
    const cList = creditors.map(c => ({ ...c }));

    // Direct matches first
    dList.forEach(d => {
        if (d.debtPaise === 0) return;
        const match = cList.find(c => c.creditPaise === d.debtPaise);
        if (match) {
            optimizedSettlements.push({
                fromId: d.id,
                fromName: d.name,
                toId: match.id,
                toName: match.name,
                amount: fromPaise(d.debtPaise)
            });
            match.creditPaise = 0;
            d.debtPaise = 0;
        }
    });

    // Greedy matching
    while (true) {
        dList.sort((a, b) => b.debtPaise - a.debtPaise);
        cList.sort((a, b) => b.creditPaise - a.creditPaise);

        const activeD = dList.find(d => d.debtPaise > 0);
        const activeC = cList.find(c => c.creditPaise > 0);
        if (!activeD || !activeC) break;

        const transferPaise = Math.min(activeD.debtPaise, activeC.creditPaise);
        optimizedSettlements.push({
            fromId: activeD.id,
            fromName: activeD.name,
            toId: activeC.id,
            toName: activeC.name,
            amount: fromPaise(transferPaise)
        });

        activeD.debtPaise -= transferPaise;
        activeC.creditPaise -= transferPaise;
    }

    const totalOutstandingDebt = fromPaise(debtors.reduce((sum, d) => sum + d.debtPaise, 0));
    const totalOutstandingCredit = fromPaise(creditors.reduce((sum, c) => sum + c.creditPaise, 0));

    return {
        totalTripExpense: fromPaise(totalTripExpensePaise),
        totalOutstandingDebt,
        totalOutstandingCredit,
        isAllSettled: totalOutstandingDebt === 0,
        participantSummary,
        runningMatrix: {
            matrix: runningMatrix,
            rowTotals,
            colTotals,
            participantIds,
            participantNames
        },
        pairwiseDebts,
        optimizedSettlements
    };
}

// Validation helper for recording settlements
function validateSettlement(tripCalculation, fromParticipantId, toParticipantId, amount) {
    const amountPaise = toPaise(amount);
    if (!amountPaise || amountPaise <= 0) {
        return { valid: false, error: 'Settlement amount must be a positive number.' };
    }

    const debt = tripCalculation.pairwiseDebts.find(
        d => d.fromId === fromParticipantId && d.toId === toParticipantId
    );

    if (!debt || debt.amountPaise <= 0) {
        return { 
            valid: false, 
            error: `No outstanding direct debt found from ${fromParticipantId} to ${toParticipantId}.` 
        };
    }

    if (amountPaise > debt.amountPaise) {
        return {
            valid: false,
            error: `Settlement amount (₹${fromPaise(amountPaise)}) exceeds the remaining debt (₹${debt.amount}) between these participants.`
        };
    }

    return { valid: true, remainingAfterPaise: debt.amountPaise - amountPaise };
}

/**
 * Calculates itemized bill allocations, taxes, discounts, and participant breakdown.
 * All arithmetic uses integer paise for precision.
 * 
 * @param {Object} bill - The itemized bill object (items, tax, serviceCharge, discount, extraCharges, paidBy)
 * @param {Array} participants - List of trip participants [{ id, name }]
 * @returns {Object} Calculated preview including grandTotal, item breakdown, participantBreakdown, and reconciliation
 */
function calculateItemizedBill(bill = {}, participants = []) {
    const participantMap = {};
    const validParticipantIds = new Set();
    participants.forEach(p => {
        validParticipantIds.add(p.id);
        participantMap[p.id] = {
            id: p.id,
            name: p.name,
            subtotalPaise: 0,
            addOnsPaise: 0,
            totalPaise: 0,
            itemsCount: 0,
            items: []
        };
    });

    const items = Array.isArray(bill.items) ? bill.items : [];
    let itemsSubtotalPaise = 0;
    const itemDetails = [];
    const unassignedItems = [];

    items.forEach((item, idx) => {
        const qty = Math.max(1, parseInt(item.quantity) || 1);
        const unitPricePaise = toPaise(item.unitPrice);
        const itemTotalPaise = qty * unitPricePaise;
        itemsSubtotalPaise += itemTotalPaise;

        const rawAssigned = Array.isArray(item.assignedTo) ? item.assignedTo : [];
        const assigned = rawAssigned.filter(id => validParticipantIds.has(id));

        if (assigned.length === 0) {
            unassignedItems.push({
                id: item.id || `item_${idx}`,
                name: item.name,
                quantity: qty,
                unitPrice: fromPaise(unitPricePaise),
                itemTotal: fromPaise(itemTotalPaise),
                itemTotalPaise
            });
            itemDetails.push({
                id: item.id || `item_${idx}`,
                name: item.name,
                quantity: qty,
                unitPrice: fromPaise(unitPricePaise),
                itemTotal: fromPaise(itemTotalPaise),
                itemTotalPaise,
                assignedTo: [],
                assignedCount: 0,
                perPersonShare: 0,
                isAssigned: false
            });
            return;
        }

        const baseSharePaise = Math.floor(itemTotalPaise / assigned.length);
        const remainderPaise = itemTotalPaise % assigned.length;

        assigned.forEach((pId, aIdx) => {
            const extra = aIdx < remainderPaise ? 1 : 0;
            const personSharePaise = baseSharePaise + extra;

            if (participantMap[pId]) {
                participantMap[pId].subtotalPaise += personSharePaise;
                participantMap[pId].itemsCount += 1;
                participantMap[pId].items.push({
                    name: item.name,
                    quantity: qty,
                    itemTotalPaise,
                    portionShare: fromPaise(personSharePaise)
                });
            }
        });

        itemDetails.push({
            id: item.id || `item_${idx}`,
            name: item.name,
            quantity: qty,
            unitPrice: fromPaise(unitPricePaise),
            itemTotal: fromPaise(itemTotalPaise),
            itemTotalPaise,
            assignedTo: assigned,
            assignedCount: assigned.length,
            perPersonShare: fromPaise(Math.round(itemTotalPaise / assigned.length)),
            isAssigned: true
        });
    });

    const taxPaise = toPaise(bill.tax);
    const serviceChargePaise = toPaise(bill.serviceCharge);
    const extraChargesPaise = toPaise(bill.extraCharges);
    const discountPaise = toPaise(bill.discount);

    const netAddOnsPaise = taxPaise + serviceChargePaise + extraChargesPaise - discountPaise;
    const grandTotalPaise = Math.max(0, itemsSubtotalPaise + netAddOnsPaise);

    // Allocate add-ons (taxes/charges/discounts) proportionally to each participant's subtotal
    const assignedSubtotalPaise = Object.values(participantMap).reduce((sum, p) => sum + p.subtotalPaise, 0);

    if (assignedSubtotalPaise > 0 && netAddOnsPaise !== 0) {
        let allocatedAddOnsSumPaise = 0;
        const activeParticipants = Object.values(participantMap).filter(p => p.subtotalPaise > 0);

        // Distribute proportional base
        activeParticipants.forEach(p => {
            const rawProportionPaise = Math.floor((p.subtotalPaise * netAddOnsPaise) / assignedSubtotalPaise);
            p.addOnsPaise = rawProportionPaise;
            allocatedAddOnsSumPaise += rawProportionPaise;
        });

        // Distribute remainder paise
        let remAddOnsPaise = netAddOnsPaise - allocatedAddOnsSumPaise;
        let rIdx = 0;
        while (remAddOnsPaise !== 0 && activeParticipants.length > 0) {
            const step = remAddOnsPaise > 0 ? 1 : -1;
            activeParticipants[rIdx % activeParticipants.length].addOnsPaise += step;
            remAddOnsPaise -= step;
            rIdx++;
        }
    }

    // Compute final total per participant
    let totalAllocatedPaise = 0;
    const participantBreakdown = participants.map(p => {
        const data = participantMap[p.id] || { subtotalPaise: 0, addOnsPaise: 0, items: [], itemsCount: 0 };
        const totalPaise = Math.max(0, data.subtotalPaise + data.addOnsPaise);
        totalAllocatedPaise += totalPaise;

        return {
            participantId: p.id,
            name: p.name,
            subtotal: fromPaise(data.subtotalPaise),
            subtotalPaise: data.subtotalPaise,
            addOns: fromPaise(data.addOnsPaise),
            addOnsPaise: data.addOnsPaise,
            total: fromPaise(totalPaise),
            totalPaise,
            itemsCount: data.itemsCount,
            items: data.items
        };
    });

    const isFullyAssigned = unassignedItems.length === 0 && items.length > 0;
    const reconciled = isFullyAssigned ? (totalAllocatedPaise === grandTotalPaise) : false;

    return {
        items: itemDetails,
        unassignedItems,
        itemsSubtotal: fromPaise(itemsSubtotalPaise),
        itemsSubtotalPaise,
        tax: fromPaise(taxPaise),
        serviceCharge: fromPaise(serviceChargePaise),
        extraCharges: fromPaise(extraChargesPaise),
        discount: fromPaise(discountPaise),
        netAddOns: fromPaise(netAddOnsPaise),
        netAddOnsPaise,
        grandTotal: fromPaise(grandTotalPaise),
        grandTotalPaise,
        totalAllocated: fromPaise(totalAllocatedPaise),
        totalAllocatedPaise,
        isFullyAssigned,
        reconciled,
        participantBreakdown
    };
}

module.exports = {
    toPaise,
    fromPaise,
    calculateTrip,
    calculateItemizedBill,
    validateSettlement
};
