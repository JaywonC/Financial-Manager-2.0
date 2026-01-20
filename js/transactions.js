(function initTransactions() {
  loadState();

  // Default date to today
  const dateInput = document.getElementById("txDate");
  if (dateInput) dateInput.value = todayISO();

  const form = document.getElementById("txForm");

  // NEW UI elements
  const typeEl = document.getElementById("txType");

  const singleWrap = document.getElementById("accountSingleWrap");      // account for income/expense
  const transferWrap = document.getElementById("accountTransferWrap");  // from/to for transfer

  const accountEl = document.getElementById("txAccount");
  const fromEl = document.getElementById("txFromAccount");
  const toEl = document.getElementById("txToAccount");

  const catEl = document.getElementById("txCategory");

  function updateTypeUI() {
    const type = typeEl?.value || "expense";
    const isTransfer = type === "transfer";

    // show/hide account selectors
    if (singleWrap) singleWrap.style.display = isTransfer ? "none" : "block";
    if (transferWrap) transferWrap.style.display = isTransfer ? "block" : "none";

    // transfers shouldn't force a "category" meaningfully (keep it, but optional UX)
    if (catEl) {
      catEl.disabled = isTransfer;            // optional: disable category for transfer
      if (isTransfer) catEl.value = "Other";  // keep clean
    }

    // ensure required fields are correct
    if (accountEl) accountEl.required = !isTransfer;
    if (fromEl) fromEl.required = isTransfer;
    if (toEl) toEl.required = isTransfer;
  }

  if (typeEl) {
    typeEl.addEventListener("change", updateTypeUI);
    updateTypeUI(); // run once on load
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const type = document.getElementById("txType").value;
    const amount = Number(document.getElementById("txAmount").value);
    const date = document.getElementById("txDate").value;
    const note = document.getElementById("txNote").value.trim();

    // category only matters for income/expense
    const category = document.getElementById("txCategory")?.value || "Other";

    if (!date || !Number.isFinite(amount) || amount <= 0) return;

    // ✅ Build transaction depending on type
    let tx;

    if (type === "transfer") {
      const fromAccount = fromEl?.value || "checking";
      const toAccount = toEl?.value || "savings";

      // basic validation
      if (fromAccount === toAccount) return;

      tx = {
        id: makeId(),
        type: "transfer",
        amount: Math.round(amount * 100) / 100,
        date,
        fromAccount,
        toAccount,
        note
      };
    } else {
      // income/expense uses a single account
      const account = accountEl?.value || "checking";

      tx = {
        id: makeId(),
        type,
        amount: Math.round(amount * 100) / 100,
        date,
        category,
        account,
        note
      };
    }

    state.transactions.push(tx);
    saveState();
    form.reset();

    // Keep date defaulted and defaults reasonable
    document.getElementById("txType").value = "expense";
    if (document.getElementById("txCategory")) {
      document.getElementById("txCategory").value = "Other";
      document.getElementById("txCategory").disabled = false;
    }
    if (accountEl) accountEl.value = "checking";
    if (fromEl) fromEl.value = "checking";
    if (toEl) toEl.value = "savings";
    document.getElementById("txDate").value = todayISO();

    updateTypeUI();
    rerender();
  });

  function deleteTx(id) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveState();
    rerender();
  }

  function prettyAccount(a) {
    if (!a) return "Checking";
    const x = String(a).toLowerCase();
    if (x === "checking") return "Checking";
    if (x === "savings") return "Savings";
    if (x === "cash") return "Cash";
    return "Checking";
  }

  function prettyAccountCell(t) {
    // For transfers show "From → To"
    if (t.type === "transfer") {
      return `${prettyAccount(t.fromAccount)} → ${prettyAccount(t.toAccount)}`;
    }
    // For income/expense show single account
    return prettyAccount(t.account);
  }

  function pillClassForType(type) {
    if (type === "income") return "pill income";
    if (type === "expense") return "pill expense";
    if (type === "transfer") return "pill"; // neutral
    return "pill";
  }

  function rerender() {
    const tbody = document.getElementById("txTbody");
    const empty = document.getElementById("emptyTx");
    const count = document.getElementById("txCount");

    const txs = [...state.transactions].sort((a, b) => (a.date < b.date ? 1 : -1));

    count.textContent = `${txs.length} total`;
    tbody.innerHTML = "";

    if (txs.length === 0) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    for (const t of txs) {
      const tr = document.createElement("tr");
      const pillClass = pillClassForType(t.type);

      // category: for transfers show "Transfer"
      const catText = t.type === "transfer" ? "Transfer" : (t.category || "Other");

      tr.innerHTML = `
        <td>${t.date}</td>
        <td><span class="${pillClass}">${t.type}</span></td>
        <td>${catText}</td>
        <td>${prettyAccountCell(t)}</td>
        <td>${t.note ? escapeHtml(t.note) : "<span class='muted'>—</span>"}</td>
        <td class="right">${formatMoney(t.amount)}</td>
        <td class="right"><button class="btn" data-del="${t.id}" type="button">Delete</button></td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll("button[data-del]").forEach(btn => {
      btn.addEventListener("click", () => deleteTx(btn.dataset.del));
    });
  }

  // small helper to prevent HTML injection in notes
  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  }

  rerender();
})();
