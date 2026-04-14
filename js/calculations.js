function sumTransactions(transactions, type) {
  return (transactions || [])
    .filter(t => t.type === type)
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getRecurringOccurrencesForMonth(recurringTransactions, yearMonth) {
  if (!yearMonth) return [];

  const [yearStr, monthStr] = String(yearMonth).split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return [];
  }

  const monthStart = `${yearStr}-${monthStr}-01`;
  const monthEnd = `${yearStr}-${monthStr}-${String(daysInMonth(year, monthIndex)).padStart(2, "0")}`;

  return (recurringTransactions || [])
    .filter((tx) => tx?.active !== false)
    .filter((tx) => tx?.schedule?.frequency === "monthly")
    .filter((tx) => String(tx.startDate || "") <= monthEnd)
    .map((tx) => {
      const day = Math.min(
        daysInMonth(year, monthIndex),
        Math.max(1, Number(tx?.schedule?.dayOfMonth) || 1)
      );
      const date = `${yearStr}-${monthStr}-${String(day).padStart(2, "0")}`;
      if (date < monthStart) return null;

      return {
        id: `${tx.id}:${date}`,
        recurringId: tx.id,
        isRecurringOccurrence: true,
        type: tx.type,
        amount: Number(tx.amount || 0),
        date,
        category: tx.category || "Fixed",
        account: tx.account || "checking",
        note: tx.note || "",
        label: tx.label || tx.note || tx.category || "Recurring transaction"
      };
    })
    .filter(Boolean);
}

function getTransactionsForMonth(transactions, recurringTransactions, yearMonth) {
  const baseTransactions = (transactions || []).filter((t) => getYearMonth(t.date) === yearMonth);
  return baseTransactions.concat(getRecurringOccurrencesForMonth(recurringTransactions, yearMonth));
}

/**
 * Net cashflow from income/expense ONLY.
 * Transfers should not change total net.
 */
function getBalance(transactions) {
  const income = sumTransactions(transactions, "income");
  const expense = sumTransactions(transactions, "expense");
  return income - expense;
}

function getMonthlySummary(transactions, yearMonth, recurringTransactions = []) {
  const inMonth = getTransactionsForMonth(transactions, recurringTransactions, yearMonth);

  // IMPORTANT: transfers are excluded from income/expense totals
  const income = sumTransactions(inMonth, "income");
  const expense = sumTransactions(inMonth, "expense");
  return { income, expense, net: income - expense };
}

function getCategoryTotals(transactions, yearMonth, recurringTransactions = []) {
  // expenses only for category totals (transfers excluded)
  const inMonth = getTransactionsForMonth(transactions, recurringTransactions, yearMonth)
    .filter((t) => t.type === "expense");

  const totals = {};
  for (const t of inMonth) {
    const cat = t.category || "Other";
    totals[cat] = (totals[cat] || 0) + Number(t.amount || 0);
  }
  return totals; // { Food: 123, Transport: 40, ... }
}

function getTopCategories(transactions, yearMonth, limit = 5, recurringTransactions = []) {
  const totals = getCategoryTotals(transactions, yearMonth, recurringTransactions);
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit); // [ [category, total], ... ]
}

function getBudgetSummaries(budgets, categoryTotals) {
  return (budgets || [])
    .map((budget) => {
      const category = budget.category || "Other";
      const budgetAmount = Number(budget.amount || 0);
      const actual = Number(categoryTotals?.[category] || 0);
      const remaining = budgetAmount - actual;
      const percentUsed = budgetAmount > 0 ? (actual / budgetAmount) * 100 : (actual > 0 ? 100 : 0);

      return {
        id: budget.id,
        category,
        budget: budgetAmount,
        actual,
        remaining,
        isOverBudget: actual > budgetAmount,
        percentUsed
      };
    })
    .sort((a, b) => {
      if (a.isOverBudget !== b.isOverBudget) return a.isOverBudget ? -1 : 1;
      return b.actual - a.actual;
    });
}

/* =========================
   Account-based balances
   Supports:
   - income/expense with tx.account
   - transfer with tx.fromAccount + tx.toAccount
========================= */

function normalizeAccount(a) {
  const x = String(a || "checking").toLowerCase();
  if (x === "checking" || x === "savings" || x === "cash") return x;
  return "checking";
}

function getAccountBalances(transactions, profile) {
  // Start from profile balances (starting snapshot)
  const balances = {
    checking: Number(profile?.balances?.checking) || 0,
    savings: Number(profile?.balances?.savings) || 0,
    cash: Number(profile?.balances?.cash) || 0
  };

  for (const t of (transactions || [])) {
    const amt = Number(t.amount || 0);
    if (!Number.isFinite(amt) || amt === 0) continue;

    if (t.type === "income" || t.type === "expense") {
      // Backwards-compat: old tx might not have account → assume checking
      const acct = normalizeAccount(t.account);

      if (t.type === "income") balances[acct] += amt;
      if (t.type === "expense") balances[acct] -= amt;
    }

    if (t.type === "transfer") {
      const from = normalizeAccount(t.fromAccount);
      const to = normalizeAccount(t.toAccount);

      // If same account, do nothing (should be blocked by UI anyway)
      if (from === to) continue;

      balances[from] -= amt;
      balances[to] += amt;
    }
  }

  // Round to cents to avoid tiny floating errors
  balances.checking = Math.round(balances.checking * 100) / 100;
  balances.savings  = Math.round(balances.savings  * 100) / 100;
  balances.cash     = Math.round(balances.cash     * 100) / 100;

  return balances;
}

function getTotalBalanceFromAccounts(balances) {
  const b = balances || { checking: 0, savings: 0, cash: 0 };
  return (Number(b.checking) || 0) + (Number(b.savings) || 0) + (Number(b.cash) || 0);
}
