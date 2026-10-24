import { fill, fromTemplate } from "./dom-utils.js";
import { CURRENCY_RATES_URL } from "./config.js";

function formatRate(value) {
    return value === null ? "—" : value.toFixed(2);
}

function createCurrencyRow(currency, rates) {
    if (
        !Array.isArray(rates) ||
        rates.length !== 6 ||
        !rates.slice(0, 5).every((rate) => rate === null || typeof rate === "number") ||
        typeof rates[5] !== "string"
    ) {
        throw new Error(`Invalid rate data for ${currency}`);
    }

    return fill(fromTemplate("currency-row-template"), {
        '[data-field="currency"]': currency,

        '[data-field="middle"]': formatRate(rates[4]),
        '[data-field="quoted"]': rates[5]
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

        for (const [currency, rates] of Object.entries(data)) {
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
