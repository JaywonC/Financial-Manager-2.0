function initDashboard(profile) {
  loadState();

  const { transactions } = getState();
  const ym = currentYearMonth();

  // Month label
  const monthLabel = document.getElementById("monthLabel");
  if (monthLabel) monthLabel.textContent = ym;

  // ✅ Starting balances from profile (NOW includes cash too)
  const startingTotal = profile
    ? (Number(profile.balances?.checking) || 0) +
      (Number(profile.balances?.savings) || 0) +
      (Number(profile.balances?.cash) || 0)
    : 0;

  // Existing transaction net
  const netFromTransactions = getBalance(transactions);

  // ✅ True current balance
  document.getElementById("balance").textContent =
    formatMoney(startingTotal + netFromTransactions);

  // Monthly summary (transactions)
  const monthly = getMonthlySummary(transactions, ym);

  // ✅ Add fixed expenses from profile to the month totals
  const fixedTotal = profile ? (Number(profile.monthly?.fixedExpenses) || 0) : 0;

  const totalExpenses = monthly.expense + fixedTotal;
  const net = monthly.income - totalExpenses;

  document.getElementById("incomeMonth").textContent =
    formatMoney(monthly.income);
  document.getElementById("expenseMonth").textContent =
    formatMoney(totalExpenses);
  document.getElementById("netMonth").textContent =
    formatMoney(net);

  // Top categories (still transaction-based)
  const top = getTopCategories(transactions, ym, 5);
  const ul = document.getElementById("topCategories");
  const empty = document.getElementById("emptyTopCategories");

  ul.innerHTML = "";

  if (top.length === 0) {
    empty.classList.remove("hidden");
  } else {
    empty.classList.add("hidden");
    for (const [cat, total] of top) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${cat}</span><strong>${formatMoney(total)}</strong>`;
      ul.appendChild(li);
    }
  }
}
