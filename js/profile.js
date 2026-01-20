/* =========================
   ATLAS PROFILE / ONBOARDING
   (Works with financialManagerState_v1)
========================= */

const PROFILE_KEY = "atlas_profile";

function $(id) {
  return document.getElementById(id);
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0.00";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function loadProfile() {
  const raw = localStorage.getItem(PROFILE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function showSetup() {
  $("setupView").style.display = "block";
  $("dashboardView").style.display = "none";
}

function showDashboard() {
  $("setupView").style.display = "none";
  $("dashboardView").style.display = "block";
}

function setSetupError(msg) {
  const el = $("setupError");
  if (!el) return;
  if (!msg) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.style.display = "block";
  el.textContent = msg;
}

/* =========================
   FIXED EXPENSE ITEMS
========================= */

function readFixedItems() {
  const rows = [
    { nameId: "fxName1", amtId: "fxAmt1" },
    { nameId: "fxName2", amtId: "fxAmt2" },
    { nameId: "fxName3", amtId: "fxAmt3" }
  ];

  const items = [];

  for (const r of rows) {
    const nameEl = $(r.nameId);
    const amtEl = $(r.amtId);
    if (!nameEl || !amtEl) continue;

    const name = (nameEl.value || "").trim();
    const amtRaw = amtEl.value;

    // Both blank -> skip row
    if (!name && !amtRaw) continue;

    const amount = Number(amtRaw);

    // If they started a row, it must be valid
    if (!name || !Number.isFinite(amount) || amount < 0) {
      setSetupError("Fixed expenses: please enter a name and a valid non-negative amount.");
      return null;
    }

    items.push({ name, amount: Math.round(amount * 100) / 100 });
  }

  return items;
}

function prefillFixedItems(profile) {
  const items = profile?.monthly?.fixedItems || [];
  const slots = [
    { nameId: "fxName1", amtId: "fxAmt1" },
    { nameId: "fxName2", amtId: "fxAmt2" },
    { nameId: "fxName3", amtId: "fxAmt3" }
  ];

  for (let i = 0; i < slots.length; i++) {
    const it = items[i];
    const nameEl = $(slots[i].nameId);
    const amtEl = $(slots[i].amtId);
    if (!nameEl || !amtEl) continue;

    nameEl.value = it?.name ?? "";
    amtEl.value = it?.amount ?? "";
  }
}

function renderFixedList(profile) {
  const fixedList = $("fixedList");
  const fixedEmpty = $("fixedEmpty");
  if (!fixedList || !fixedEmpty) return;

  const items = profile?.monthly?.fixedItems || [];

  fixedList.innerHTML = "";
  if (!items.length) {
    fixedEmpty.style.display = "block";
    return;
  }

  fixedEmpty.style.display = "none";
  for (const it of items) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${it.name}</span><strong>${money(it.amount)}</strong>`;
    fixedList.appendChild(li);
  }
}

/* =========================
   EXISTING LOGIC (UPDATED)
========================= */

function prefillSetupForm(profile) {
  // If profile is null, avoid crashing
  if (!profile) {
    if ($("setupName")) $("setupName").value = "";
    if ($("setupChecking")) $("setupChecking").value = "";
    if ($("setupSavings")) $("setupSavings").value = "";
    if ($("setupCash")) $("setupCash").value = "";
    if ($("setupIncome")) $("setupIncome").value = "";
    prefillFixedItems(null);
    return;
  }

  $("setupName").value = profile?.name ?? "";
  $("setupChecking").value = profile?.balances?.checking ?? "";
  $("setupSavings").value = profile?.balances?.savings ?? "";
  $("setupCash").value = profile?.balances?.cash ?? "";
  $("setupIncome").value = profile?.monthly?.income ?? "";

  // ✅ Prefill fixed items rows
  prefillFixedItems(profile);
}

/**
 * Render profile summary cards + trigger dashboard render.
 */
function renderFromProfile(profile) {
  const name = (profile?.name || "").trim();
  $("welcomeTitle").textContent = name ? `Welcome, ${name}` : "Welcome to Atlas";

  const checking = Number(profile?.balances?.checking) || 0;
  const savings = Number(profile?.balances?.savings) || 0;
  const cash = Number(profile?.balances?.cash) || 0;

  const income = Number(profile?.monthly?.income) || 0;

  // ✅ fixedExpenses is now computed, but still stored on profile
  const fixed = Number(profile?.monthly?.fixedExpenses) || 0;

  const surplus = income - fixed;
  const rate = income > 0 ? Math.max(0, Math.min(1, surplus / income)) : 0;

  $("checkingDisplay").textContent = money(checking);
  $("savingsDisplay").textContent = money(savings);
  $("cashDisplay").textContent = money(cash);
  $("surplusDisplay").textContent = money(surplus);
  $("savingsRateDisplay").textContent = `${Math.round(rate * 100)}%`;

  // Show itemized fixed expenses
  renderFixedList(profile);

  // Call dashboard renderer
  if (typeof initDashboard === "function") {
    initDashboard(profile);
  }
}

function onSetupSubmit(e) {
  e.preventDefault();
  setSetupError("");

  const name = $("setupName").value.trim();

  const checking = Number($("setupChecking").value);
  const savings = Number($("setupSavings").value);
  const cash = Number($("setupCash").value);

  const income = Number($("setupIncome").value);

  // ✅ Read itemized fixed expenses
  const fixedItems = readFixedItems();
  if (fixedItems === null) return;

  // ✅ Compute fixed total automatically
  const fixedExpenses = fixedItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  if (![checking, savings, cash, income].every(Number.isFinite)) {
    setSetupError("Please enter valid numbers in all required fields.");
    return;
  }

  if (checking < 0 || savings < 0 || cash < 0 || income < 0) {
    setSetupError("Numbers can’t be negative for setup.");
    return;
  }

  const profile = {
    name: name || null,
    balances: { checking, savings, cash },
    monthly: {
      income,
      fixedExpenses, // ✅ auto computed
      fixedItems     // ✅ stored list
    },
    createdAt: new Date().toISOString()
  };

  saveProfile(profile);

  showDashboard();
  renderFromProfile(profile);
}

function onEditProfile() {
  const profile = loadProfile();
  if (!profile) {
    showSetup();
    return;
  }
  prefillSetupForm(profile);
  showSetup();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function onResetAtlas() {
  localStorage.removeItem(PROFILE_KEY);

  // OPTIONAL full reset (transactions too). Uncomment if you want:
  // localStorage.removeItem("financialManagerState_v1");

  showSetup();
  prefillSetupForm(null);
  setSetupError("");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("DOMContentLoaded", () => {
  const setupForm = $("setupForm");
  const editBtn = $("editProfileBtn");
  const resetBtn = $("resetAtlasBtn");

  if (setupForm) setupForm.addEventListener("submit", onSetupSubmit);
  if (editBtn) editBtn.addEventListener("click", onEditProfile);
  if (resetBtn) resetBtn.addEventListener("click", onResetAtlas);

  const profile = loadProfile();
  if (!profile) {
    showSetup();
  } else {
    showDashboard();
    renderFromProfile(profile);
  }
});
