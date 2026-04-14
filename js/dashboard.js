let dashboardProfile = null;
let categoryControlsReady = false;
let budgetControlsReady = false;
let goalControlsReady = false;
let recurringControlsReady = false;
let backupControlsReady = false;
let analyticsControlsReady = false;
let reportControlsReady = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[match]));
}

function getRecurringUserTransactions() {
  return (getState().recurringTransactions || []).filter((tx) => tx.source !== "profile-fixed-expense");
}

function saveRecurringUserTransactions(items) {
  const fixed = (getState().recurringTransactions || []).filter((tx) => tx.source === "profile-fixed-expense");
  setRecurringTransactions(fixed.concat(items || []));
}

function getDashboardCategories() {
  return getAllCategories();
}

function fillSelectWithCategories(selectEl, selectedCategory = "Other", includeAllOption = false) {
  if (!selectEl) return;
  const categories = getDashboardCategories();
  const options = [];
  if (includeAllOption) options.push(`<option value="all">All categories</option>`);
  for (const category of categories) {
    const selected = category === selectedCategory ? " selected" : "";
    options.push(`<option value="${escapeHtml(category)}"${selected}>${escapeHtml(category)}</option>`);
  }
  selectEl.innerHTML = options.join("");
  selectEl.value = includeAllOption && selectedCategory === "all"
    ? "all"
    : (categories.includes(selectedCategory) ? selectedCategory : (includeAllOption ? "all" : "Other"));
}

function populateBudgetCategoryOptions(selected = "Other") {
  fillSelectWithCategories(document.getElementById("budgetCategory"), selected);
}

function populateRecurringCategoryOptions(selected = "Other") {
  fillSelectWithCategories(document.getElementById("recurringCategory"), selected);
}

function setTextMessage(id, message, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || "";
  el.style.display = message ? "block" : "none";
  if (id === "backupMessage") el.style.color = isError ? "#b00020" : "";
}

function setCategoryError(message) { setTextMessage("categoryError", message); }
function setBudgetError(message) { setTextMessage("budgetError", message); }
function setRecurringError(message) { setTextMessage("recurringError", message); }
function setBackupMessage(message, isError = false) { setTextMessage("backupMessage", message, isError); }
function setAnalyticsError(message) { setTextMessage("analyticsError", message); }
function setGoalError(message) { setTextMessage("goalError", message); }
function setReportError(message) { setTextMessage("reportError", message); }

function resetCategoryForm() {
  document.getElementById("categoryForm")?.reset();
  const input = document.getElementById("categoryName");
  if (input) input.value = "";
  setCategoryError("");
}

function resetBudgetForm() {
  document.getElementById("budgetForm")?.reset();
  const editIdEl = document.getElementById("budgetEditId");
  const amountEl = document.getElementById("budgetAmount");
  const submitBtn = document.getElementById("budgetSubmitBtn");
  const cancelBtn = document.getElementById("budgetCancelBtn");
  if (editIdEl) editIdEl.value = "";
  if (amountEl) amountEl.value = "";
  if (submitBtn) submitBtn.textContent = "Save Budget";
  if (cancelBtn) cancelBtn.style.display = "none";
  populateBudgetCategoryOptions("Other");
  setBudgetError("");
}

function resetRecurringForm() {
  document.getElementById("recurringForm")?.reset();
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

function resetGoalForm() {
  document.getElementById("goalForm")?.reset();
  const editIdEl = document.getElementById("goalEditId");
  const nameEl = document.getElementById("goalName");
  const targetEl = document.getElementById("goalTargetAmount");
  const savedEl = document.getElementById("goalSavedAmount");
  const linkedEl = document.getElementById("goalLinkedAccount");
  const submitBtn = document.getElementById("goalSubmitBtn");
  const cancelBtn = document.getElementById("goalCancelBtn");
  if (editIdEl) editIdEl.value = "";
  if (nameEl) nameEl.value = "";
  if (targetEl) targetEl.value = "";
  if (savedEl) savedEl.value = "";
  if (linkedEl) linkedEl.value = "none";
  if (submitBtn) submitBtn.textContent = "Save Goal";
  if (cancelBtn) cancelBtn.style.display = "none";
  setGoalError("");
}

function resetAnalyticsRange() {
  const startEl = document.getElementById("analyticsStartDate");
  const endEl = document.getElementById("analyticsEndDate");
  if (endEl) endEl.value = todayISO();
  if (startEl) startEl.value = shiftYearMonth(currentYearMonth(), -1) + "-01";
  setAnalyticsError("");
}

function resetReportMonth() {
  const monthEl = document.getElementById("reportMonth");
  if (monthEl) monthEl.value = currentYearMonth();
  setReportError("");
}

function buildBudgetFromForm(existingId) {
  const category = String(document.getElementById("budgetCategory")?.value || "").trim();
  const amount = Math.round((Number(document.getElementById("budgetAmount")?.value) || 0) * 100) / 100;
  if (!category) return setBudgetError("Please choose a category."), null;
  if (!Number.isFinite(amount) || amount < 0) return setBudgetError("Please enter a valid budget amount."), null;
  const duplicate = (getState().budgets || []).find((b) => b.category === category && b.id !== existingId);
  if (duplicate) return setBudgetError("That category already has a monthly budget. Edit it instead."), null;
  return { id: existingId || makeId(), category, amount };
}

function buildRecurringFromForm(existingId) {
  const type = document.getElementById("recurringType")?.value === "income" ? "income" : "expense";
  const amount = Math.round((Number(document.getElementById("recurringAmount")?.value) || 0) * 100) / 100;
  const category = String(document.getElementById("recurringCategory")?.value || "Other").trim() || "Other";
  const account = String(document.getElementById("recurringAccount")?.value || "checking").trim() || "checking";
  const startDate = document.getElementById("recurringStartDate")?.value || "";
  const dayOfMonth = Number(document.getElementById("recurringDayOfMonth")?.value);
  const label = String(document.getElementById("recurringLabel")?.value || "").trim();
  const active = Boolean(document.getElementById("recurringActive")?.checked);

  if (!Number.isFinite(amount) || amount <= 0) return setRecurringError("Please enter a valid recurring amount greater than 0."), null;
  if (!startDate) return setRecurringError("Please choose a start date."), null;
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return setRecurringError("Monthly day must be between 1 and 31."), null;
  if (!label) return setRecurringError("Please add a label or note so this recurring item is easy to recognize."), null;

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
    schedule: { frequency: "monthly", dayOfMonth },
    source: "user"
  };
}

function buildGoalFromForm(existingId) {
  const name = String(document.getElementById("goalName")?.value || "").trim();
  const targetAmount = Math.round((Number(document.getElementById("goalTargetAmount")?.value) || 0) * 100) / 100;
  const savedAmount = Math.round((Number(document.getElementById("goalSavedAmount")?.value) || 0) * 100) / 100;
  const linkedAccount = String(document.getElementById("goalLinkedAccount")?.value || "none").toLowerCase();

  if (!name) return setGoalError("Please enter a goal name."), null;
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) return setGoalError("Please enter a valid target amount greater than 0."), null;
  if (!Number.isFinite(savedAmount) || savedAmount < 0) return setGoalError("Current saved amount can't be negative."), null;

  return {
    id: existingId || makeId(),
    name,
    targetAmount,
    savedAmount,
    linkedAccount
  };
}

function createBackupPayload() {
  return { version: 1, exportedAt: new Date().toISOString(), state: getState(), profile: loadProfile() };
}

function validateBackupPayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("This file doesn't look like an Atlas backup.");
  if (!payload.state || typeof payload.state !== "object") throw new Error("The backup is missing app state.");
  if (payload.state.transactions && !Array.isArray(payload.state.transactions)) throw new Error("Transactions must be an array.");
  if (payload.state.recurringTransactions && !Array.isArray(payload.state.recurringTransactions)) throw new Error("Recurring transactions must be an array.");
  if (payload.state.budgets && !Array.isArray(payload.state.budgets)) throw new Error("Budgets must be an array.");
  if (payload.state.goals && !Array.isArray(payload.state.goals)) throw new Error("Goals must be an array.");
  if (payload.state.categories && !Array.isArray(payload.state.categories)) throw new Error("Categories must be an array.");
  if (payload.profile != null && typeof payload.profile !== "object") throw new Error("Profile data must be an object.");
}

function downloadBackupFile(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `atlas-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function importBackupFile(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    validateBackupPayload(payload);
    replaceState(payload.state);
    const nextProfile = replaceProfile(payload.profile);
    dashboardProfile = nextProfile;
    if (nextProfile) {
      renderFromProfile(nextProfile);
    } else {
      showSetup();
      prefillSetupForm(null);
    }
    resetCategoryForm();
    resetBudgetForm();
    resetGoalForm();
    resetRecurringForm();
    setBackupMessage("Backup imported successfully.");
  } catch (error) {
    setBackupMessage(error?.message || "That backup file couldn't be imported.", true);
  }
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
  const ids = {
    editIdEl: "recurringEditId",
    typeEl: "recurringType",
    amountEl: "recurringAmount",
    accountEl: "recurringAccount",
    startDateEl: "recurringStartDate",
    dayEl: "recurringDayOfMonth",
    labelEl: "recurringLabel",
    activeEl: "recurringActive",
    submitBtn: "recurringSubmitBtn",
    cancelBtn: "recurringCancelBtn"
  };
  document.getElementById(ids.editIdEl).value = recurring.id;
  document.getElementById(ids.typeEl).value = recurring.type || "expense";
  document.getElementById(ids.amountEl).value = recurring.amount;
  document.getElementById(ids.accountEl).value = recurring.account || "checking";
  document.getElementById(ids.startDateEl).value = recurring.startDate || todayISO();
  document.getElementById(ids.dayEl).value = recurring?.schedule?.dayOfMonth || 1;
  document.getElementById(ids.labelEl).value = recurring.label || recurring.note || "";
  document.getElementById(ids.activeEl).checked = recurring.active !== false;
  document.getElementById(ids.submitBtn).textContent = "Save Changes";
  document.getElementById(ids.cancelBtn).style.display = "inline-flex";
  populateRecurringCategoryOptions(recurring.category || "Other");
  setRecurringError("");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startEditGoal(id) {
  const goal = (getState().goals || []).find((item) => item.id === id);
  if (!goal) return;
  const editIdEl = document.getElementById("goalEditId");
  const nameEl = document.getElementById("goalName");
  const targetEl = document.getElementById("goalTargetAmount");
  const savedEl = document.getElementById("goalSavedAmount");
  const linkedEl = document.getElementById("goalLinkedAccount");
  const submitBtn = document.getElementById("goalSubmitBtn");
  const cancelBtn = document.getElementById("goalCancelBtn");

  if (editIdEl) editIdEl.value = goal.id;
  if (nameEl) nameEl.value = goal.name || "";
  if (targetEl) targetEl.value = goal.targetAmount;
  if (savedEl) savedEl.value = goal.savedAmount;
  if (linkedEl) linkedEl.value = goal.linkedAccount || "none";
  if (submitBtn) submitBtn.textContent = "Save Changes";
  if (cancelBtn) cancelBtn.style.display = "inline-flex";
  setGoalError("");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteBudget(id) {
  setBudgets((getState().budgets || []).filter((budget) => budget.id !== id));
  if (document.getElementById("budgetEditId")?.value === id) resetBudgetForm();
  initDashboard(dashboardProfile);
}

function deleteRecurring(id) {
  saveRecurringUserTransactions(getRecurringUserTransactions().filter((tx) => tx.id !== id));
  if (document.getElementById("recurringEditId")?.value === id) resetRecurringForm();
  initDashboard(dashboardProfile);
}

function deleteGoal(id) {
  setGoals((getState().goals || []).filter((goal) => goal.id !== id));
  if (document.getElementById("goalEditId")?.value === id) resetGoalForm();
  initDashboard(dashboardProfile);
}

function toggleRecurringActive(id) {
  const nextRecurring = getRecurringUserTransactions().map((tx) => tx.id === id ? { ...tx, active: tx.active === false } : tx);
  saveRecurringUserTransactions(nextRecurring);
  if (document.getElementById("recurringEditId")?.value === id) {
    const updated = nextRecurring.find((tx) => tx.id === id);
    if (updated) startEditRecurring(updated.id);
  }
  initDashboard(dashboardProfile);
}

function deleteCategory(category) {
  if (isCategoryInUse(category)) return setCategoryError("That category is still in use, so it can't be deleted yet.");
  setCategories((getState().categories || []).filter((item) => item !== category));
  setCategoryError("");
  initDashboard(dashboardProfile);
}

function setupCategoryControls() {
  if (categoryControlsReady) return;
  const form = document.getElementById("categoryForm");
  const inputEl = document.getElementById("categoryName");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const nextCategory = normalizeCategoryName(inputEl?.value || "");
    if (!nextCategory) return setCategoryError("Please enter a category name.");
    if (getAllCategories().some((c) => c.toLowerCase() === nextCategory.toLowerCase())) return setCategoryError("That category already exists.");
    setCategories((getState().categories || []).concat(nextCategory));
    resetCategoryForm();
    initDashboard(dashboardProfile);
  });
  categoryControlsReady = true;
}

function setupBudgetControls() {
  if (budgetControlsReady) return;
  const form = document.getElementById("budgetForm");
  const cancelBtn = document.getElementById("budgetCancelBtn");
  const editIdEl = document.getElementById("budgetEditId");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    setBudgetError("");
    const existingId = editIdEl?.value || "";
    const nextBudget = buildBudgetFromForm(existingId);
    if (!nextBudget) return;
    const budgets = [...(getState().budgets || [])];
    setBudgets(existingId ? budgets.map((b) => (b.id === existingId ? nextBudget : b)) : budgets.concat(nextBudget));
    resetBudgetForm();
    initDashboard(dashboardProfile);
  });
  cancelBtn?.addEventListener("click", resetBudgetForm);
  budgetControlsReady = true;
}

function setupGoalControls() {
  if (goalControlsReady) return;
  const form = document.getElementById("goalForm");
  const cancelBtn = document.getElementById("goalCancelBtn");
  const editIdEl = document.getElementById("goalEditId");

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    setGoalError("");
    const existingId = editIdEl?.value || "";
    const nextGoal = buildGoalFromForm(existingId);
    if (!nextGoal) return;
    const goals = [...(getState().goals || [])];
    setGoals(existingId ? goals.map((goal) => (goal.id === existingId ? nextGoal : goal)) : goals.concat(nextGoal));
    resetGoalForm();
    initDashboard(dashboardProfile);
  });

  cancelBtn?.addEventListener("click", resetGoalForm);
  goalControlsReady = true;
}

function setupRecurringControls() {
  if (recurringControlsReady) return;
  const form = document.getElementById("recurringForm");
  const cancelBtn = document.getElementById("recurringCancelBtn");
  const editIdEl = document.getElementById("recurringEditId");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    setRecurringError("");
    const existingId = editIdEl?.value || "";
    const nextRecurring = buildRecurringFromForm(existingId);
    if (!nextRecurring) return;
    const items = [...getRecurringUserTransactions()];
    saveRecurringUserTransactions(existingId ? items.map((t) => (t.id === existingId ? nextRecurring : t)) : items.concat(nextRecurring));
    resetRecurringForm();
    initDashboard(dashboardProfile);
  });
  cancelBtn?.addEventListener("click", resetRecurringForm);
  recurringControlsReady = true;
}

function setupBackupControls() {
  if (backupControlsReady) return;
  const exportBtn = document.getElementById("exportBackupBtn");
  const importInput = document.getElementById("importBackupFile");
  exportBtn?.addEventListener("click", () => {
    downloadBackupFile(createBackupPayload());
    setBackupMessage("Backup exported successfully.");
  });
  importInput?.addEventListener("change", async () => {
    await importBackupFile(importInput.files?.[0]);
    importInput.value = "";
  });
  backupControlsReady = true;
}

function setupAnalyticsControls() {
  if (analyticsControlsReady) return;
  const resetBtn = document.getElementById("analyticsResetBtn");
  const inputs = ["analyticsStartDate", "analyticsEndDate"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  for (const input of inputs) {
    input.addEventListener("input", () => {
      setAnalyticsError("");
      initDashboard(dashboardProfile);
    });
    input.addEventListener("change", () => {
      setAnalyticsError("");
      initDashboard(dashboardProfile);
    });
  }

  resetBtn?.addEventListener("click", () => {
    resetAnalyticsRange();
    initDashboard(dashboardProfile);
  });

  analyticsControlsReady = true;
}

function setupReportControls() {
  if (reportControlsReady) return;
  const monthEl = document.getElementById("reportMonth");
  const resetBtn = document.getElementById("reportResetBtn");
  const printBtn = document.getElementById("reportPrintBtn");

  monthEl?.addEventListener("input", () => {
    setReportError("");
    initDashboard(dashboardProfile);
  });
  monthEl?.addEventListener("change", () => {
    setReportError("");
    initDashboard(dashboardProfile);
  });
  resetBtn?.addEventListener("click", () => {
    resetReportMonth();
    initDashboard(dashboardProfile);
  });
  printBtn?.addEventListener("click", () => window.print());

  reportControlsReady = true;
}

function renderCategorySection() {
  const listEl = document.getElementById("categoryList");
  const emptyEl = document.getElementById("categoryEmpty");
  if (!listEl || !emptyEl) return;
  const customCategories = [...(getState().categories || [])].sort((a, b) => a.localeCompare(b));
  const visibleCategories = getDashboardCategories();
  listEl.innerHTML = "";
  emptyEl.classList.toggle("hidden", customCategories.length > 0);

  for (const category of visibleCategories) {
    const isCustom = customCategories.includes(category);
    const row = document.createElement("div");
    row.className = "categoryRow";
    row.innerHTML = `
      <div class="categoryMeta">
        <strong>${escapeHtml(category)}</strong>
        <span class="${isCustom ? "categoryBadge custom" : "categoryBadge"}">${isCustom ? "Custom" : "Default"}</span>
        <span class="muted">${isCategoryInUse(category) ? "In use" : "Not in use"}</span>
      </div>
      ${isCustom ? `<button class="btn secondary" data-category-delete="${escapeHtml(category)}" type="button">Delete</button>` : ""}
    `;
    listEl.appendChild(row);
  }

  listEl.querySelectorAll("button[data-category-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteCategory(btn.dataset.categoryDelete));
  });
}

function renderBudgetSection(categoryTotals) {
  const listEl = document.getElementById("budgetList");
  const emptyEl = document.getElementById("budgetEmpty");
  if (!listEl || !emptyEl) return;
  populateBudgetCategoryOptions(document.getElementById("budgetCategory")?.value || "Other");
  const summaries = getBudgetSummaries(getState().budgets, categoryTotals);
  listEl.innerHTML = "";
  emptyEl.classList.toggle("hidden", summaries.length > 0);

  for (const summary of summaries) {
    const width = Math.max(0, Math.min(100, Math.round(summary.percentUsed)));
    const toneClass = summary.isOverBudget ? "budgetTone over" : "budgetTone";
    const statusText = summary.isOverBudget ? `${formatMoney(Math.abs(summary.remaining))} over budget` : `${formatMoney(summary.remaining)} remaining`;
    const card = document.createElement("div");
    card.className = `budgetCard${summary.isOverBudget ? " over" : ""}`;
    card.innerHTML = `
      <div class="budgetCardHeader">
        <div class="budgetMeta">
          <h3>${escapeHtml(summary.category)}</h3>
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

  listEl.querySelectorAll("button[data-budget-edit]").forEach((btn) => btn.addEventListener("click", () => startEditBudget(btn.dataset.budgetEdit)));
  listEl.querySelectorAll("button[data-budget-delete]").forEach((btn) => btn.addEventListener("click", () => deleteBudget(btn.dataset.budgetDelete)));
}

function renderRecurringSection() {
  const listEl = document.getElementById("recurringList");
  const emptyEl = document.getElementById("recurringEmpty");
  if (!listEl || !emptyEl) return;
  populateRecurringCategoryOptions(document.getElementById("recurringCategory")?.value || "Other");
  const recurringTransactions = [...getRecurringUserTransactions()].sort((a, b) => {
    if ((a.active !== false) !== (b.active !== false)) return a.active === false ? 1 : -1;
    return String(a.label || a.note || "").localeCompare(String(b.label || b.note || ""));
  });
  listEl.innerHTML = "";
  emptyEl.classList.toggle("hidden", recurringTransactions.length > 0);

  const prettyAccount = (account) => {
    const value = String(account || "checking").toLowerCase();
    if (value === "checking") return "Checking";
    if (value === "savings") return "Savings";
    if (value === "cash") return "Cash";
    return "Checking";
  };

  for (const tx of recurringTransactions) {
    const isActive = tx.active !== false;
    const card = document.createElement("div");
    card.className = `recurringCard${isActive ? "" : " paused"}`;
    card.innerHTML = `
      <div class="recurringHeader">
        <div class="recurringMeta">
          <h3>${escapeHtml(tx.label || tx.note || "Recurring transaction")}</h3>
          <div class="muted">${tx.type === "income" ? "Income" : "Expense"} - ${escapeHtml(tx.category || "Other")} - ${prettyAccount(tx.account)}</div>
          <div class="muted">${formatMoney(tx.amount)} on day ${(tx.schedule && tx.schedule.dayOfMonth) || 1} each month, starting ${tx.startDate || todayISO()}</div>
        </div>
        <div class="recurringStatus${isActive ? "" : " paused"}">${isActive ? "Active" : "Paused"}</div>
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

  listEl.querySelectorAll("button[data-recurring-toggle]").forEach((btn) => btn.addEventListener("click", () => toggleRecurringActive(btn.dataset.recurringToggle)));
  listEl.querySelectorAll("button[data-recurring-edit]").forEach((btn) => btn.addEventListener("click", () => startEditRecurring(btn.dataset.recurringEdit)));
  listEl.querySelectorAll("button[data-recurring-delete]").forEach((btn) => btn.addEventListener("click", () => deleteRecurring(btn.dataset.recurringDelete)));
}

function renderGoalSection(accountBalances, monthlySurplus) {
  const listEl = document.getElementById("goalList");
  const emptyEl = document.getElementById("goalEmpty");
  if (!listEl || !emptyEl) return;

  const summaries = getGoalProgressSummaries(getState().goals, accountBalances, monthlySurplus);
  listEl.innerHTML = "";
  emptyEl.classList.toggle("hidden", summaries.length > 0);

  for (const goal of summaries) {
    const linkedLabel = goal.linkedAccount !== "none"
      ? `Linked to ${escapeHtml(goal.linkedAccount)}`
      : "Manual saved amount";
    const estimateText = goal.estimatedMonths == null
      ? "No estimate available yet."
      : goal.estimatedMonths <= 0
        ? "Goal reached."
        : `${goal.estimatedMonths.toFixed(1)} months at your current surplus.`;

    const card = document.createElement("div");
    card.className = "goalCard";
    card.innerHTML = `
      <div class="goalHeader">
        <div class="goalMeta">
          <h3>${escapeHtml(goal.name)}</h3>
          <div class="muted">Target ${formatMoney(goal.targetAmount)} · Current ${formatMoney(goal.currentAmount)}</div>
          <div class="muted">${linkedLabel}</div>
        </div>
        <div><strong>${Math.round(goal.percentComplete)}%</strong></div>
      </div>
      <div class="goalBar" aria-hidden="true">
        <div class="goalBarFill" style="width:${Math.max(4, Math.min(100, Math.round(goal.percentComplete)))}%;"></div>
      </div>
      <div class="goalFoot">
        <div class="muted">${formatMoney(goal.remaining)} remaining · ${estimateText}</div>
        <div class="budgetBtns">
          <button class="btn secondary" data-goal-edit="${goal.id}" type="button">Edit</button>
          <button class="btn" data-goal-delete="${goal.id}" type="button">Delete</button>
        </div>
      </div>
    `;
    listEl.appendChild(card);
  }

  listEl.querySelectorAll("button[data-goal-edit]").forEach((btn) => btn.addEventListener("click", () => startEditGoal(btn.dataset.goalEdit)));
  listEl.querySelectorAll("button[data-goal-delete]").forEach((btn) => btn.addEventListener("click", () => deleteGoal(btn.dataset.goalDelete)));
}

function renderTrendSection(transactions, recurringTransactions, yearMonth) {
  const trendChartEl = document.getElementById("expenseTrendChart");
  const trendEmptyEl = document.getElementById("expenseTrendEmpty");
  const breakdownEl = document.getElementById("categoryBreakdownChart");
  const breakdownEmptyEl = document.getElementById("categoryBreakdownEmpty");
  const comparisonValueEl = document.getElementById("monthComparisonValue");
  const comparisonTextEl = document.getElementById("monthComparisonText");

  const trendPoints = getExpenseTrend(transactions, recurringTransactions, yearMonth, 6);
  const maxExpense = Math.max(0, ...trendPoints.map((point) => point.expense));
  if (trendChartEl && trendEmptyEl) {
    trendChartEl.innerHTML = "";
    trendEmptyEl.classList.toggle("hidden", trendPoints.some((point) => point.expense > 0));
    if (trendPoints.some((point) => point.expense > 0)) {
      for (const point of trendPoints) {
        const height = maxExpense > 0 ? Math.max(6, Math.round((point.expense / maxExpense) * 150)) : 6;
        const group = document.createElement("div");
        group.className = "trendBarGroup";
        group.innerHTML = `
          <div class="trendBarValue">${formatMoney(point.expense)}</div>
          <div class="trendBarTrack" aria-hidden="true"><div class="trendBarFill" style="height:${height}px;"></div></div>
          <div class="trendBarLabel">${escapeHtml(point.label)}</div>
        `;
        trendChartEl.appendChild(group);
      }
    }
  }

  const categoryItems = getCategoryBreakdownItems(getCategoryTotals(transactions, yearMonth, recurringTransactions)).slice(0, 5);
  if (breakdownEl && breakdownEmptyEl) {
    breakdownEl.innerHTML = "";
    breakdownEmptyEl.classList.toggle("hidden", categoryItems.length > 0);
    for (const item of categoryItems) {
      const row = document.createElement("div");
      row.className = "categoryBreakdownRow";
      row.innerHTML = `
        <div class="categoryBreakdownTop">
          <span>${escapeHtml(item.category)}</span>
          <strong>${formatMoney(item.amount)} (${Math.round(item.share)}%)</strong>
        </div>
        <div class="categoryBreakdownBar" aria-hidden="true">
          <div class="categoryBreakdownFill" style="width:${Math.max(4, Math.round(item.share))}%;"></div>
        </div>
      `;
      breakdownEl.appendChild(row);
    }
  }

  const currentMonth = getMonthlySummary(transactions, yearMonth, recurringTransactions);
  const previousMonth = getMonthlySummary(transactions, shiftYearMonth(yearMonth, -1), recurringTransactions);
  const difference = currentMonth.expense - previousMonth.expense;
  const percent = previousMonth.expense > 0 ? (difference / previousMonth.expense) * 100 : 0;

  if (comparisonValueEl) comparisonValueEl.textContent = formatMoney(currentMonth.expense);
  if (comparisonTextEl) {
    comparisonTextEl.textContent = previousMonth.expense === 0 && currentMonth.expense === 0
      ? "No expense comparison available yet."
      : previousMonth.expense === 0
        ? "This is your first month with recorded expenses."
        : difference === 0
          ? "Spending is flat compared with last month."
          : difference > 0
            ? `${formatMoney(difference)} more spent than last month (${Math.round(percent)}% increase).`
            : `${formatMoney(Math.abs(difference))} less spent than last month (${Math.round(Math.abs(percent))}% decrease).`;
  }
}

function renderAnalyticsSection(transactions, recurringTransactions) {
  const startEl = document.getElementById("analyticsStartDate");
  const endEl = document.getElementById("analyticsEndDate");
  const expenseEl = document.getElementById("analyticsExpense");
  const incomeEl = document.getElementById("analyticsIncome");
  const netEl = document.getElementById("analyticsNet");
  const avgEl = document.getElementById("analyticsAverageExpense");
  const biggestEl = document.getElementById("analyticsBiggestCategory");
  const accountListEl = document.getElementById("analyticsAccountList");
  const accountEmptyEl = document.getElementById("analyticsAccountEmpty");
  const merchantListEl = document.getElementById("analyticsMerchantList");
  const merchantEmptyEl = document.getElementById("analyticsMerchantEmpty");
  const largestListEl = document.getElementById("analyticsLargestList");
  const largestEmptyEl = document.getElementById("analyticsLargestEmpty");

  const startDate = startEl?.value || "";
  const endDate = endEl?.value || "";

  if (startDate && endDate && startDate > endDate) {
    setAnalyticsError("Start date must be on or before end date.");
    return;
  }

  const inRange = getTransactionsInRange(transactions, recurringTransactions, startDate, endDate);
  const summary = getAnalyticsSummary(inRange);

  if (expenseEl) expenseEl.textContent = formatMoney(summary.expense);
  if (incomeEl) incomeEl.textContent = formatMoney(summary.income);
  if (netEl) netEl.textContent = formatMoney(summary.net);
  if (avgEl) avgEl.textContent = formatMoney(summary.averageExpense);

  if (biggestEl) {
    biggestEl.textContent = summary.biggestCategory
      ? `${summary.biggestCategory.category} · ${formatMoney(summary.biggestCategory.amount)}`
      : "No expense data yet.";
  }

  if (accountListEl && accountEmptyEl) {
    accountListEl.innerHTML = "";
    accountEmptyEl.classList.toggle("hidden", summary.spendingByAccount.length > 0);

    for (const item of summary.spendingByAccount) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(item.account)}</span><strong>${formatMoney(item.amount)}</strong>`;
      accountListEl.appendChild(li);
    }
  }

  if (merchantListEl && merchantEmptyEl) {
    merchantListEl.innerHTML = "";
    merchantEmptyEl.classList.toggle("hidden", summary.topMerchants.length > 0);

    for (const item of summary.topMerchants) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(item.merchant)}</span><strong>${formatMoney(item.amount)}</strong>`;
      merchantListEl.appendChild(li);
    }
  }

  if (largestListEl && largestEmptyEl) {
    largestListEl.innerHTML = "";
    largestEmptyEl.classList.toggle("hidden", summary.largestExpenses.length > 0);

    for (const tx of summary.largestExpenses) {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${escapeHtml(tx.date)} · ${escapeHtml(tx.category || "Other")} · ${escapeHtml(tx.note || "No note")}</span>
        <strong>${formatMoney(tx.amount)}</strong>
      `;
      largestListEl.appendChild(li);
    }
  }
}

function renderMonthlyReportSection(transactions, recurringTransactions, accountBalances, monthlySurplus) {
  const monthEl = document.getElementById("reportMonth");
  const titleEl = document.getElementById("reportTitle");
  const incomeEl = document.getElementById("reportIncome");
  const expenseEl = document.getElementById("reportExpense");
  const netEl = document.getElementById("reportNet");
  const categoriesEl = document.getElementById("reportTopCategories");
  const categoriesEmptyEl = document.getElementById("reportTopCategoriesEmpty");
  const merchantsEl = document.getElementById("reportTopMerchants");
  const merchantsEmptyEl = document.getElementById("reportTopMerchantsEmpty");
  const accountsEl = document.getElementById("reportAccounts");
  const accountsEmptyEl = document.getElementById("reportAccountsEmpty");
  const budgetsEl = document.getElementById("reportBudgets");
  const budgetsEmptyEl = document.getElementById("reportBudgetsEmpty");
  const goalsEl = document.getElementById("reportGoals");
  const goalsEmptyEl = document.getElementById("reportGoalsEmpty");

  const reportMonth = monthEl?.value || currentYearMonth();
  if (!/^\d{4}-\d{2}$/.test(reportMonth)) {
    setReportError("Please choose a valid report month.");
    return;
  }

  setReportError("");

  const report = getMonthlyReportData({
    yearMonth: reportMonth,
    transactions,
    recurringTransactions,
    budgets: getState().budgets || [],
    goals: getState().goals || [],
    accountBalances,
    monthlySurplus
  });

  if (titleEl) titleEl.textContent = `${report.label} Report`;
  if (incomeEl) incomeEl.textContent = formatMoney(report.monthlySummary.income);
  if (expenseEl) expenseEl.textContent = formatMoney(report.monthlySummary.expense);
  if (netEl) netEl.textContent = formatMoney(report.monthlySummary.net);

  if (categoriesEl && categoriesEmptyEl) {
    categoriesEl.innerHTML = "";
    categoriesEmptyEl.classList.toggle("hidden", report.topCategories.length > 0);
    for (const item of report.topCategories) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(item.category)}</span><strong>${formatMoney(item.amount)} (${Math.round(item.share)}%)</strong>`;
      categoriesEl.appendChild(li);
    }
  }

  if (merchantsEl && merchantsEmptyEl) {
    merchantsEl.innerHTML = "";
    merchantsEmptyEl.classList.toggle("hidden", report.topMerchants.length > 0);
    for (const item of report.topMerchants) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(item.merchant)}</span><strong>${formatMoney(item.amount)}</strong>`;
      merchantsEl.appendChild(li);
    }
  }

  if (accountsEl && accountsEmptyEl) {
    accountsEl.innerHTML = "";
    accountsEmptyEl.classList.toggle("hidden", report.spendingByAccount.length > 0);
    for (const item of report.spendingByAccount) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(item.account)}</span><strong>${formatMoney(item.amount)}</strong>`;
      accountsEl.appendChild(li);
    }
  }

  if (budgetsEl && budgetsEmptyEl) {
    budgetsEl.innerHTML = "";
    budgetsEmptyEl.classList.toggle("hidden", report.budgetSummaries.length > 0);
    for (const item of report.budgetSummaries) {
      const statusText = item.isOverBudget
        ? `${formatMoney(Math.abs(item.remaining))} over budget`
        : `${formatMoney(item.remaining)} remaining`;
      const card = document.createElement("div");
      card.className = "reportItem";
      card.innerHTML = `
        <div class="reportItemTop">
          <div>
            <strong>${escapeHtml(item.category)}</strong>
            <div class="muted">Budget ${formatMoney(item.budget)} · Spent ${formatMoney(item.actual)}</div>
          </div>
          <div class="muted">${statusText}</div>
        </div>
      `;
      budgetsEl.appendChild(card);
    }
  }

  if (goalsEl && goalsEmptyEl) {
    goalsEl.innerHTML = "";
    goalsEmptyEl.classList.toggle("hidden", report.goalSummaries.length > 0);
    for (const goal of report.goalSummaries) {
      const estimateText = goal.estimatedMonths == null
        ? "No estimate yet"
        : goal.estimatedMonths <= 0
          ? "Goal reached"
          : `${goal.estimatedMonths.toFixed(1)} months at current surplus`;
      const card = document.createElement("div");
      card.className = "reportItem";
      card.innerHTML = `
        <div class="reportItemTop">
          <div>
            <strong>${escapeHtml(goal.name)}</strong>
            <div class="muted">${Math.round(goal.percentComplete)}% complete · ${formatMoney(goal.remaining)} remaining</div>
          </div>
          <div class="muted">${estimateText}</div>
        </div>
      `;
      goalsEl.appendChild(card);
    }
  }
}

function initDashboard(profile) {
  dashboardProfile = profile;
  loadState();
  setupCategoryControls();
  setupBudgetControls();
  setupGoalControls();
  setupRecurringControls();
  setupBackupControls();
  setupAnalyticsControls();
  setupReportControls();

  if (!document.getElementById("analyticsStartDate")?.value && !document.getElementById("analyticsEndDate")?.value) {
    resetAnalyticsRange();
  }
  if (!document.getElementById("reportMonth")?.value) {
    resetReportMonth();
  }

  const { transactions, recurringTransactions } = getState();
  const ym = currentYearMonth();
  const monthLabel = document.getElementById("monthLabel");
  if (monthLabel) monthLabel.textContent = ym;

  const acctBalances = getAccountBalances(transactions, profile);
  const totalBalance = getTotalBalanceFromAccounts(acctBalances);
  const totalForBars = Math.max(0, Number(totalBalance) || 0);
  const pct = (x) => (totalForBars > 0 ? (Math.max(0, x) / totalForBars) * 100 : 0);

  const pairs = [
    ["balance", formatMoney(totalBalance)],
    ["checkingDisplay", formatMoney(acctBalances.checking)],
    ["savingsDisplay", formatMoney(acctBalances.savings)],
    ["cashDisplay", formatMoney(acctBalances.cash)]
  ];
  pairs.forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = value; });

  const breakdownEl = document.getElementById("balanceBreakdown");
  if (breakdownEl) breakdownEl.textContent = `Checking ${formatMoney(acctBalances.checking)} - Savings ${formatMoney(acctBalances.savings)} - Cash ${formatMoney(acctBalances.cash)}`;
  const barChecking = document.getElementById("barChecking");
  const barSavings = document.getElementById("barSavings");
  const barCash = document.getElementById("barCash");
  if (barChecking) barChecking.style.width = `${Math.round(pct(acctBalances.checking)) || 34}%`;
  if (barSavings) barSavings.style.width = `${Math.round(pct(acctBalances.savings)) || 33}%`;
  if (barCash) barCash.style.width = `${Math.round(pct(acctBalances.cash)) || 33}%`;

  const recentList = document.getElementById("recentList");
  const recentEmpty = document.getElementById("recentEmpty");
  if (recentList && recentEmpty) {
    const recent = [...(transactions || [])].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
    recentList.innerHTML = "";
    recentEmpty.style.display = recent.length ? "none" : "block";
    for (const tx of recent) {
      const li = document.createElement("li");
      const accountLabel = tx.type === "transfer"
        ? `${escapeHtml(tx.fromAccount || "checking")} -> ${escapeHtml(tx.toAccount || "savings")}`
        : escapeHtml(tx.account || "checking");
      const merchantLabel = tx.type === "transfer" ? "" : (tx.merchant ? ` - ${escapeHtml(tx.merchant)}` : "");
      const left = tx.type === "transfer" ? `Transfer - ${accountLabel}` : `${escapeHtml(tx.category || "Other")} - ${accountLabel}${merchantLabel}`;
      li.innerHTML = `<span>${escapeHtml(tx.date)} - ${left}</span><strong>${tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}${formatMoney(tx.amount)}</strong>`;
      recentList.appendChild(li);
    }
  }

  const monthly = getMonthlySummary(transactions, ym, recurringTransactions);
  const totalExpenses = monthly.expense;
  const net = monthly.net;
  const fixedTotal = getRecurringOccurrencesForMonth(recurringTransactions, ym)
    .filter((tx) => tx.type === "expense" && (tx.category === "Fixed" || tx.label))
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const incomeEl = document.getElementById("incomeMonth");
  const expenseEl = document.getElementById("expenseMonth");
  const netEl = document.getElementById("netMonth");
  if (incomeEl) incomeEl.textContent = formatMoney(monthly.income);
  if (expenseEl) expenseEl.textContent = formatMoney(totalExpenses);
  if (netEl) netEl.textContent = formatMoney(net);

  const totalsObj = getCategoryTotals(transactions, ym, recurringTransactions);
  const monthlyIncome = Number(profile?.monthly?.income) || 0;
  const monthlyFixedExpenses = getRecurringFixedExpenses()
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const monthlySurplus = monthlyIncome - monthlyFixedExpenses;
  renderCategorySection();
  renderBudgetSection(totalsObj);
  renderGoalSection(acctBalances, monthlySurplus);
  renderRecurringSection();
  renderTrendSection(transactions, recurringTransactions, ym);
  renderAnalyticsSection(transactions, recurringTransactions);
  renderMonthlyReportSection(transactions, recurringTransactions, acctBalances, monthlySurplus);

  const insightsList = document.getElementById("insightsList");
  const insightsEmpty = document.getElementById("insightsEmpty");
  if (insightsList && insightsEmpty) {
    const insights = [];
    if (monthly.income === 0 && totalExpenses > 0) insights.push(["No income logged this month", "Add an income transaction to see accurate net."]);
    else if (net < 0) insights.push(["You're net negative this month", `Net: ${formatMoney(net)}.`]);
    else insights.push(["You're net positive this month", `Net: ${formatMoney(net)}.`]);
    if (totalExpenses > 0 && fixedTotal > 0) insights.push(["Fixed expenses share", `${Math.round((fixedTotal / totalExpenses) * 100)}% of this month's expenses are fixed or recurring.`]);
    const overBudget = getBudgetSummaries(getState().budgets, totalsObj).filter((item) => item.isOverBudget);
    if (overBudget.length) insights.push(["Budget alert", `${overBudget[0].category} is ${formatMoney(Math.abs(overBudget[0].remaining))} over budget.`]);
    const paused = getRecurringUserTransactions().filter((tx) => tx.active === false).length;
    if (paused > 0) insights.push(["Paused recurring items", `${paused} recurring ${paused === 1 ? "item is" : "items are"} currently paused.`]);

    insightsList.innerHTML = "";
    insightsEmpty.style.display = insights.length ? "none" : "block";
    for (const [title, sub] of insights.slice(0, 4)) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(title)}</span><strong>${escapeHtml(sub)}</strong>`;
      insightsList.appendChild(li);
    }
  }

  const ul = document.getElementById("topCategories");
  const empty = document.getElementById("emptyTopCategories");
  if (!ul || !empty) return;
  const top = Object.entries(totalsObj).sort((a, b) => b[1] - a[1]).slice(0, 5);
  ul.innerHTML = "";
  empty.classList.toggle("hidden", top.length > 0);
  for (const [cat, total] of top) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(cat)}</span><strong>${formatMoney(total)}</strong>`;
    ul.appendChild(li);
  }
}
