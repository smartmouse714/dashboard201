import { fromTemplate, fill } from "./dom-utils.js";
import { LOCAL_INCIDENTS } from "./config.js";

const {
    deltaUrl: DELTA_URL,
    eventsUrl: EVENTS_URL,
    cacheKey: CACHE_KEY,
    checkInterval: CHECK_INTERVAL,
    maxDisplayed: MAX_DISPLAYED_INCIDENTS,
    locations: LOCAL_AREAS,
    eventTypes: EVENT_TYPES
} = LOCAL_INCIDENTS;

let refreshInProgress = false;

/* "frankston" → "Frankston", joined as "Frankston, Knox, or Monash". */
const LOCATION_LABEL = (() => {
    const names = LOCAL_AREAS.map(
        (area) => area.charAt(0).toUpperCase() + area.slice(1)
    );
    if (names.length < 2) return names.join("");
    return `${names.slice(0, -1).join(", ")}, or ${names.at(-1)}`;
})();

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

function isConfiguredType(event) {
    if (!EVENT_TYPES.length) return true;
    if (typeof event.category !== "string") return false;
    const category = event.category.toLocaleLowerCase();
    return EVENT_TYPES.some((type) => category.includes(
        type.toLocaleLowerCase()
    ));
}

function getLocalIncidents(events) {
    return events.filter((event) =>
        isInLocalArea(event) && isConfiguredType(event)
    );
}

function createIncident(event) {
    const item = fromTemplate("local-incident-template");

    fill(item, {
        '[data-field="name"]': event.name,
        '[data-field="meta"]': [event.category, event.status, event.location]
            .filter(Boolean)
            .join(" · ")
    });

    const time = item.querySelector('[data-field="updated"]');
    const when = new Date(event.updatedAt);
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
        return `${prefix} Showing the ${MAX_DISPLAYED_INCIDENTS} newest of ${localEvents.length} incidents in ${LOCATION_LABEL}.`;
    }

    return `${prefix} Showing ${displayedCount} incident${displayedCount === 1 ? "" : "s"} in ${LOCATION_LABEL}.`;
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
        throw new Error("The incident feed endpoint did not return JSON.");
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
                isConfiguredType(event) &&
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
