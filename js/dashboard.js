let dashboardProfile = null;
let budgetControlsReady = false;
let recurringControlsReady = false;

function getRecurringUserTransactions() {
  return (getState().recurringTransactions || [])
    .filter((tx) => tx.source !== "profile-fixed-expense");
}

function saveRecurringUserTransactions(userRecurringTransactions) {
  const fixedExpenses = (getState().recurringTransactions || [])
    .filter((tx) => tx.source === "profile-fixed-expense");
  setRecurringTransactions(fixedExpenses.concat(userRecurringTransactions || []));
}

function getDashboardCategories() {
  const { transactions, budgets } = getState();
  const defaultCategories = ["Food", "Transport", "Shopping", "School", "Entertainment", "Fixed", "Other"];
  const transactionCategories = (transactions || [])
    .filter((tx) => tx.type === "expense")
    .map((tx) => tx.category || "Other");
  const budgetCategories = (budgets || []).map((budget) => budget.category || "Other");
  const recurringCategories = getRecurringUserTransactions().map((tx) => tx.category || "Other");

  return [...new Set(defaultCategories.concat(transactionCategories, budgetCategories, recurringCategories))]
    .sort((a, b) => a.localeCompare(b));
}

function populateBudgetCategoryOptions(selectedCategory = "Other") {
  const categoryEl = document.getElementById("budgetCategory");
  if (!categoryEl) return;

  const categories = getDashboardCategories();
  categoryEl.innerHTML = "";

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryEl.appendChild(option);
  }

  categoryEl.value = categories.includes(selectedCategory) ? selectedCategory : "Other";
}

function populateRecurringCategoryOptions(selectedCategory = "Other") {
  const categoryEl = document.getElementById("recurringCategory");
  if (!categoryEl) return;

  const categories = getDashboardCategories();
  categoryEl.innerHTML = "";

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryEl.appendChild(option);
  }

  categoryEl.value = categories.includes(selectedCategory) ? selectedCategory : "Other";
}

function setBudgetError(message) {
  const errorEl = document.getElementById("budgetError");
  if (!errorEl) return;
  errorEl.textContent = message || "";
  errorEl.style.display = message ? "block" : "none";
}

function setRecurringError(message) {
  const errorEl = document.getElementById("recurringError");
  if (!errorEl) return;
  errorEl.textContent = message || "";
  errorEl.style.display = message ? "block" : "none";
}

function resetBudgetForm() {
  const form = document.getElementById("budgetForm");
  const editIdEl = document.getElementById("budgetEditId");
  const amountEl = document.getElementById("budgetAmount");
  const submitBtn = document.getElementById("budgetSubmitBtn");
  const cancelBtn = document.getElementById("budgetCancelBtn");

  if (form) form.reset();
  if (editIdEl) editIdEl.value = "";
  if (amountEl) amountEl.value = "";
  if (submitBtn) submitBtn.textContent = "Save Budget";
  if (cancelBtn) cancelBtn.style.display = "none";

  populateBudgetCategoryOptions("Other");
  setBudgetError("");
}

function resetRecurringForm() {
  const form = document.getElementById("recurringForm");
  const editIdEl = document.getElementById("recurringEditId");
  const typeEl = document.getElementById("recurringType");
  const amountEl = document.getElementById("recurringAmount");
  const accountEl = document.getElementById("recurringAccount");
  const startDateEl = document.getElementById("recurringStartDate");
  const dayEl = document.getElementById("recurringDayOfMonth");
  const labelEl = document.getElementById("recurringLabel");
  const activeEl = document.getElementById("recurringActive");
  const submitBtn = document.getElementById("recurringSubmitBtn");
  const cancelBtn = document.getElementById("recurringCancelBtn");

  if (form) form.reset();
  if (editIdEl) editIdEl.value = "";
  if (typeEl) typeEl.value = "expense";
  if (amountEl) amountEl.value = "";
  if (accountEl) accountEl.value = "checking";
  if (startDateEl) startDateEl.value = todayISO();
  if (dayEl) dayEl.value = "1";
  if (labelEl) labelEl.value = "";
  if (activeEl) activeEl.checked = true;
  if (submitBtn) submitBtn.textContent = "Save Recurring";
  if (cancelBtn) cancelBtn.style.display = "none";

  populateRecurringCategoryOptions("Other");
  setRecurringError("");
}

function buildBudgetFromForm(existingId) {
  const categoryEl = document.getElementById("budgetCategory");
  const amountEl = document.getElementById("budgetAmount");

  const category = String(categoryEl?.value || "").trim();
  const amount = Math.round((Number(amountEl?.value) || 0) * 100) / 100;

  if (!category) {
    setBudgetError("Please choose a category.");
    return null;
  }

  if (!Number.isFinite(amount) || amount < 0) {
    setBudgetError("Please enter a valid budget amount.");
    return null;
  }

  const { budgets } = getState();
  const duplicate = (budgets || []).find((budget) => budget.category === category && budget.id !== existingId);
  if (duplicate) {
    setBudgetError("That category already has a monthly budget. Edit it instead.");
    return null;
  }

  return { id: existingId || makeId(), category, amount };
}

function buildRecurringFromForm(existingId) {
  const typeEl = document.getElementById("recurringType");
  const amountEl = document.getElementById("recurringAmount");
  const categoryEl = document.getElementById("recurringCategory");
  const accountEl = document.getElementById("recurringAccount");
  const startDateEl = document.getElementById("recurringStartDate");
  const dayEl = document.getElementById("recurringDayOfMonth");
  const labelEl = document.getElementById("recurringLabel");
  const activeEl = document.getElementById("recurringActive");

  const type = typeEl?.value === "income" ? "income" : "expense";
  const amount = Math.round((Number(amountEl?.value) || 0) * 100) / 100;
  const category = String(categoryEl?.value || "Other").trim() || "Other";
  const account = String(accountEl?.value || "checking").trim() || "checking";
  const startDate = startDateEl?.value || "";
  const dayOfMonth = Number(dayEl?.value);
  const label = String(labelEl?.value || "").trim();
  const active = Boolean(activeEl?.checked);

  if (!Number.isFinite(amount) || amount <= 0) {
    setRecurringError("Please enter a valid recurring amount greater than 0.");
    return null;
  }

  if (!startDate) {
    setRecurringError("Please choose a start date.");
    return null;
  }

  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    setRecurringError("Monthly day must be between 1 and 31.");
    return null;
  }

  if (!label) {
    setRecurringError("Please add a label or note so this recurring item is easy to recognize.");
    return null;
  }

  return {
    id: existingId || makeId(),
    type,
    amount,
    category,
    account,
    note: label,
    label,
    active,
    startDate,
    schedule: {
      frequency: "monthly",
      dayOfMonth
    },
    source: "user"
  };
}

function startEditBudget(id) {
  const budget = (getState().budgets || []).find((item) => item.id === id);
  if (!budget) return;

  const editIdEl = document.getElementById("budgetEditId");
  const amountEl = document.getElementById("budgetAmount");
  const submitBtn = document.getElementById("budgetSubmitBtn");
  const cancelBtn = document.getElementById("budgetCancelBtn");

  if (editIdEl) editIdEl.value = budget.id;
  if (amountEl) amountEl.value = budget.amount;
  if (submitBtn) submitBtn.textContent = "Save Changes";
  if (cancelBtn) cancelBtn.style.display = "inline-flex";

  populateBudgetCategoryOptions(budget.category);
  setBudgetError("");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startEditRecurring(id) {
  const recurring = getRecurringUserTransactions().find((item) => item.id === id);
  if (!recurring) return;

  const editIdEl = document.getElementById("recurringEditId");
  const typeEl = document.getElementById("recurringType");
  const amountEl = document.getElementById("recurringAmount");
  const accountEl = document.getElementById("recurringAccount");
  const startDateEl = document.getElementById("recurringStartDate");
  const dayEl = document.getElementById("recurringDayOfMonth");
  const labelEl = document.getElementById("recurringLabel");
  const activeEl = document.getElementById("recurringActive");
  const submitBtn = document.getElementById("recurringSubmitBtn");
  const cancelBtn = document.getElementById("recurringCancelBtn");

  if (editIdEl) editIdEl.value = recurring.id;
  if (typeEl) typeEl.value = recurring.type || "expense";
  if (amountEl) amountEl.value = recurring.amount;
  if (accountEl) accountEl.value = recurring.account || "checking";
  if (startDateEl) startDateEl.value = recurring.startDate || todayISO();
  if (dayEl) dayEl.value = recurring?.schedule?.dayOfMonth || 1;
  if (labelEl) labelEl.value = recurring.label || recurring.note || "";
  if (activeEl) activeEl.checked = recurring.active !== false;
  if (submitBtn) submitBtn.textContent = "Save Changes";
  if (cancelBtn) cancelBtn.style.display = "inline-flex";

  populateRecurringCategoryOptions(recurring.category || "Other");
  setRecurringError("");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteBudget(id) {
  const nextBudgets = (getState().budgets || []).filter((budget) => budget.id !== id);
  setBudgets(nextBudgets);

  if (document.getElementById("budgetEditId")?.value === id) {
    resetBudgetForm();
  }

  initDashboard(dashboardProfile);
}

function deleteRecurring(id) {
  const nextRecurring = getRecurringUserTransactions().filter((tx) => tx.id !== id);
  saveRecurringUserTransactions(nextRecurring);

  if (document.getElementById("recurringEditId")?.value === id) {
    resetRecurringForm();
  }

  initDashboard(dashboardProfile);
}

function toggleRecurringActive(id) {
  const nextRecurring = getRecurringUserTransactions().map((tx) => (
    tx.id === id ? { ...tx, active: tx.active === false } : tx
  ));
  saveRecurringUserTransactions(nextRecurring);

  const editingId = document.getElementById("recurringEditId")?.value;
  if (editingId === id) {
    const updated = nextRecurring.find((tx) => tx.id === id);
    if (updated) startEditRecurring(updated.id);
  }

  initDashboard(dashboardProfile);
}

function setupBudgetControls() {
  if (budgetControlsReady) return;

  const form = document.getElementById("budgetForm");
  const cancelBtn = document.getElementById("budgetCancelBtn");
  const editIdEl = document.getElementById("budgetEditId");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      setBudgetError("");

      const existingId = editIdEl?.value || "";
      const nextBudget = buildBudgetFromForm(existingId);
      if (!nextBudget) return;

      const budgets = [...(getState().budgets || [])];
      const updatedBudgets = existingId
        ? budgets.map((budget) => (budget.id === existingId ? nextBudget : budget))
        : budgets.concat(nextBudget);

      setBudgets(updatedBudgets);
      resetBudgetForm();
      initDashboard(dashboardProfile);
    });
  }

  if (cancelBtn) cancelBtn.addEventListener("click", resetBudgetForm);
  budgetControlsReady = true;
}

function setupRecurringControls() {
  if (recurringControlsReady) return;

  const form = document.getElementById("recurringForm");
  const cancelBtn = document.getElementById("recurringCancelBtn");
  const editIdEl = document.getElementById("recurringEditId");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      setRecurringError("");

      const existingId = editIdEl?.value || "";
      const nextRecurring = buildRecurringFromForm(existingId);
      if (!nextRecurring) return;

      const recurringTransactions = [...getRecurringUserTransactions()];
      const updatedRecurring = existingId
        ? recurringTransactions.map((tx) => (tx.id === existingId ? nextRecurring : tx))
        : recurringTransactions.concat(nextRecurring);

      saveRecurringUserTransactions(updatedRecurring);
      resetRecurringForm();
      initDashboard(dashboardProfile);
    });
  }

  if (cancelBtn) cancelBtn.addEventListener("click", resetRecurringForm);
  recurringControlsReady = true;
}

function renderBudgetSection(categoryTotals) {
  const listEl = document.getElementById("budgetList");
  const emptyEl = document.getElementById("budgetEmpty");
  if (!listEl || !emptyEl) return;

  populateBudgetCategoryOptions(document.getElementById("budgetCategory")?.value || "Other");

  const summaries = getBudgetSummaries(getState().budgets, categoryTotals);
  listEl.innerHTML = "";

  if (!summaries.length) {
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");

  for (const summary of summaries) {
    const card = document.createElement("div");
    card.className = `budgetCard${summary.isOverBudget ? " over" : ""}`;

    const toneClass = summary.isOverBudget ? "budgetTone over" : "budgetTone";
    const statusText = summary.isOverBudget
      ? `${formatMoney(Math.abs(summary.remaining))} over budget`
      : `${formatMoney(summary.remaining)} remaining`;
    const width = Math.max(0, Math.min(100, Math.round(summary.percentUsed)));

    card.innerHTML = `
      <div class="budgetCardHeader">
        <div class="budgetMeta">
          <h3>${summary.category}</h3>
          <div class="muted">Budget ${formatMoney(summary.budget)} - Spent ${formatMoney(summary.actual)}</div>
        </div>
        <div class="${toneClass}">${statusText}</div>
      </div>

      <div class="budgetBar" aria-hidden="true">
        <div class="budgetBarFill${summary.isOverBudget ? " over" : ""}" style="width:${width}%;"></div>
      </div>

      <div class="budgetFoot">
        <div class="muted">${Math.round(summary.percentUsed)}% of budget used this month</div>
        <div class="budgetBtns">
          <button class="btn secondary" data-budget-edit="${summary.id}" type="button">Edit</button>
          <button class="btn" data-budget-delete="${summary.id}" type="button">Delete</button>
        </div>
      </div>
    `;

    listEl.appendChild(card);
  }

  listEl.querySelectorAll("button[data-budget-edit]").forEach((btn) => {
    btn.addEventListener("click", () => startEditBudget(btn.dataset.budgetEdit));
  });

  listEl.querySelectorAll("button[data-budget-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteBudget(btn.dataset.budgetDelete));
  });
}

function renderRecurringSection() {
  const listEl = document.getElementById("recurringList");
  const emptyEl = document.getElementById("recurringEmpty");
  if (!listEl || !emptyEl) return;

  populateRecurringCategoryOptions(document.getElementById("recurringCategory")?.value || "Other");

  const recurringTransactions = [...getRecurringUserTransactions()]
    .sort((a, b) => {
      if ((a.active !== false) !== (b.active !== false)) return a.active === false ? 1 : -1;
      return String(a.label || a.note || "").localeCompare(String(b.label || b.note || ""));
    });

  listEl.innerHTML = "";

  if (!recurringTransactions.length) {
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");

  const prettyAccount = (account) => {
    const value = String(account || "checking").toLowerCase();
    if (value === "checking") return "Checking";
    if (value === "savings") return "Savings";
    if (value === "cash") return "Cash";
    return "Checking";
  };

  for (const tx of recurringTransactions) {
    const card = document.createElement("div");
    card.className = `recurringCard${tx.active === false ? " paused" : ""}`;
    const isActive = tx.active !== false;
    const statusLabel = isActive ? "Active" : "Paused";

    card.innerHTML = `
      <div class="recurringHeader">
        <div class="recurringMeta">
          <h3>${tx.label || tx.note || "Recurring transaction"}</h3>
          <div class="muted">${tx.type === "income" ? "Income" : "Expense"} - ${tx.category || "Other"} - ${prettyAccount(tx.account)}</div>
          <div class="muted">${formatMoney(tx.amount)} on day ${(tx.schedule && tx.schedule.dayOfMonth) || 1} each month, starting ${tx.startDate || todayISO()}</div>
        </div>
        <div class="recurringStatus${isActive ? "" : " paused"}">${statusLabel}</div>
      </div>

      <div class="recurringFoot">
        <div class="muted">${isActive ? "Included in monthly summaries." : "Ignored until you resume it."}</div>
        <div class="budgetBtns">
          <button class="btn secondary" data-recurring-toggle="${tx.id}" type="button">${isActive ? "Pause" : "Resume"}</button>
          <button class="btn secondary" data-recurring-edit="${tx.id}" type="button">Edit</button>
          <button class="btn" data-recurring-delete="${tx.id}" type="button">Delete</button>
        </div>
      </div>
    `;

    listEl.appendChild(card);
  }

  listEl.querySelectorAll("button[data-recurring-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => toggleRecurringActive(btn.dataset.recurringToggle));
  });

  listEl.querySelectorAll("button[data-recurring-edit]").forEach((btn) => {
    btn.addEventListener("click", () => startEditRecurring(btn.dataset.recurringEdit));
  });

  listEl.querySelectorAll("button[data-recurring-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteRecurring(btn.dataset.recurringDelete));
  });
}

function initDashboard(profile) {
  dashboardProfile = profile;
  loadState();
  setupBudgetControls();
  setupRecurringControls();

  const { transactions, recurringTransactions } = getState();
  const ym = currentYearMonth();

  const monthLabel = document.getElementById("monthLabel");
  if (monthLabel) monthLabel.textContent = ym;

  const acctBalances = getAccountBalances(transactions, profile);
  const totalBalance = getTotalBalanceFromAccounts(acctBalances);

  const balanceEl = document.getElementById("balance");
  if (balanceEl) balanceEl.textContent = formatMoney(totalBalance);

  const checkingDisplay = document.getElementById("checkingDisplay");
  const savingsDisplay = document.getElementById("savingsDisplay");
  const cashDisplay = document.getElementById("cashDisplay");

  if (checkingDisplay) checkingDisplay.textContent = formatMoney(acctBalances.checking);
  if (savingsDisplay) savingsDisplay.textContent = formatMoney(acctBalances.savings);
  if (cashDisplay) cashDisplay.textContent = formatMoney(acctBalances.cash);

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
      `Checking ${formatMoney(acctBalances.checking)} - ` +
      `Savings ${formatMoney(acctBalances.savings)} - ` +
      `Cash ${formatMoney(acctBalances.cash)}`;
  }

  if (barChecking) barChecking.style.width = `${Math.round(pC)}%`;
  if (barSavings) barSavings.style.width = `${Math.round(pS)}%`;
  if (barCash) barCash.style.width = `${Math.round(pH)}%`;

  if (totalForBars === 0) {
    if (barChecking) barChecking.style.width = "34%";
    if (barSavings) barSavings.style.width = "33%";
    if (barCash) barCash.style.width = "33%";
  }

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

      const prettyAccount = (account) => {
        const value = String(account || "checking").toLowerCase();
        if (value === "checking") return "Checking";
        if (value === "savings") return "Savings";
        if (value === "cash") return "Cash";
        return "Checking";
      };

      const accountLabelForTx = (tx) => {
        if (tx.type === "transfer") {
          return `${prettyAccount(tx.fromAccount)} -> ${prettyAccount(tx.toAccount)}`;
        }
        return prettyAccount(tx.account);
      };

      for (const tx of recent) {
        const li = document.createElement("li");
        const left = tx.type === "transfer"
          ? `Transfer - ${accountLabelForTx(tx)}`
          : `${tx.category || "Other"} - ${accountLabelForTx(tx)}`;

        li.innerHTML = `
          <span>${tx.date} - ${left}</span>
          <strong>${tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}${formatMoney(tx.amount)}</strong>
        `;
        recentList.appendChild(li);
      }
    }
  }

  const insightsList = document.getElementById("insightsList");
  const insightsEmpty = document.getElementById("insightsEmpty");

  const monthly = getMonthlySummary(transactions, ym, recurringTransactions);
  const fixedTotal = getRecurringOccurrencesForMonth(recurringTransactions, ym)
    .filter((tx) => tx.type === "expense" && (tx.category === "Fixed" || tx.label))
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const totalExpenses = monthly.expense;
  const net = monthly.net;

  const incomeEl = document.getElementById("incomeMonth");
  const expenseEl = document.getElementById("expenseMonth");
  const netEl = document.getElementById("netMonth");

  if (incomeEl) incomeEl.textContent = formatMoney(monthly.income);
  if (expenseEl) expenseEl.textContent = formatMoney(totalExpenses);
  if (netEl) netEl.textContent = formatMoney(net);

  const totalsObj = getCategoryTotals(transactions, ym, recurringTransactions);
  renderBudgetSection(totalsObj);
  renderRecurringSection();

  if (insightsList && insightsEmpty) {
    insightsList.innerHTML = "";

    const insights = [];

    if (monthly.income === 0 && totalExpenses > 0) {
      insights.push(["No income logged this month", "Add an income transaction to see accurate net."]);
    } else if (net < 0) {
      insights.push(["You're net negative this month", `Net: ${formatMoney(net)}.`]);
    } else {
      insights.push(["You're net positive this month", `Net: ${formatMoney(net)}.`]);
    }

    if (totalExpenses > 0 && fixedTotal > 0) {
      const share = Math.round((fixedTotal / totalExpenses) * 100);
      insights.push(["Fixed expenses share", `${share}% of this month's expenses are fixed or recurring.`]);
    }

    const overBudgetItems = getBudgetSummaries(getState().budgets, totalsObj)
      .filter((item) => item.isOverBudget);
    if (overBudgetItems.length > 0) {
      insights.push([
        "Budget alert",
        `${overBudgetItems[0].category} is ${formatMoney(Math.abs(overBudgetItems[0].remaining))} over budget.`
      ]);
    }

    const pausedRecurring = getRecurringUserTransactions().filter((tx) => tx.active === false).length;
    if (pausedRecurring > 0) {
      insights.push([
        "Paused recurring items",
        `${pausedRecurring} recurring ${pausedRecurring === 1 ? "item is" : "items are"} currently paused.`
      ]);
    }

    if (totalExpenses > 0) {
      const runway = totalBalance / totalExpenses;
      if (Number.isFinite(runway)) {
        insights.push(["Runway (rough)", `${runway.toFixed(1)} months at this month's spending.`]);
      }
    }

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

  const ul = document.getElementById("topCategories");
  const empty = document.getElementById("emptyTopCategories");
  if (!ul || !empty) return;

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
