function initDashboard(profile) {
  loadState();

  const { transactions } = getState();
  const ym = currentYearMonth();

  // Month label
  const monthLabel = document.getElementById("monthLabel");
  if (monthLabel) monthLabel.textContent = ym;

  // ✅ NEW: Live balances by account (starting + transactions)
  const acctBalances = getAccountBalances(transactions, profile);
  const totalBalance = getTotalBalanceFromAccounts(acctBalances);

  // ✅ True current balance (now uses account balances)
  const balanceEl = document.getElementById("balance");
  if (balanceEl) {
    balanceEl.textContent = formatMoney(totalBalance);
  }

  // ✅ OPTIONAL BUT NICE: update your summary balances if those elements exist
  const checkingDisplay = document.getElementById("checkingDisplay");
  const savingsDisplay = document.getElementById("savingsDisplay");
  const cashDisplay = document.getElementById("cashDisplay");

  if (checkingDisplay) checkingDisplay.textContent = formatMoney(acctBalances.checking);
  if (savingsDisplay) savingsDisplay.textContent = formatMoney(acctBalances.savings);
  if (cashDisplay) cashDisplay.textContent = formatMoney(acctBalances.cash);

  // Monthly summary (transactions)
  const monthly = getMonthlySummary(transactions, ym);

  // Fixed expenses total from profile
  const fixedTotal = profile ? (Number(profile.monthly?.fixedExpenses) || 0) : 0;

  // Add fixed into displayed month totals
  const totalExpenses = monthly.expense + fixedTotal;
  const net = monthly.income - totalExpenses;

  const incomeEl = document.getElementById("incomeMonth");
  const expenseEl = document.getElementById("expenseMonth");
  const netEl = document.getElementById("netMonth");

  if (incomeEl) incomeEl.textContent = formatMoney(monthly.income);
  if (expenseEl) expenseEl.textContent = formatMoney(totalExpenses);
  if (netEl) netEl.textContent = formatMoney(net);

  // ✅ Top categories: include fixed expenses as one category
  const ul = document.getElementById("topCategories");
  const empty = document.getElementById("emptyTopCategories");
  if (!ul || !empty) return;

  // Start with transaction-based category totals for the month (expenses only)
  const totalsObj = getCategoryTotals(transactions, ym);

  // Add fixed expenses as its own bucket
  if (fixedTotal > 0) {
    totalsObj["Fixed"] = (totalsObj["Fixed"] || 0) + fixedTotal;
  }

  // Convert object to sorted list
  const top = Object.entries(totalsObj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

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
