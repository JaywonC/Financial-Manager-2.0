(function initTransactions() {
  loadState();

  // Default date to today
  const dateInput = document.getElementById("txDate");
  if (dateInput) dateInput.value = todayISO();

  const form = document.getElementById("txForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const type = document.getElementById("txType").value;
    const amount = Number(document.getElementById("txAmount").value);
    const date = document.getElementById("txDate").value;
    const category = document.getElementById("txCategory").value;
    const note = document.getElementById("txNote").value.trim();

    if (!date || !Number.isFinite(amount) || amount <= 0) return;

    const tx = {
      id: makeId(),
      type,
      amount: Math.round(amount * 100) / 100,
      date,
      category,
      note
    };

    state.transactions.push(tx);
    saveState();
    form.reset();

    // Keep date defaulted and category/type reasonable
    document.getElementById("txType").value = "expense";
    document.getElementById("txCategory").value = "Other";
    document.getElementById("txDate").value = todayISO();

    rerender();
  });

  function deleteTx(id) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveState();
    rerender();
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
      const pillClass = t.type === "income" ? "pill income" : "pill expense";

      tr.innerHTML = `
        <td>${t.date}</td>
        <td><span class="${pillClass}">${t.type}</span></td>
        <td>${t.category || "Other"}</td>
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
