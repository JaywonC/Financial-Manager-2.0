const STORAGE_KEY = "financialManagerState_v1";
const LEGACY_PROFILE_KEY = "atlas_profile";

function createDefaultState() {
  return {
    transactions: [],
    recurringTransactions: [],
    budgets: [],
    migrations: {
      fixedExpensesToRecurring: false
    }
  };
}

let state = createDefaultState();

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
