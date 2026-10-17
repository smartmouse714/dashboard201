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

/* 0 = current month, negative = past, positive = future (capped at ±12) */
let viewOffset = 0;
const MAX_OFFSET = 12;

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

function getMonthRange(now, offset = 0) {
    const year = now.getFullYear();
    const month = now.getMonth() + offset;

    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    return { first, last, month: first.getMonth() };
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

async function getThisMonthsHolidays(now, offset = 0) {
    const { first, last, month } = getMonthRange(now, offset);
    const start = toDateString(first);
    const end = toDateString(last);
    const year = first.getFullYear();

    const secondTue = secondTuesdayOfMonth(year, month);
    const patchTue = {
        date: toDateString(secondTue),
        name: "Patch Tuesday",
        region: "Geeks"
    };

    const perRegion = await Promise.all(
        REGIONS.map(async (region) => {
            const data = await fetchHolidays(region.country, year);
            return data
                .filter((h) => isRelevant(h, region.subdivision))
                .filter((h) => h.date >= start && h.date <= end)
                .map((h) => ({
                    date: h.date,
                    name: h.localName || h.name,
                    region: region.label
                }));
        })
    );

    const results = [patchTue, ...perRegion.flat()];
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

function esc(s) {
    return s.replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

async function renderHolidays(now) {
    const container = document.getElementById("holidays");
    const list = document.getElementById("holidayList");
    const monthEl = document.getElementById("holidayMonth");
    const prevBtn = document.getElementById("holidayPrev");
    const nextBtn = document.getElementById("holidayNext");
    if (!container || !list || !monthEl) return;

    prevBtn.disabled = viewOffset <= -MAX_OFFSET;
    nextBtn.disabled = viewOffset >= MAX_OFFSET;

    const { first } = getMonthRange(now, viewOffset);
    monthEl.textContent = first.toLocaleDateString("en-CA", {
        month: "long",
        year: "numeric"
    });

    try {
        const holidays = await getThisMonthsHolidays(now, viewOffset);

        if (holidays.length === 0) {
            list.innerHTML = `<div class="holiday-item holiday-empty">No holidays</div>`;
            return;
        }

        const groups = groupByRegion(holidays);
        const hideEmpty = document.getElementById("hideEmptyRegions")?.checked ?? true;

        let html = "";
        for (const [region, items] of groups) {
            if (hideEmpty && items.length === 0) continue;

            html += `<div class="holiday-region-group">
                <div class="holiday-region-name">${esc(region)}</div>`;
            for (const h of items) {
                const d = new Date(h.date + "T00:00:00");
                const label = d.toLocaleDateString("en-CA", {
                    weekday: "short",
                    day: "numeric",
                    month: "short"
                });
                html += `
                    <div class="holiday-item">
                        <strong>${esc(label)}</strong> - <mark>${esc(h.name)}</mark>
                    </div>`;
            }
            html += `</div>`;
        }

        list.innerHTML = html;
    } catch (err) {
        console.error("Holiday fetch failed:", err);
        list.innerHTML = "";
        container.hidden = true;
    }
}

function navigateHolidays(delta) {
    const next = viewOffset + delta;
    if (next < -MAX_OFFSET || next > MAX_OFFSET) return;
    viewOffset = next;
    renderHolidays(new Date());
}

export function startHolidays(now) {
    renderHolidays(now);

    document.getElementById("holidayPrev")
        ?.addEventListener("click", () => navigateHolidays(-1));
    document.getElementById("holidayNext")
        ?.addEventListener("click", () => navigateHolidays(1));

    const toggle = document.getElementById("hideEmptyRegions");
    if (toggle) {
        toggle.addEventListener("change", () => renderHolidays(new Date()));
    }
}
