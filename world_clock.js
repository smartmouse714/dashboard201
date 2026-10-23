import {
    CONFIG,
    TIMEZONES,
} from "./config.js";

import {
    dayOffsetLabel,
    formatMyDate,
    formatTime
} from "./date-utils.js";

/* day-offset label spans follow the TIMEZONES labels */
const DAY_OFFSETS = TIMEZONES.map(({ label, timeZone }) => ({
    id: `${label}DayOffset`,
    timeZone
}));

const getCity = zone => zone.split("/").at(-1);

const cityElements = new Map();

function cacheElements() {
    for (const { timeZone } of TIMEZONES) {
        const city = getCity(timeZone);
        const element = document.getElementById(`${city}Clock`);

        if (element) {
            cityElements.set(city, element);
        }
    }
}

function drawHand(ctx, angle, length, width, color) {
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.moveTo(0, width);
    ctx.lineTo(0, -length);
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
}

function drawClockFace(ctx, radius) {
    ctx.beginPath();
    ctx.arc(0, 0, radius - 4, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.colors.white;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = CONFIG.colors.black;
    ctx.stroke();
}

function drawClockNumbers(ctx, radius) {
    ctx.font = "bold 16px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = CONFIG.colors.black;

    for (const number of [3, 6, 9, 12]) {
        const angle = (number - 3) * Math.PI / 6;
        ctx.fillText(
            number,
            Math.cos(angle) * (radius - 18),
            Math.sin(angle) * (radius - 18)
        );
    }
}

function drawCenterPin(ctx) {
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.colors.black;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = CONFIG.colors.white;
    ctx.fill();
}

function drawAnalogClock(now) {
    const canvas = document.getElementById("hq-clock");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const radius = canvas.width / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(radius, radius);

    const zoneDate = new Date(
        now.toLocaleString("en-US", { timeZone: CONFIG.myTimezone })
    );

    const seconds = zoneDate.getSeconds() + zoneDate.getMilliseconds() / 1000;
    const minutes = zoneDate.getMinutes() + seconds / 60;
    const hours = (zoneDate.getHours() % 12) + minutes / 60;

    drawClockFace(ctx, radius);
    drawClockNumbers(ctx, radius);
    drawHand(ctx, hours * Math.PI / 6, radius * 0.5, 8, CONFIG.colors.black);
    drawHand(ctx, minutes * Math.PI / 30, radius * 0.8, 5, CONFIG.colors.black);
    drawCenterPin(ctx);

    ctx.restore();
}

function updateDate(now) {
    const currentDate = document.getElementById("currentDate");
    if (!currentDate) return;

    const { text, dateTime } = formatMyDate(now, CONFIG.myTimezone);
    currentDate.textContent = text;
    currentDate.dateTime = dateTime;
}

function updateDayOffsetLabels(now) {
    for (const { id, timeZone } of DAY_OFFSETS) {
        const element = document.getElementById(id);
        if (!element) continue;

        element.textContent = dayOffsetLabel(
            CONFIG.myTimezone,
            timeZone,
            now
        ) ?? '?!';
    }
}

function updateClocks(now) {
    for (const { timeZone } of TIMEZONES) {
        const element = cityElements.get(getCity(timeZone));
        if (!element) continue;

        element.dateTime = now.toISOString();
        element.textContent = formatTime(now, timeZone);
    }

    updateDayOffsetLabels(now);
}

function render(now = new Date()) {
    updateDate(now);
    updateClocks(now);
    drawAnalogClock(now);
}

export function startWorldClock(now = new Date()) {
    cacheElements();
    render(now);
    setInterval(() => render(new Date()), CONFIG.refreshUnitInterval);
}
