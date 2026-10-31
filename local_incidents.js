import { fromTemplate, fill } from "./dom-utils.js";

const DELTA_URL = "https://vicemergency-proxy.ps4bp.workers.dev/osom-delta.json";
const EVENTS_URL = "https://vicemergency-proxy.ps4bp.workers.dev/events-geojson.json";
const CACHE_KEY = "localIncidentsCache";
const CHECK_INTERVAL = 5 * 60 * 1000;
const MAX_DISPLAYED_INCIDENTS = 5;
const LOCAL_AREAS = ["frankston", "franksont", "monash", "knox"];
let refreshInProgress = false;

function readCache() {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return null;

    try {
        const cache = JSON.parse(stored);
        if (
            typeof cache.lastUpdateTime === "string" &&
            Number.isFinite(Date.parse(cache.lastUpdateTime)) &&
            Array.isArray(cache.events)
        ) {
            return cache;
        }
        console.error("Ignoring invalid local incidents cache.");
    } catch (error) {
        console.error("Unable to read local incidents cache:", error);
    }

    return null;
}

function eventUpdatedAt(properties) {
    const timestamps = [properties.created, properties.updated]
        .map((value) => Date.parse(value))
        .filter(Number.isFinite);

    return timestamps.length ? Math.max(...timestamps) : null;
}

function eventName(properties) {
    return properties.webHeadline || properties.sourceTitle || properties.name ||
        properties.category1 || "Incident";
}

function isInLocalArea(event) {
    if (typeof event.location !== "string") return false;
    const location = event.location.toLocaleLowerCase();
    return LOCAL_AREAS.some((area) => location.includes(area));
}

function getLocalIncidents(events) {
    return events.filter(isInLocalArea);
}

function createIncident(event) {
    const item = fromTemplate("local-incident-template");
    const when = new Date(event.updatedAt);
    const meta = [event.category, event.status, event.location]
        .filter(Boolean)
        .join(" · ");

    fill(item, {
        '[data-field="name"]': event.name,
        '[data-field="meta"]': meta
    });

    const time = item.querySelector('[data-field="updated"]');
    time.dateTime = when.toISOString();
    time.textContent = `Updated ${when.toLocaleString("en-AU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
    })}`;

    return item;
}

function renderIncidents(events) {
    const list = document.getElementById("localIncidentsList");
    const localEvents = getLocalIncidents(events);
    list.replaceChildren(
        ...localEvents.slice(0, MAX_DISPLAYED_INCIDENTS).map(createIncident)
    );
}

function incidentCountMessage(events, prefix) {
    const localEvents = getLocalIncidents(events);
    const displayedCount = Math.min(localEvents.length, MAX_DISPLAYED_INCIDENTS);
    if (localEvents.length > MAX_DISPLAYED_INCIDENTS) {
        return `${prefix} Showing the ${MAX_DISPLAYED_INCIDENTS} newest of ${localEvents.length} incidents in Frankston, Monash, or Knox.`;
    }

    return `${prefix} Showing ${displayedCount} incident${displayedCount === 1 ? "" : "s"} in Frankston, Monash, or Knox.`;
}

function setStatus(message) {
    document.getElementById("localIncidentsStatus").textContent = message;
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Request failed with HTTP ${response.status}`);
    }
    if (!response.headers.get("Content-Type")?.includes("json")) {
        throw new Error("The incident feed endpoint did not return JSON. Deploy the Cloudflare Pages Function.");
    }
    return response.json();
}

async function refreshLocalIncidents() {
    const status = document.getElementById("localIncidentsStatus");
    const list = document.getElementById("localIncidentsList");
    if (!status || !list || refreshInProgress) return;

    refreshInProgress = true;
    try {
        const cache = readCache();
        if (cache) {
            renderIncidents(cache.events);
            setStatus(
                cache.events.length
                    ? incidentCountMessage(cache.events, "While checking for updates.")
                    : "No new or updated incidents are saved yet; checking for updates."
            );
        }

        const delta = await fetchJson(DELTA_URL);
        const deltaTime = Date.parse(delta.lastModified);
        if (!Number.isFinite(deltaTime)) {
            throw new Error("The incident delta response has no valid lastModified time.");
        }

        const previousTime = cache ? Date.parse(cache.lastUpdateTime) : NaN;
        if (cache && deltaTime <= previousTime) {
            renderIncidents(cache.events);
            setStatus(
                cache.events.length
                    ? incidentCountMessage(cache.events, "No newer feed update.")
                    : "No new or updated incidents since the last feed update."
            );
            return;
        }

        const eventsData = await fetchJson(EVENTS_URL);
        if (!Array.isArray(eventsData.features)) {
            throw new Error("The incident events response has no features list.");
        }

        const events = eventsData.features
            .filter((feature) => feature && feature.properties)
            .map(({ properties }) => ({
                name: eventName(properties),
                category: properties.category1,
                status: properties.status,
                location: properties.location,
                updatedAt: eventUpdatedAt(properties)
            }))
            .filter((event) => (
                isInLocalArea(event) &&
                event.updatedAt !== null &&
                (!cache || event.updatedAt > previousTime)
            ))
            .sort((a, b) => b.updatedAt - a.updatedAt);

        const savedEvents = events.map((event) => ({
            ...event,
            updatedAt: new Date(event.updatedAt).toISOString()
        }));
        const newCache = {
            lastUpdateTime: delta.lastModified,
            events: savedEvents
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));

        renderIncidents(savedEvents);
        setStatus(
            cache
                ? (savedEvents.length
                    ? incidentCountMessage(savedEvents, "New or updated since the last check.")
                    : "No new or updated incidents since the last check.")
                : incidentCountMessage(savedEvents, "Current local incidents.")
        );
    } catch (error) {
        console.error("Unable to update local incidents:", error);
        setStatus(`Unable to update local incidents: ${error.message}`);
    } finally {
        refreshInProgress = false;
    }
}

export function startLocalIncidents() {
    refreshLocalIncidents();
    setInterval(refreshLocalIncidents, CHECK_INTERVAL);
}
