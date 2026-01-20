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

function prefillSetupForm(profile) {
  $("setupName").value = profile?.name ?? "";
  $("setupChecking").value = profile?.balances?.checking ?? "";
  $("setupSavings").value = profile?.balances?.savings ?? "";
  $("setupCash").value = profile?.balances?.cash ?? "";
  $("setupIncome").value = profile?.monthly?.income ?? "";
  $("setupFixedExpenses").value = profile?.monthly?.fixedExpenses ?? "";
}

/**
 * Render profile summary cards + trigger your existing dashboard render.
 */
function renderFromProfile(profile) {
  const name = (profile?.name || "").trim();
  $("welcomeTitle").textContent = name ? `Welcome, ${name}` : "Welcome to Atlas";

  const checking = Number(profile?.balances?.checking) || 0;
  const savings = Number(profile?.balances?.savings) || 0;
  const income = Number(profile?.monthly?.income) || 0;
  const fixed = Number(profile?.monthly?.fixedExpenses) || 0;
  const cash = Number(profile?.balances?.cash) || 0;
  const surplus = income - fixed;
  const rate = income > 0 ? Math.max(0, Math.min(1, surplus / income)) : 0;

  $("checkingDisplay").textContent = money(checking);
  $("savingsDisplay").textContent = money(savings);
  $("cashDisplay").textContent = money(cash);
  $("surplusDisplay").textContent = money(surplus);
  $("savingsRateDisplay").textContent = `${Math.round(rate * 100)}%`;

  // ✅ Call your dashboard renderer (we will modify it to accept profile)
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
  const income = Number($("setupIncome").value);
  const fixedExpenses = Number($("setupFixedExpenses").value);
  const cash = Number($("setupCash").value);

  if (![checking, savings, cash, income, fixedExpenses].every(Number.isFinite)) {
    setSetupError("Please enter valid numbers in all required fields.");
  return;
  }

  if (checking < 0 || savings < 0 || cash < 0 || income < 0 || fixedExpenses < 0) {
    setSetupError("Numbers can’t be negative for setup.");
    return;
  }


  const profile = {
    name: name || null,
    balances: { checking, savings, cash },
    monthly: { income, fixedExpenses },
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
  // remove profile only
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
