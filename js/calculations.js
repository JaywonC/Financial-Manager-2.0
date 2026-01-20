function sumTransactions(transactions, type) {
  return transactions
    .filter(t => t.type === type)
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);
}

function getBalance(transactions) {
  const income = sumTransactions(transactions, "income");
  const expense = sumTransactions(transactions, "expense");
  return income - expense;
}

function getMonthlySummary(transactions, yearMonth) {
  const inMonth = transactions.filter(t => getYearMonth(t.date) === yearMonth);
  const income = sumTransactions(inMonth, "income");
  const expense = sumTransactions(inMonth, "expense");
  return { income, expense, net: income - expense };
}

function getCategoryTotals(transactions, yearMonth) {
  // expenses only for category totals
  const inMonth = transactions.filter(
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
   NEW: Account-based balances
   Uses tx.account = checking|savings|cash
========================= */

function getAccountBalances(transactions, profile) {
  // Start from profile balances (starting snapshot)
  const balances = {
    checking: Number(profile?.balances?.checking) || 0,
    savings: Number(profile?.balances?.savings) || 0,
    cash: Number(profile?.balances?.cash) || 0
  };

  for (const t of transactions || []) {
    // Backwards-compat: if older tx doesn't have an account, assume checking
    const acct = (t.account || "checking").toLowerCase();

    if (!(acct in balances)) continue;

    const amt = Number(t.amount || 0);

    if (t.type === "income") {
      balances[acct] += amt;
    } else if (t.type === "expense") {
      balances[acct] -= amt;
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
