function initDashboard(profile) {
  loadState();

  const { transactions } = getState();
  const ym = currentYearMonth();

  // Month label
  const monthLabel = document.getElementById("monthLabel");
  if (monthLabel) monthLabel.textContent = ym;

  // ✅ Live balances by account (starting + transactions)
  const acctBalances = getAccountBalances(transactions, profile);
  const totalBalance = getTotalBalanceFromAccounts(acctBalances);

  // ✅ True current balance (now uses account balances)
  const balanceEl = document.getElementById("balance");
  if (balanceEl) balanceEl.textContent = formatMoney(totalBalance);

  // ✅ Update your summary balances (top left)
  const checkingDisplay = document.getElementById("checkingDisplay");
  const savingsDisplay = document.getElementById("savingsDisplay");
  const cashDisplay = document.getElementById("cashDisplay");

  if (checkingDisplay) checkingDisplay.textContent = formatMoney(acctBalances.checking);
  if (savingsDisplay) savingsDisplay.textContent = formatMoney(acctBalances.savings);
  if (cashDisplay) cashDisplay.textContent = formatMoney(acctBalances.cash);

  // =========================
  // ✅ NEW MIDDLE SECTION
  // =========================

  // 1) Balance breakdown text + bar widths
  const breakdownEl = document.getElementById("balanceBreakdown");
  const barChecking = document.getElementById("barChecking");
  const barSavings = document.getElementById("barSavings");
  const barCash = document.getElementById("barCash");

  const totalForBars = Math.max(0, Number(totalBalance) || 0);
  const pct = (x) => (totalForBars > 0 ? (Math.max(0, x) / totalForBars) * 100 : 0);

  const pC = pct(acctBalances.checking);
  const pS = pct(acctBalances.savings);
  const pH = pct(acctBalances.cash);

  if (breakdownEl) {
    breakdownEl.textContent =
      `Checking ${formatMoney(acctBalances.checking)} · ` +
      `Savings ${formatMoney(acctBalances.savings)} · ` +
      `Cash ${formatMoney(acctBalances.cash)}`;
  }

  // Keep bars always visible even if total is 0
  if (barChecking) barChecking.style.width = `${Math.round(pC)}%`;
  if (barSavings) barSavings.style.width = `${Math.round(pS)}%`;
  if (barCash) barCash.style.width = `${Math.round(pH)}%`;

  // If total is 0, split evenly so it doesn't look broken
  if (totalForBars === 0) {
    if (barChecking) barChecking.style.width = `34%`;
    if (barSavings) barSavings.style.width = `33%`;
    if (barCash) barCash.style.width = `33%`;
  }

  // 2) Recent activity (latest 5 transactions)
  const recentList = document.getElementById("recentList");
  const recentEmpty = document.getElementById("recentEmpty");

  if (recentList && recentEmpty) {
    const txs = [...(transactions || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
    const recent = txs.slice(0, 5);

    recentList.innerHTML = "";

    if (recent.length === 0) {
      recentEmpty.style.display = "block";
    } else {
      recentEmpty.style.display = "none";

      const prettyAccount = (a) => {
        const x = String(a || "checking").toLowerCase();
        if (x === "checking") return "Checking";
        if (x === "savings") return "Savings";
        if (x === "cash") return "Cash";
        return "Checking";
      };

      const accountLabelForTx = (t) => {
        if (t.type === "transfer") {
          return `${prettyAccount(t.fromAccount)} → ${prettyAccount(t.toAccount)}`;
        }
        return prettyAccount(t.account);
      };

      for (const t of recent) {
        const li = document.createElement("li");

        const left =
          t.type === "transfer"
            ? `Transfer · ${accountLabelForTx(t)}`
            : `${t.category || "Other"} · ${accountLabelForTx(t)}`;

        li.innerHTML = `
          <span>${t.date} · ${left}</span>
          <strong>${t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}${formatMoney(t.amount)}</strong>
        `;
        recentList.appendChild(li);
      }
    }
  }

  // 3) Quick insights
  const insightsList = document.getElementById("insightsList");
  const insightsEmpty = document.getElementById("insightsEmpty");

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

  if (insightsList && insightsEmpty) {
    insightsList.innerHTML = "";

    const insights = [];

    // net status
    if (monthly.income === 0 && totalExpenses > 0) {
      insights.push(["No income logged this month", "Add an income transaction to see accurate net."]);
    } else if (net < 0) {
      insights.push(["You’re net negative this month", `Net: ${formatMoney(net)}.`]);
    } else {
      insights.push(["You’re net positive this month", `Net: ${formatMoney(net)}.`]);
    }

    // fixed expenses share
    if (totalExpenses > 0 && fixedTotal > 0) {
      const share = Math.round((fixedTotal / totalExpenses) * 100);
      insights.push(["Fixed expenses share", `${share}% of this month’s expenses are fixed.`]);
    }

    // cash cushion / runway (very simple)
    if (totalExpenses > 0) {
      const runway = totalBalance / totalExpenses; // months
      if (Number.isFinite(runway)) {
        insights.push(["Runway (rough)", `${runway.toFixed(1)} months at this month’s spending.`]);
      }
    }

    // show
    if (insights.length === 0) {
      insightsEmpty.style.display = "block";
    } else {
      insightsEmpty.style.display = "none";
      for (const [title, sub] of insights.slice(0, 4)) {
        const li = document.createElement("li");
        li.innerHTML = `<span>${title}</span><strong>${sub}</strong>`;
        insightsList.appendChild(li);
      }
    }
  }

  // =========================
  // Existing: Top categories
  // =========================
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
