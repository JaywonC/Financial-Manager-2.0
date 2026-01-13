const STORAGE_KEY = "financialManagerState_v1";

let state = {
  transactions: []
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.transactions)) {
        state = parsed;
      }
    } catch {
      // ignore corrupted storage
    }
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getState() {
  return state;
}
