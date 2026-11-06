const STORAGE_KEY = "personalExpenseTrackerTransactions";
const THEME_KEY = "personalExpenseTrackerTheme";

const categories = {
    income: ["Salary", "Freelance", "Business Income", "Scholarship", "Gift", "Other Income"],
    expense: ["Food & Groceries", "Transport", "Education", "Housing & Rent", "Utilities", "Health", "Shopping", "Entertainment", "Personal Care", "Other Expense"]
};

const form = document.getElementById("transactionForm");
const dateInput = document.getElementById("date");
const descriptionInput = document.getElementById("description");
const typeInput = document.getElementById("type");
const categoryInput = document.getElementById("category");
const amountInput = document.getElementById("amount");
const filterInput = document.getElementById("filter");
const transactionList = document.getElementById("transactionList");
const emptyMessage = document.getElementById("emptyMessage");
const message = document.getElementById("message");
const themeToggle = document.getElementById("themeToggle");

let transactions = loadTransactions();
let editingId = null;

// ---------- THEME: DARK / LIGHT MODE ----------
function applyTheme(theme) {
    const isLight = theme === "light";
    document.body.classList.toggle("light-mode", isLight);
    themeToggle.textContent = isLight ? "🌙 Dark Mode" : "☀️ Light Mode";
    themeToggle.setAttribute(
        "aria-label",
        isLight ? "Switch to dark mode" : "Switch to light mode"
    );
    document.documentElement.style.colorScheme = isLight ? "light" : "dark";
}

function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    return savedTheme === "light" ? "light" : "dark";
}

let currentTheme = loadTheme();
applyTheme(currentTheme);

themeToggle.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    try {
        localStorage.setItem(THEME_KEY, currentTheme);
    } catch (error) {
        console.warn("Theme preference could not be saved.", error);
    }
    applyTheme(currentTheme);
});

// ---------- TRANSACTION FUNCTIONS ----------
function todayString() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}

function formatMoney(amount) {
    return new Intl.NumberFormat("en-LK", {
        style: "currency",
        currency: "LKR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function loadTransactions() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) throw new Error("Stored data is not a list.");

        return parsed.filter(item =>
            item &&
            typeof item.id === "string" &&
            typeof item.description === "string" &&
            ["income", "expense"].includes(item.type) &&
            typeof item.amount === "number" &&
            Number.isFinite(item.amount) &&
            item.amount > 0 &&
            typeof item.date === "string" &&
            typeof item.category === "string"
        );
    } catch (error) {
        console.error("Could not load saved transactions:", error);
        return [];
    }
}

function saveTransactions() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
        return true;
    } catch (error) {
        message.textContent = "Could not save data. Check your browser storage settings.";
        console.error("Could not save transactions:", error);
        return false;
    }
}

function updateCategories(selected = "") {
    const options = categories[typeInput.value];
    categoryInput.replaceChildren();

    options.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categoryInput.appendChild(option);
    });

    if (options.includes(selected)) categoryInput.value = selected;
}

function resetForm() {
    form.reset();
    dateInput.value = todayString();
    typeInput.value = "expense";
    updateCategories();
    editingId = null;
    document.getElementById("formTitle").textContent = "Add a Transaction";
    document.getElementById("saveButton").textContent = "Save Transaction";
    message.textContent = "";
}

function render() {
    const totalIncome = transactions
        .filter(item => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0);

    const totalExpenses = transactions
        .filter(item => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0);

    document.getElementById("balance").textContent = formatMoney(totalIncome - totalExpenses);
    document.getElementById("totalIncome").textContent = formatMoney(totalIncome);
    document.getElementById("totalExpenses").textContent = formatMoney(totalExpenses);

    const filter = filterInput.value;
    const visible = transactions
        .filter(item => filter === "all" || item.type === filter)
        .sort((a, b) => b.date.localeCompare(a.date));

    transactionList.replaceChildren();
    emptyMessage.style.display = visible.length ? "none" : "block";

    visible.forEach(item => {
        const row = document.createElement("tr");
        const values = [item.date, item.description, item.type, item.category];

        values.forEach((value, index) => {
            const cell = document.createElement("td");

            if (index === 2) {
                const badge = document.createElement("span");
                badge.className = "badge " + item.type;
                badge.textContent = item.type === "income" ? "Income" : "Expense";
                cell.appendChild(badge);
            } else {
                cell.textContent = value;
            }

            row.appendChild(cell);
        });

        const amountCell = document.createElement("td");
        amountCell.className = "amount-cell " + item.type;
        amountCell.textContent =
            (item.type === "income" ? "+" : "−") + formatMoney(item.amount);
        row.appendChild(amountCell);

        const actionCell = document.createElement("td");
        const actions = document.createElement("div");
        actions.className = "actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "edit";
        editButton.textContent = "Edit";
        editButton.setAttribute("aria-label", "Edit " + item.description);
        editButton.addEventListener("click", () => editTransaction(item.id));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute("aria-label", "Delete " + item.description);
        deleteButton.addEventListener("click", () => deleteTransaction(item.id));

        actions.append(editButton, deleteButton);
        actionCell.appendChild(actions);
        row.appendChild(actionCell);
        transactionList.appendChild(row);
    });
}

form.addEventListener("submit", event => {
    event.preventDefault();
    message.textContent = "";

    const description = descriptionInput.value.trim();
    const amount = Number(amountInput.value);
    const date = dateInput.value;
    const type = typeInput.value;
    const category = categoryInput.value;

    if (!description) {
        message.textContent = "Please enter a description.";
        descriptionInput.focus();
        return;
    }

    if (!date || Number.isNaN(Date.parse(date))) {
        message.textContent = "Please choose a valid date.";
        dateInput.focus();
        return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        message.textContent = "Enter an amount greater than zero.";
        amountInput.focus();
        return;
    }

    if (!categories[type] || !categories[type].includes(category)) {
        message.textContent = "Please choose a valid category.";
        categoryInput.focus();
        return;
    }

    const previous = editingId === null
        ? null
        : transactions.find(item => item.id === editingId);

    const record = {
        id: editingId ?? (
            window.crypto && crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()) + Math.random()
        ),
        date,
        description,
        type,
        category,
        amount,
        createdAt: previous ? previous.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const oldTransactions = transactions.slice();

    if (editingId !== null) {
        transactions = transactions.map(item =>
            item.id === editingId ? record : item
        );
    } else {
        transactions.push(record);
    }

    const wasEditing = editingId !== null;

    if (!saveTransactions()) {
        transactions = oldTransactions;
        render();
        return;
    }

    resetForm();
    render();
    message.textContent = wasEditing
        ? "Transaction updated."
        : "Transaction saved.";
});

function editTransaction(id) {
    const item = transactions.find(transaction => transaction.id === id);
    if (!item) return;

    editingId = id;
    dateInput.value = item.date;
    descriptionInput.value = item.description;
    typeInput.value = item.type;
    updateCategories(item.category);
    amountInput.value = item.amount;

    document.getElementById("formTitle").textContent = "Edit Transaction";
    document.getElementById("saveButton").textContent = "Update Transaction";
    message.textContent = "";
    descriptionInput.focus();
}

function deleteTransaction(id) {
    const item = transactions.find(transaction => transaction.id === id);
    if (!item) return;

    if (!confirm("Delete this transaction? This action cannot be undone unless you have a backup.")) {
        return;
    }

    const oldTransactions = transactions.slice();
    transactions = transactions.filter(transaction => transaction.id !== id);

    if (!saveTransactions()) {
        transactions = oldTransactions;
        render();
        return;
    }

    if (editingId === id) resetForm();
    render();
}

// ---------- EVENT LISTENERS ----------
typeInput.addEventListener("change", () => updateCategories());
filterInput.addEventListener("change", render);
document.getElementById("clearButton").addEventListener("click", resetForm);

// ---------- INITIALIZE APP ----------
updateCategories();
resetForm();
render();