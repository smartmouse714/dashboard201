import { fill, fromTemplate } from "./dom-utils.js";
import { CURRENCY_RATES_URL } from "./config.js";

function formatRate(value) {
    return typeof value === "number" ? value.toFixed(2) : "—";
}

function createCurrencyRow(currency, rates) {
    if (!Array.isArray(rates)) {
        throw new Error(`Invalid rate data for ${currency}`);
    }

    const midValue = rates[4];
    if (typeof midValue !== "number") {
        throw new Error(`Invalid rate data for ${currency}`);
    }

    return fill(fromTemplate("currency-row-template"), {
        '[data-field="currency"]': currency,
        '[data-field="middle"]': formatRate(midValue)
    });
}

async function loadCurrencyRates() {
    const container = document.getElementById("currencyRates");
    if (!container) return;

    try {
        const response = await fetch(CURRENCY_RATES_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("Invalid currency rates response");
        }

        const table = fromTemplate("currency-table-template");
        const tbody = table.querySelector("tbody");

        const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
        for (const [currency, rates] of entries) {
            tbody.appendChild(createCurrencyRow(currency, rates));
        }

        if (!tbody.childElementCount) throw new Error("No currency rates returned");
        container.replaceChildren(table);
    } catch (error) {
        console.error("Unable to load currency rates:", error);
        container.textContent = "Currency rates unavailable.";
    }
}

export function startFX() {
    loadCurrencyRates();
}
