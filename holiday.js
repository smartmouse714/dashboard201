/**
 * Show this month's public holidays under the HQ clock.
 * Regions: Canada–Alberta, UK–England, Australia–Victoria.
 * Fetches from Nager.Date API and caches by year+country.
 * If none this month, show nothing.
 */
import {
    HolidayAPI_BASE,
    REGIONS
} from "./config.js";

const cache = new Map();

async function fetchHolidays(country, year) {
    const key = `${country}-${year}`;
    if (cache.has(key)) return cache.get(key);

    const res = await fetch(`${HolidayAPI_BASE}/${year}/${country}`);
    if (!res.ok) throw new Error(`Failed to fetch holidays for ${country} ${year}`);

    const data = await res.json();
    cache.set(key, data);
    return data;
}

function isRelevant(holiday, subdivision) {
    if (holiday.global) return true;
    if (!holiday.counties || holiday.counties.length === 0) return true;
    return subdivision && holiday.counties.includes(subdivision);
}

function getMonthRange(now) {
    const year = now.getFullYear();
    const month = now.getMonth();

    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    return { first, last, month };
}

function toDateString(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function secondTuesdayOfMonth(year, month) {
    const first = new Date(year, month, 1);
    const offset = (2 - first.getDay() + 7) % 7;
    const secondTue = 1 + offset + 7;
    return new Date(year, month, secondTue);
}

async function getThisMonthsHolidays(now) {
    const { first, last, month } = getMonthRange(now);
    const start = toDateString(first);
    const end = toDateString(last);
    const year = first.getFullYear();

    const results = [];

    const secondTue = secondTuesdayOfMonth(year, month);
    results.push({
        date: toDateString(secondTue),
        name: "Patch Tuesday",
        region: "Geeks"
    });

    for (const region of REGIONS) {
        const data = await fetchHolidays(region.country, year);
        for (const h of data) {
            if (!isRelevant(h, region.subdivision)) continue;
            if (h.date < start || h.date > end) continue;

            results.push({
                date: h.date,
                name: h.localName || h.name,
                region: region.label
            });
        }
    }

    results.sort((a, b) => a.date.localeCompare(b.date) || a.region.localeCompare(b.region));
    return results;
}

function groupByRegion(holidays) {
    const groups = new Map();
    for (const h of holidays) {
        if (!groups.has(h.region)) groups.set(h.region, []);
        groups.get(h.region).push(h);
    }
    return groups;
}

async function renderHolidays(now) {
    const container = document.getElementById("holidays");
    if (!container) return;

    try {
        const holidays = await getThisMonthsHolidays(now);

        if (holidays.length === 0) {
            container.textContent = "";
            container.hidden = true;
            return;
        }

        const groups = groupByRegion(holidays);
        const hideEmpty = document.getElementById("hideEmptyRegions")?.checked ?? true;

        let html = "";
        for (const [region, items] of groups) {
            if (hideEmpty && items.length === 0) continue;

            html += `<div class="holiday-region-group">
                <div class="holiday-region-name">${region}</div>`;
            for (const h of items) {
                const d = new Date(h.date + "T00:00:00");
                const label = d.toLocaleDateString("en-CA", {
                    weekday: "short",
                    day: "numeric",
                    month: "short"
                });
                html += `
                    <div class="holiday-item">
                        <strong>${label}</strong> - <mark>${h.name}</mark>
                    </div>`;
            }
            html += `</div>`;
        }

        container.hidden = false;
        container.innerHTML = html;
    } catch (err) {
        console.error("Holiday fetch failed:", err);
        container.hidden = true;
    }
}

export function startHolidays(now) {
    renderHolidays(now);
    const toggle = document.getElementById("hideEmptyRegions");
    if (toggle) {
        toggle.addEventListener("change", renderHolidays);
    }
}
