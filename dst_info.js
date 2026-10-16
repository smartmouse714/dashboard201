import {
    CONFIG,
    DST_RULES,
    DST_ZONES
} from "./config.js";

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
            switch (days) {
                case null: {
                    el.textContent = "Something is wrong";
                    break;
                }
                case 0: {
                    el.textContent = "Time change is occurring now";
                    break;
                }
                default: {
                    const meter = document.createElement("meter");
                    meter.min = 0;
                    meter.low = 30;
                    meter.optimum = 90;
                    meter.high = 150;
                    meter.max = 183;
                    meter.value = Number(days);
                    meter.setAttribute("aria-label", "Days until next time change");
                    const v = Number(days);
                    meter.className = v < meter.low ? "meter-critical" : v < meter.optimum ? "meter-warn" : "meter-ok";
                    el.replaceChildren("Countdown ", meter, ` ${days} days`);
                    break;
                }
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

function updateDSTUI({ au, ca, nz, uk }) {
    setDSTLegendState(["LondonClock"], uk.isDST);
    setDSTLegendState(["DenverClock"], ca.isDST);
    setDSTLegendState(["AucklandClock"], nz.isDST);
    setDSTLegendState(["SydneyClock", "AdelaideClock"], au.isDST);

    setChangeText(
        [document.getElementById("ukLastChange")].filter(Boolean),
        uk.lastEvent,
        uk.lastChange,
        DST_ZONES.UK
    );
    setNextText(
        [document.getElementById("ukNextChange")].filter(Boolean),
        uk.nextEvent,
        uk.nextChange,
        DST_ZONES.UK
    );

    setChangeText(
        [document.getElementById("caLastChange")].filter(Boolean),
        ca.lastEvent,
        ca.lastChange,
        DST_ZONES.CA
    );
    setNextText(
        [document.getElementById("caNextChange")].filter(Boolean),
        ca.nextEvent,
        ca.nextChange,
        DST_ZONES.CA
    );

    setChangeText(
        [document.getElementById("nzLastChange")].filter(Boolean),
        nz.lastEvent,
        nz.lastChange,
        DST_ZONES.NZ
    );
    setNextText(
        [document.getElementById("nzNextChange")].filter(Boolean),
        nz.nextEvent,
        nz.nextChange,
        DST_ZONES.NZ
    );

    setChangeText(
        document.querySelectorAll(".auLastChange"),
        au.lastEvent,
        au.lastChange,
        DST_ZONES.AU
    );
    setNextText(
        document.querySelectorAll(".auNextChange"),
        au.nextEvent,
        au.nextChange,
        DST_ZONES.AU
    );
}

export function startDSTInfo(now = new Date()) {
    updateDSTUI(getDSTData(now));
    refreshCountdowns(now);
    setInterval(() => refreshCountdowns(new Date()), CONFIG.refreshUnitInterval);
}
