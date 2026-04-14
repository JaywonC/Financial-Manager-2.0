const STORAGE_KEY = "financialManagerState_v1";
const LEGACY_PROFILE_KEY = "atlas_profile";

function createDefaultState() {
  return {
    transactions: [],
    recurringTransactions: [],
    budgets: [],
    goals: [],
    categories: [],
    migrations: {
      fixedExpensesToRecurring: false
    }
  };
}

let state = createDefaultState();

function getDefaultCategories() {
  return ["Food", "Transport", "Shopping", "School", "Entertainment", "Fixed", "Other"];
}

function normalizeCategoryName(name) {
  const value = String(name || "").trim();
  return value ? value.replace(/\s+/g, " ") : "";
}

function normalizeCategoryItem(name) {
  const value = normalizeCategoryName(name);
  if (!value) return null;
  return value;
}

function normalizeBudgetItem(item) {
  if (!item || typeof item !== "object") return null;

  const amount = Math.round((Number(item.amount) || 0) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 0) return null;

  return {
    id: item.id || makeId(),
    category: String(item.category || "Other").trim() || "Other",
    amount
  };
}

function normalizeGoalItem(item) {
  if (!item || typeof item !== "object") return null;

  const targetAmount = Math.round((Number(item.targetAmount) || 0) * 100) / 100;
  const savedAmount = Math.round((Number(item.savedAmount) || 0) * 100) / 100;
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) return null;
  if (!Number.isFinite(savedAmount) || savedAmount < 0) return null;

  const linkedAccount = String(item.linkedAccount || "none").toLowerCase();
  const normalizedLinkedAccount = ["checking", "savings", "cash"].includes(linkedAccount) ? linkedAccount : "none";

  return {
    id: item.id || makeId(),
    name: String(item.name || "").trim() || "Savings goal",
    targetAmount,
    savedAmount,
    linkedAccount: normalizedLinkedAccount
  };
}

function normalizeRecurringTransaction(tx) {
  if (!tx || typeof tx !== "object") return null;

  const amount = Math.round((Number(tx.amount) || 0) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    id: tx.id || makeId(),
    type: tx.type === "income" ? "income" : "expense",
    amount,
    category: tx.category || "Fixed",
    account: tx.account || "checking",
    note: tx.note || "",
    label: tx.label || tx.note || tx.category || "Recurring transaction",
    active: tx.active !== false,
    startDate: tx.startDate || todayISO(),
    schedule: {
      frequency: "monthly",
      dayOfMonth: Math.min(31, Math.max(1, Number(tx?.schedule?.dayOfMonth) || 1))
    },
    source: tx.source || "user"
  };
}

function readLegacyProfile() {
  const raw = localStorage.getItem(LEGACY_PROFILE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function migrateLegacyFixedExpenses(parsedState) {
  const nextState = {
    ...createDefaultState(),
    ...parsedState,
    transactions: Array.isArray(parsedState?.transactions) ? parsedState.transactions : [],
    recurringTransactions: Array.isArray(parsedState?.recurringTransactions) ? parsedState.recurringTransactions : [],
    budgets: Array.isArray(parsedState?.budgets) ? parsedState.budgets : [],
    goals: Array.isArray(parsedState?.goals) ? parsedState.goals : [],
    categories: Array.isArray(parsedState?.categories) ? parsedState.categories : [],
    migrations: {
      fixedExpensesToRecurring: Boolean(parsedState?.migrations?.fixedExpensesToRecurring)
    }
  };

  nextState.recurringTransactions = nextState.recurringTransactions
    .map(normalizeRecurringTransaction)
    .filter(Boolean);
  nextState.budgets = nextState.budgets
    .map(normalizeBudgetItem)
    .filter(Boolean);
  nextState.goals = nextState.goals
    .map(normalizeGoalItem)
    .filter(Boolean);
  nextState.categories = nextState.categories
    .map(normalizeCategoryItem)
    .filter(Boolean);

  if (nextState.migrations.fixedExpensesToRecurring) {
    return { nextState, changed: false };
  }

  const profile = readLegacyProfile();
  const fixedItems = profile?.monthly?.fixedItems;
  if (!Array.isArray(fixedItems) || fixedItems.length === 0) {
    nextState.migrations.fixedExpensesToRecurring = true;
    return { nextState, changed: true };
  }

  const startDate = profile?.createdAt ? String(profile.createdAt).slice(0, 10) : todayISO();
  const migrated = fixedItems
    .map((item) => normalizeRecurringTransaction({
      type: "expense",
      amount: item?.amount,
      category: "Fixed",
      note: item?.name || "",
      label: item?.name || "Fixed expense",
      account: "checking",
      startDate,
      schedule: { dayOfMonth: 1 },
      source: "profile-fixed-expense"
    }))
    .filter(Boolean);

  nextState.recurringTransactions.push(...migrated);
  nextState.migrations.fixedExpensesToRecurring = true;
  return { nextState, changed: true };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  let parsed = createDefaultState();

  if (saved) {
    try {
      parsed = JSON.parse(saved) || createDefaultState();
    } catch {
      parsed = createDefaultState();
    }
  }

  const { nextState, changed } = migrateLegacyFixedExpenses(parsed);
  state = nextState;

  if (changed || !saved) {
    saveState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getState() {
  return state;
}

function replaceState(nextState) {
  const baseState = createDefaultState();
  const parsedState = {
    ...baseState,
    ...nextState,
    transactions: Array.isArray(nextState?.transactions) ? nextState.transactions : [],
    recurringTransactions: Array.isArray(nextState?.recurringTransactions) ? nextState.recurringTransactions : [],
    budgets: Array.isArray(nextState?.budgets) ? nextState.budgets : [],
    goals: Array.isArray(nextState?.goals) ? nextState.goals : [],
    categories: Array.isArray(nextState?.categories) ? nextState.categories : [],
    migrations: {
      fixedExpensesToRecurring: Boolean(nextState?.migrations?.fixedExpensesToRecurring)
    }
  };

  const { nextState: normalizedState } = migrateLegacyFixedExpenses(parsedState);
  state = normalizedState;
  saveState();
  return state;
}

function setRecurringTransactions(recurringTransactions) {
  state.recurringTransactions = (recurringTransactions || [])
    .map(normalizeRecurringTransaction)
    .filter(Boolean);
  saveState();
}

function setBudgets(budgets) {
  state.budgets = (budgets || [])
    .map(normalizeBudgetItem)
    .filter(Boolean);
  saveState();
}

function setGoals(goals) {
  state.goals = (goals || [])
    .map(normalizeGoalItem)
    .filter(Boolean);
  saveState();
}

function getAllCategories() {
  const transactionCategories = (state.transactions || [])
    .filter((tx) => tx.type !== "transfer")
    .map((tx) => tx.category || "Other");
  const budgetCategories = (state.budgets || []).map((budget) => budget.category || "Other");
  const recurringCategories = (state.recurringTransactions || []).map((tx) => tx.category || "Other");

  return [...new Set(
    getDefaultCategories()
      .concat(state.categories || [])
      .concat(transactionCategories)
      .concat(budgetCategories)
      .concat(recurringCategories)
      .map(normalizeCategoryItem)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

function setCategories(categories) {
  state.categories = [...new Set((categories || [])
    .map(normalizeCategoryItem)
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  saveState();
}

function isDefaultCategory(category) {
  return getDefaultCategories().includes(normalizeCategoryItem(category));
}

function isCategoryInUse(category) {
  const value = normalizeCategoryItem(category);
  if (!value) return false;

  const txUsed = (state.transactions || []).some((tx) => tx.type !== "transfer" && (tx.category || "Other") === value);
  const budgetUsed = (state.budgets || []).some((budget) => (budget.category || "Other") === value);
  const recurringUsed = (state.recurringTransactions || []).some((tx) => (tx.category || "Other") === value);

  return txUsed || budgetUsed || recurringUsed;
}
