import { CONFIG } from "./config.js";

function getTimeZoneDateParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);

    return Object.fromEntries(
        parts
            .filter(({ type }) => ["weekday", "year", "month", "day"].includes(type))
            .map(({ type, value }) => [type, type === "weekday" ? value : Number(value)])
    );
}

export function formatMyDate(date, timeZone = CONFIG.myTimezone) {
    const { weekday, year, month, day } = getTimeZoneDateParts(date, timeZone);
    const dateTime = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    return {
        text: `${weekday}, ${dateTime}`,
        dateTime
    };
}

export function formatTime(date, timeZone) {
    return date.toLocaleTimeString("en-US", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit"
    });
}

export function getCalendarDay(date, timeZone) {
    const { year, month, day } = getTimeZoneDateParts(date, timeZone);

    return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function dayOffsetLabel(referenceZone, targetZone, date = new Date()) {
    const difference =
        getCalendarDay(date, targetZone) - getCalendarDay(date, referenceZone);

    switch (difference) {
        case 1:
            return "Tomorrow";
        case -1:
            return "Yesterday";
        case 0:
            return ""; // Today
        default:
            return null; // Something is wrong
    }
}
