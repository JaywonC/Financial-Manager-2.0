function sumTransactions(transactions, type) {
  return (transactions || [])
    .filter(t => t.type === type)
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);
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

function getMonthlySummary(transactions, yearMonth) {
  const inMonth = (transactions || []).filter(t => getYearMonth(t.date) === yearMonth);

  // IMPORTANT: transfers are excluded from income/expense totals
  const income = sumTransactions(inMonth, "income");
  const expense = sumTransactions(inMonth, "expense");
  return { income, expense, net: income - expense };
}

function getCategoryTotals(transactions, yearMonth) {
  // expenses only for category totals (transfers excluded)
  const inMonth = (transactions || []).filter(
    t => getYearMonth(t.date) === yearMonth && t.type === "expense"
  );

  const totals = {};
  for (const t of inMonth) {
    const cat = t.category || "Other";
    totals[cat] = (totals[cat] || 0) + Number(t.amount || 0);
  }
  return totals; // { Food: 123, Transport: 40, ... }
}

function getTopCategories(transactions, yearMonth, limit = 5) {
  const totals = getCategoryTotals(transactions, yearMonth);
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit); // [ [category, total], ... ]
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
