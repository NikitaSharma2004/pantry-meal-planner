const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Global Data
let recipes = [];
let weeklyPlan = JSON.parse(localStorage.getItem("pantry_weekly_plan")) || {
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
};

// Seed default pantry data with future dates
let pantry = JSON.parse(localStorage.getItem("pantry_items"));

if (!pantry || pantry.length === 0) {
    const d1 = new Date();
    d1.setDate(d1.getDate() + 10); // 10 days later -> Fresh
    const d2 = new Date();
    d2.setDate(d2.getDate() + 1);  // Tomorrow -> Expiring Soon

    pantry = [
        { id: "p1", item: "Tomato", qty: 4, unit: "pcs", expiry: d1.toISOString().split("T")[0] },
        { id: "p2", item: "Milk", qty: 500, unit: "ml", expiry: d2.toISOString().split("T")[0] }
    ];
}

// Initialization
document.addEventListener("DOMContentLoaded", async () => {
    await fetchRecipes();
    renderRecipeCards(recipes);
    renderPlannerGrid();
    renderPantryList();
    recalculateShoppingList();
    setupListeners();
});

// Load recipes
async function fetchRecipes() {
    try {
        const res = await fetch("recipes.json");
        if (!res.ok) throw new Error("JSON not found");
        recipes = await res.json();
    } catch (err) {
        console.warn("Falling back to local starter recipes");
        recipes = [
            { id: "r1", name: "Paneer Butter Masala", tag: "Rich Curry", time: "30 mins", servings: 2, ingredients: [{ item: "Paneer", qty: 200, unit: "g" }, { item: "Tomato", qty: 3, unit: "pcs" }, { item: "Butter", qty: 40, unit: "g" }] },
            { id: "r2", name: "Classic Tomato Pasta", tag: "Italian", time: "20 mins", servings: 2, ingredients: [{ item: "Pasta", qty: 180, unit: "g" }, { item: "Tomato", qty: 4, unit: "pcs" }, { item: "Cheese", qty: 50, unit: "g" }] },
            { id: "r3", name: "Oatmeal Banana Bowl", tag: "Breakfast", time: "10 mins", servings: 1, ingredients: [{ item: "Oats", qty: 60, unit: "g" }, { item: "Milk", qty: 250, unit: "ml" }, { item: "Banana", qty: 1, unit: "pcs" }] },
            { id: "r4", name: "Veg Fried Rice", tag: "Quick Dinner", time: "25 mins", servings: 2, ingredients: [{ item: "Rice", qty: 200, unit: "g" }, { item: "Carrot", qty: 2, unit: "pcs" }] },
            { id: "r5", name: "Greek Salad Bowl", tag: "Protein", time: "12 mins", servings: 1, ingredients: [{ item: "Cucumber", qty: 2, unit: "pcs" }, { item: "Tomato", qty: 2, unit: "pcs" }, { item: "Paneer", qty: 100, unit: "g" }] },
            { id: "r6", name: "Masala Dal Tadka", tag: "Comfort", time: "35 mins", servings: 3, ingredients: [{ item: "Yellow Dal", qty: 150, unit: "g" }, { item: "Tomato", qty: 2, unit: "pcs" }, { item: "Butter", qty: 30, unit: "g" }] },
            { id: "r7", name: "Grilled Cheese Sandwich", tag: "Snack", time: "10 mins", servings: 1, ingredients: [{ item: "Bread", qty: 4, unit: "pcs" }, { item: "Cheese", qty: 60, unit: "g" }, { item: "Butter", qty: 20, unit: "g" }] }
        ];
    }
    document.getElementById("recipeCount").innerText = `${recipes.length} recipes`;
}

// 1. Render Recipes
function renderRecipeCards(list) {
    const container = document.getElementById("recipeList");
    container.innerHTML = "";

    list.forEach(r => {
        const ingPreview = r.ingredients.map(i => `${i.qty}${i.unit} ${i.item}`).join(", ");
        const el = document.createElement("div");
        el.className = "recipe-card";
        el.draggable = true;
        el.dataset.id = r.id;

        el.innerHTML = `
      <div class="recipe-top">
        <h4>${r.name}</h4>
      </div>
      <div class="recipe-meta">
        <span class="tag-badge">${r.tag}</span>
        <span class="time-text">⏱️ ${r.time || "20 mins"}</span>
      </div>
      <div class="recipe-preview">${ingPreview}</div>
    `;

        el.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", r.id);
        });

        container.appendChild(el);
    });
}

// 2. Render Planner Grid
function renderPlannerGrid() {
    const grid = document.getElementById("plannerGrid");
    grid.innerHTML = "";

    DAYS.forEach(day => {
        const slot = document.createElement("div");
        slot.className = "day-dropzone";
        slot.dataset.day = day;

        slot.innerHTML = `
      <div class="day-header">${day}</div>
      <div class="day-items-list" id="day-list-${day}"></div>
    `;

        slot.addEventListener("dragover", (e) => {
            e.preventDefault();
            slot.classList.add("over");
        });

        slot.addEventListener("dragleave", () => slot.classList.remove("over"));

        slot.addEventListener("drop", (e) => {
            e.preventDefault();
            slot.classList.remove("over");
            const recipeId = e.dataTransfer.getData("text/plain");
            assignRecipeToDay(day, recipeId);
        });

        grid.appendChild(slot);
        renderDayItems(day);
    });
}

function renderDayItems(day) {
    const listEl = document.getElementById(`day-list-${day}`);
    if (!listEl) return;
    listEl.innerHTML = "";

    weeklyPlan[day].forEach((recipe, index) => {
        const div = document.createElement("div");
        div.className = "dropped-card";
        div.innerHTML = `
      <span>${recipe.name}</span>
      <button class="delete-x" onclick="removeRecipeFromDay('${day}', ${index})">✕</button>
    `;
        listEl.appendChild(div);
    });
}

function assignRecipeToDay(day, recipeId) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;
    weeklyPlan[day].push(recipe);
    saveState();
    renderDayItems(day);
    recalculateShoppingList();
}

window.removeRecipeFromDay = function (day, index) {
    weeklyPlan[day].splice(index, 1);
    saveState();
    renderDayItems(day);
    recalculateShoppingList();
};

// 3. Expiry Status Logic (Fixed & Accurate)
function calculateExpiryStatus(expiryDateStr) {
    if (!expiryDateStr) {
        return { text: "Fresh", class: "status-fresh" };
    }

    // Parse YYYY-MM-DD
    const parts = expiryDateStr.split("-");
    const expYear = parseInt(parts[0], 10);
    const expMonth = parseInt(parts[1], 10) - 1;
    const expDay = parseInt(parts[2], 10);

    const expDate = new Date(expYear, expMonth, expDay);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const oneDay = 1000 * 60 * 60 * 24;
    const diffDays = Math.round((expDate.getTime() - today.getTime()) / oneDay);

    if (diffDays < 0) {
        return { text: "Expired", class: "status-expired" };
    } else if (diffDays <= 2) {
        return { text: "Expiring Soon", class: "status-soon" };
    } else {
        return { text: "Fresh", class: "status-fresh" };
    }
}

// 4. Render Pantry List
function renderPantryList() {
    const list = document.getElementById("pantryList");
    list.innerHTML = "";

    let soonCount = 0;

    pantry.forEach((item, index) => {
        const status = calculateExpiryStatus(item.expiry);
        if (status.class === "status-soon") soonCount++;

        const li = document.createElement("li");
        li.className = "list-row";
        li.innerHTML = `
      <div>
        <strong>${item.item}</strong> 
        <span style="color:#64748b;">(${item.qty} ${item.unit})</span>
        <span class="status-badge ${status.class}">${status.text}</span>
      </div>
      <button class="delete-x" onclick="removePantryItem(${index})">✕</button>
    `;
        list.appendChild(li);
    });

    document.getElementById("statExpiring").innerText = soonCount;
}

window.removePantryItem = function (index) {
    pantry.splice(index, 1);
    saveState();
    renderPantryList();
    recalculateShoppingList();
};

// 5. Smart Shopping Consolidation Logic
function recalculateShoppingList() {
    const container = document.getElementById("shoppingList");
    container.innerHTML = "";

    let totalMeals = 0;
    const aggregatedNeeded = {};

    DAYS.forEach(day => {
        weeklyPlan[day].forEach(recipe => {
            totalMeals++;
            recipe.ingredients.forEach(ing => {
                const key = ing.item.toLowerCase().trim();
                if (!aggregatedNeeded[key]) {
                    aggregatedNeeded[key] = { name: ing.item, qty: 0, unit: ing.unit };
                }
                aggregatedNeeded[key].qty += Number(ing.qty);
            });
        });
    });

    document.getElementById("statMeals").innerText = totalMeals;

    const finalCart = [];

    Object.keys(aggregatedNeeded).forEach(key => {
        const needed = aggregatedNeeded[key];
        const match = pantry.find(p => p.item.toLowerCase().trim() === key);
        const inStock = match ? Number(match.qty) : 0;
        const required = needed.qty - inStock;

        if (required > 0) {
            finalCart.push({
                name: needed.name,
                qty: required,
                unit: needed.unit,
                inStock: inStock
            });
        }
    });

    if (finalCart.length === 0) {
        container.innerHTML = `<li style="font-size:0.8rem; color:#64748b; padding:10px;">${totalMeals === 0 ? "Drag recipes into the week to build list." : "All ingredients covered by your pantry!"}</li>`;
        return;
    }

    finalCart.forEach(item => {
        const li = document.createElement("li");
        li.className = "shopping-item";
        li.innerHTML = `
      <input type="checkbox" id="item-${item.name}">
      <label for="item-${item.name}">
        <strong>${item.name}</strong>: ${item.qty} ${item.unit}
        ${item.inStock > 0 ? `<span style="font-size:0.75rem; color:#64748b;">(Pantry has ${item.inStock}${item.unit})</span>` : ""}
      </label>
    `;
        container.appendChild(li);
    });
}

// 6. Persistence & Events
function saveState() {
    localStorage.setItem("pantry_weekly_plan", JSON.stringify(weeklyPlan));
    localStorage.setItem("pantry_items", JSON.stringify(pantry));
}

function setupListeners() {
    // Search
    document.getElementById("recipeSearch").addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = recipes.filter(r =>
            r.name.toLowerCase().includes(q) ||
            r.tag.toLowerCase().includes(q) ||
            r.ingredients.some(ing => ing.item.toLowerCase().includes(q))
        );
        renderRecipeCards(filtered);
    });

    // Pantry Add
    document.getElementById("pantryForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const item = document.getElementById("pantryItem").value.trim();
        const qty = parseFloat(document.getElementById("pantryQty").value);
        const unit = document.getElementById("pantryUnit").value.trim();
        let expiry = document.getElementById("pantryExpiry").value;

        if (!expiry) {
            const def = new Date();
            def.setDate(def.getDate() + 7);
            expiry = def.toISOString().split("T")[0];
        }

        pantry.push({ id: Date.now().toString(), item, qty, unit, expiry });
        saveState();
        renderPantryList();
        recalculateShoppingList();
        e.target.reset();
    });

    // Reset Plan
    document.getElementById("clearPlanBtn").addEventListener("click", () => {
        if (confirm("Reset this week's scheduled meals?")) {
            DAYS.forEach(d => weeklyPlan[d] = []);
            saveState();
            renderPlannerGrid();
            recalculateShoppingList();
        }
    });

    // Copy to Clipboard
    document.getElementById("copyBtn").addEventListener("click", () => {
        const listItems = Array.from(document.querySelectorAll("#shoppingList label")).map(l => "• " + l.innerText);
        if (listItems.length === 0) {
            alert("Shopping list is currently empty.");
            return;
        }
        const message = "🛒 Weekly Grocery List:\n" + listItems.join("\n");
        navigator.clipboard.writeText(message).then(() => {
            alert("Grocery list copied to clipboard!");
        });
    });
}