(function initDashboard() {
  loadState();

  const { transactions } = getState();
  const ym = currentYearMonth();

  // Labels
  const monthLabel = document.getElementById("monthLabel");
  if (monthLabel) monthLabel.textContent = ym;

  // Cards
  document.getElementById("balance").textContent = formatMoney(getBalance(transactions));

  const monthly = getMonthlySummary(transactions, ym);
  document.getElementById("incomeMonth").textContent = formatMoney(monthly.income);
  document.getElementById("expenseMonth").textContent = formatMoney(monthly.expense);
  document.getElementById("netMonth").textContent = formatMoney(monthly.net);

  // Top categories list
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
})();
