(function initTransactions() {
  loadState();

  const form = document.getElementById("txForm");
  if (!form) return;

  const titleEl = document.getElementById("txFormTitle");
  const submitBtn = document.getElementById("txSubmitBtn");
  const cancelBtn = document.getElementById("txCancelBtn");
  const errorEl = document.getElementById("txError");
  const editIdEl = document.getElementById("txEditId");

  const typeEl = document.getElementById("txType");
  const amountEl = document.getElementById("txAmount");
  const dateEl = document.getElementById("txDate");
  const categoryEl = document.getElementById("txCategory");
  const accountEl = document.getElementById("txAccount");
  const fromEl = document.getElementById("txFromAccount");
  const toEl = document.getElementById("txToAccount");
  const noteEl = document.getElementById("txNote");

  const searchEl = document.getElementById("txSearch");
  const filterTypeEl = document.getElementById("txFilterType");
  const filterCategoryEl = document.getElementById("txFilterCategory");
  const filterAccountEl = document.getElementById("txFilterAccount");
  const filterStartDateEl = document.getElementById("txFilterStartDate");
  const filterEndDateEl = document.getElementById("txFilterEndDate");
  const clearFiltersBtn = document.getElementById("txClearFiltersBtn");

  const singleWrap = document.getElementById("accountSingleWrap");
  const transferWrap = document.getElementById("accountTransferWrap");

  function setFormError(message) {
    if (!errorEl) return;
    errorEl.textContent = message || "";
    errorEl.style.display = message ? "block" : "none";
  }

  function getCategories() {
    return getAllCategories().filter((category) => category !== "Fixed");
  }

  function fillCategorySelect(selectEl, selectedCategory = "Other", includeAllOption = false) {
    if (!selectEl) return;

    const categories = getCategories();
    const options = [];
    if (includeAllOption) options.push(`<option value="all">All categories</option>`);

    for (const category of categories) {
      const selected = !includeAllOption && category === selectedCategory ? " selected" : "";
      options.push(`<option value="${escapeHtml(category)}"${selected}>${escapeHtml(category)}</option>`);
    }

    selectEl.innerHTML = options.join("");

    if (includeAllOption) {
      selectEl.value = categories.includes(selectedCategory) ? selectedCategory : "all";
    } else {
      selectEl.value = categories.includes(selectedCategory) ? selectedCategory : "Other";
    }
  }

  function isEditing() {
    return Boolean(editIdEl?.value);
  }

  function updateFormMode() {
    const editing = isEditing();
    if (titleEl) titleEl.textContent = editing ? "Edit Transaction" : "Add Transaction";
    if (submitBtn) submitBtn.textContent = editing ? "Save Changes" : "Add Transaction";
    if (cancelBtn) cancelBtn.style.display = editing ? "inline-flex" : "none";
  }

  function updateTypeUI() {
    const type = typeEl?.value || "expense";
    const isTransfer = type === "transfer";

    if (singleWrap) singleWrap.style.display = isTransfer ? "none" : "block";
    if (transferWrap) transferWrap.style.display = isTransfer ? "block" : "none";

    if (categoryEl) {
      categoryEl.disabled = isTransfer;
      if (!isTransfer) {
        fillCategorySelect(categoryEl, categoryEl.value || "Other");
      }
    }

    if (accountEl) accountEl.required = !isTransfer;
    if (fromEl) fromEl.required = isTransfer;
    if (toEl) toEl.required = isTransfer;
  }

  function resetForm() {
    form.reset();
    if (editIdEl) editIdEl.value = "";
    if (typeEl) typeEl.value = "expense";
    fillCategorySelect(categoryEl, "Other");
    if (accountEl) accountEl.value = "checking";
    if (fromEl) fromEl.value = "checking";
    if (toEl) toEl.value = "savings";
    if (dateEl) dateEl.value = todayISO();
    setFormError("");
    updateTypeUI();
    updateFormMode();
  }

  function buildTransactionFromForm(existingId) {
    const type = typeEl?.value || "expense";
    const amount = Math.round((Number(amountEl?.value) || 0) * 100) / 100;
    const date = dateEl?.value || "";
    const note = (noteEl?.value || "").trim();
    const category = categoryEl?.value || "Other";

    if (!date) {
      setFormError("Please choose a transaction date.");
      return null;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Please enter a valid amount greater than 0.");
      return null;
    }

    if (type === "transfer") {
      const fromAccount = fromEl?.value || "checking";
      const toAccount = toEl?.value || "savings";

      if (fromAccount === toAccount) {
        setFormError("Transfers need different From and To accounts.");
        return null;
      }

      return { id: existingId || makeId(), type: "transfer", amount, date, fromAccount, toAccount, note };
    }

    return {
      id: existingId || makeId(),
      type,
      amount,
      date,
      category,
      account: accountEl?.value || "checking",
      note
    };
  }

  function startEditTransaction(tx) {
    if (!tx) return;

    if (editIdEl) editIdEl.value = tx.id;
    if (typeEl) typeEl.value = tx.type;
    fillCategorySelect(categoryEl, tx.category || "Other");
    updateTypeUI();

    if (amountEl) amountEl.value = tx.amount;
    if (dateEl) dateEl.value = tx.date;
    if (noteEl) noteEl.value = tx.note || "";

    if (tx.type === "transfer") {
      if (fromEl) fromEl.value = tx.fromAccount || "checking";
      if (toEl) toEl.value = tx.toAccount || "savings";
    } else {
      if (accountEl) accountEl.value = tx.account || "checking";
    }

    setFormError("");
    updateFormMode();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteTx(id) {
    state.transactions = state.transactions.filter((t) => t.id !== id);
    saveState();

    if (editIdEl?.value === id) {
      resetForm();
    }

    rerender();
  }

  function prettyAccount(account) {
    if (!account) return "Checking";
    const value = String(account).toLowerCase();
    if (value === "checking") return "Checking";
    if (value === "savings") return "Savings";
    if (value === "cash") return "Cash";
    return "Checking";
  }

  function prettyAccountCell(tx) {
    if (tx.type === "transfer") {
      return `${prettyAccount(tx.fromAccount)} -> ${prettyAccount(tx.toAccount)}`;
    }
    return prettyAccount(tx.account);
  }

  function pillClassForType(type) {
    if (type === "income") return "pill income";
    if (type === "expense") return "pill expense";
    return "pill";
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (match) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[match]));
  }

  function populateCategoryFilter() {
    fillCategorySelect(filterCategoryEl, filterCategoryEl?.value || "all", true);
  }

  function clearFilters() {
    if (searchEl) searchEl.value = "";
    if (filterTypeEl) filterTypeEl.value = "all";
    if (filterCategoryEl) filterCategoryEl.value = "all";
    if (filterAccountEl) filterAccountEl.value = "all";
    if (filterStartDateEl) filterStartDateEl.value = "";
    if (filterEndDateEl) filterEndDateEl.value = "";
  }

  function getFilteredTransactions() {
    const search = (searchEl?.value || "").trim().toLowerCase();
    const type = filterTypeEl?.value || "all";
    const category = filterCategoryEl?.value || "all";
    const account = filterAccountEl?.value || "all";
    const startDate = filterStartDateEl?.value || "";
    const endDate = filterEndDateEl?.value || "";

    return [...state.transactions]
      .filter((tx) => {
        if (type !== "all" && tx.type !== type) return false;

        if (category !== "all") {
          const txCategory = tx.type === "transfer" ? "Transfer" : (tx.category || "Other");
          if (txCategory !== category) return false;
        }

        if (account !== "all") {
          if (tx.type === "transfer") {
            const fromAccount = String(tx.fromAccount || "checking").toLowerCase();
            const toAccount = String(tx.toAccount || "savings").toLowerCase();
            if (fromAccount !== account && toAccount !== account) return false;
          } else if (String(tx.account || "checking").toLowerCase() !== account) {
            return false;
          }
        }

        if (startDate && tx.date < startDate) return false;
        if (endDate && tx.date > endDate) return false;

        if (search && !String(tx.note || "").toLowerCase().includes(search)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  function rerender() {
    const tbody = document.getElementById("txTbody");
    const empty = document.getElementById("emptyTx");
    const count = document.getElementById("txCount");
    if (!tbody || !empty || !count) return;

    fillCategorySelect(categoryEl, categoryEl?.value || "Other");
    populateCategoryFilter();

    const txs = getFilteredTransactions();
    const totalCount = state.transactions.length;
    count.textContent = txs.length === totalCount ? `${totalCount} total` : `${txs.length} of ${totalCount} shown`;
    tbody.innerHTML = "";

    if (!txs.length) {
      empty.classList.remove("hidden");
      empty.textContent = totalCount === 0 ? "No transactions yet. Add one above." : "No transactions match your current filters.";
      return;
    }

    empty.classList.add("hidden");
    empty.textContent = "No transactions yet. Add one above.";

    for (const tx of txs) {
      const tr = document.createElement("tr");
      const categoryText = tx.type === "transfer" ? "Transfer" : (tx.category || "Other");

      tr.innerHTML = `
        <td>${tx.date}</td>
        <td><span class="${pillClassForType(tx.type)}">${tx.type}</span></td>
        <td>${categoryText}</td>
        <td>${prettyAccountCell(tx)}</td>
        <td>${tx.note ? escapeHtml(tx.note) : "<span class='muted'>-</span>"}</td>
        <td class="right">${formatMoney(tx.amount)}</td>
        <td class="right">
          <button class="btn secondary" data-edit="${tx.id}" type="button">Edit</button>
          <button class="btn" data-del="${tx.id}" type="button">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll("button[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tx = state.transactions.find((item) => item.id === btn.dataset.edit);
        startEditTransaction(tx);
      });
    });

    tbody.querySelectorAll("button[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => deleteTx(btn.dataset.del));
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setFormError("");

    const existingId = editIdEl?.value || "";
    const nextTx = buildTransactionFromForm(existingId);
    if (!nextTx) return;

    if (existingId) {
      state.transactions = state.transactions.map((tx) => (tx.id === existingId ? nextTx : tx));
    } else {
      state.transactions.push(nextTx);
    }

    saveState();
    resetForm();
    rerender();
  });

  if (typeEl) {
    typeEl.addEventListener("change", () => {
      setFormError("");
      updateTypeUI();
    });
  }

  [searchEl, filterTypeEl, filterCategoryEl, filterAccountEl, filterStartDateEl, filterEndDateEl]
    .filter(Boolean)
    .forEach((el) => {
      el.addEventListener("input", rerender);
      el.addEventListener("change", rerender);
    });

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      clearFilters();
      rerender();
    });
  }

  if (cancelBtn) cancelBtn.addEventListener("click", resetForm);

  resetForm();
  rerender();
})();
