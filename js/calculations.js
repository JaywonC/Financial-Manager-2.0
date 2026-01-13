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
  const inMonth = transactions.filter(t => getYearMonth(t.date) === yearMonth && t.type === "expense");
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
