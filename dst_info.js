import {
    CONFIG,
    DST_RULES,
    DST_ZONES
} from "./config.js";
import { fromTemplate } from "./dom-utils.js";

function getTimeZoneOffset(timestamp, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hourCycle: "h23"
    }).formatToParts(timestamp);

    const values = Object.fromEntries(
        parts.map(({ type, value }) => [type, Number(value)])
    );
    const localTimestamp = Date.UTC(
        values.year,
        values.month - 1,
        values.day,
        values.hour,
        values.minute,
        values.second
    );

    return localTimestamp - Math.floor(timestamp / 1000) * 1000;
}

/**
 * year → e.g. 2026
 * month → 0-based month (0 = Jan, 11 = Dec)
 * hour → hour of day (defaults to 2)
 * nth → which Sunday (defaults to 1 for first Sunday)
 * last → if true, use the last Sunday in the month (defaults to false)
 * timeZone → IANA timezone like "Australia/Melbourne"
 */
function createSundayDate(year, { month, hour = 2, nth = 1, last = false }, timeZone) {
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
    const lastDayOfMonth = new Date(firstDayOfMonth);
    lastDayOfMonth.setUTCMonth(month + 1, 0);
    const day = last
        ? lastDayOfMonth.getUTCDate() - lastDayOfMonth.getUTCDay()           // Last Sunday
        : 1 + ((7 - firstDayOfMonth.getUTCDay()) % 7) + (nth === 2 ? 7 : 0); // First or second Sunday
    const wallTime = Date.UTC(year, month, day, hour);
    const offsetBeforeTransition = getTimeZoneOffset(
        wallTime - 24 * 60 * 60 * 1000,
        timeZone
    );

    return new Date(wallTime - offsetBeforeTransition - 1);
}

function getYearInTimezone(date, timeZone) {
    const year = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric"
    }).formatToParts(date).find(({ type }) => type === "year")?.value;

    return Number(year);
}

function getDSTDetails(startRule, endRule, timeZone, now, southern = false) {
    const year = getYearInTimezone(now, timeZone);

    const startThisYear = createSundayDate(year, startRule, timeZone);
    const endThisYear = createSundayDate(year, endRule, timeZone);

    if (southern) {
        if (now >= startThisYear) {
            return {
                isDST: true,
                lastChange: startThisYear,
                lastEvent: "start",
                nextChange: createSundayDate(year + 1, endRule, timeZone),
                nextEvent: "end"
            };
        }
        if (now < endThisYear) {
            return {
                isDST: true,
                lastChange: createSundayDate(year - 1, startRule, timeZone),
                lastEvent: "start",
                nextChange: endThisYear,
                nextEvent: "end"
            };
        }
        return {
            isDST: false,
            lastChange: endThisYear,
            lastEvent: "end",
            nextChange: startThisYear,
            nextEvent: "start"
        };
    }

    if (now >= startThisYear && now < endThisYear) {
        return {
            isDST: true,
            lastChange: startThisYear,
            lastEvent: "start",
            nextChange: endThisYear,
            nextEvent: "end"
        };
    }
    if (now < startThisYear) {
        return {
            isDST: false,
            lastChange: createSundayDate(year - 1, endRule, timeZone),
            lastEvent: "end",
            nextChange: startThisYear,
            nextEvent: "start"
        };
    }

    return {
        isDST: false,
        lastChange: endThisYear,
        lastEvent: "end",
        nextChange: createSundayDate(year + 1, startRule, timeZone),
        nextEvent: "start"
    };
}

function getDSTData(now) {
    return {
        nz: getDSTDetails(DST_RULES.NZ.start, DST_RULES.NZ.end, DST_ZONES.NZ, now, true),
        au: getDSTDetails(DST_RULES.AU.start, DST_RULES.AU.end, DST_ZONES.AU, now, true),
        uk: getDSTDetails(DST_RULES.UK.start, DST_RULES.UK.end, DST_ZONES.UK, now),
        ca: getDSTDetails(DST_RULES.CA.start, DST_RULES.CA.end, DST_ZONES.CA, now)
    };
}

function formatDate(date, timeZone) {
    return date.toLocaleString("en-US", {
        timeZone,
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function countdownDays(diff) {
    if (diff < 0) return null;
    return (diff / (1000 * 60 * 60 * 24)).toFixed(2);
}

function createCountdownMeter(days) {
    const meter = fromTemplate("countdown-meter-template");
    const v = Number(days);

    meter.value = v;
    meter.className = v < meter.low ? "meter-critical" : v < meter.optimum ? "meter-warn" : "meter-ok";

    return meter;
}

function refreshCountdowns(now = new Date()) {
    const { au, ca, nz, uk } = getDSTData(now);
    const targets = [
        { nextChange: ca.nextChange, selector: ".caCountdown" },
        { nextChange: uk.nextChange, selector: ".ukCountdown" },
        { nextChange: nz.nextChange, selector: ".nzCountdown" },
        { nextChange: au.nextChange, selector: ".au1Countdown" },
        { nextChange: au.nextChange, selector: ".au2Countdown" }
    ];

    for (const { nextChange, selector } of targets) {
        const days = countdownDays(nextChange - now);

        document.querySelectorAll(selector).forEach(el => {
            if (days === null) {
                el.textContent = "Something is wrong";
            } else if (Number(days) === 0) {
                el.textContent = "Time change is occurring now";
            } else {
                el.replaceChildren("Countdown ", createCountdownMeter(days), ` ${days} days`);
            }
        });
    }
}

function setDSTLegendState(clockIds, isDST) {
    for (const id of clockIds) {
        document.getElementById(id)
            ?.closest("fieldset")
            ?.classList.toggle("dst-active", isDST);
    }
}

function setChangeText(elements, event, date, timeZone) {
    const text = `DST ${event}ed after ${formatDate(date, timeZone)}`;
    elements.forEach(el => {
        el.textContent = text;
    });
}

function setNextText(elements, event, date, timeZone) {
    const text = `and will ${event} after ${formatDate(date, timeZone)}`;
    elements.forEach(el => {
        el.textContent = text;
    });
}

/* zone id → where its change text lives and which zone formats the dates */
const DST_TEXT_ZONES = [
    { id: "uk", last: "#ukLastChange", next: "#ukNextChange", zone: DST_ZONES.UK },
    { id: "ca", last: "#caLastChange", next: "#caNextChange", zone: DST_ZONES.CA },
    { id: "nz", last: "#nzLastChange", next: "#nzNextChange", zone: DST_ZONES.NZ },
    { id: "au", last: ".auLastChange", next: ".auNextChange", zone: DST_ZONES.AU }
];

function updateDSTUI(details) {
    setDSTLegendState(["LondonClock"], details.uk.isDST);
    setDSTLegendState(["DenverClock"], details.ca.isDST);
    setDSTLegendState(["AucklandClock"], details.nz.isDST);
    setDSTLegendState(["SydneyClock", "AdelaideClock"], details.au.isDST);

    for (const { id, last, next, zone } of DST_TEXT_ZONES) {
        const { lastEvent, lastChange, nextEvent, nextChange } = details[id];

        setChangeText(document.querySelectorAll(last), lastEvent, lastChange, zone);
        setNextText(document.querySelectorAll(next), nextEvent, nextChange, zone);
    }
}

export function startDSTInfo(now = new Date()) {
    updateDSTUI(getDSTData(now));
    refreshCountdowns(now);
    setInterval(() => refreshCountdowns(new Date()), CONFIG.refreshUnitInterval);
}
