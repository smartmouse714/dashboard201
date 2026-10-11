import {
    ALERTS_CATALOG,
    CONFIG,
    FirefoxURI,
    GH_CATALOG,
    TeamViewerURL
} from "./config.js";

/**
 * Fetches the latest software version information from the provided URLs and updates the HTML content of the element with ID "latestVersion".       
 */
async function getSoftwareVersion() {
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Application</th>
                    <th>Version</th>
                    <th>Published</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const { title, url } of GH_CATALOG) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const release = await response.json();

            html += `
                <tr>
                    <td>${title}</td>
                    <td>${release.tag_name}</td>
                    <td>${release.published_at.slice(0, 10)}</td>
                </tr>
            `;
        } catch {
            html += `
                <tr>
                    <td>${title}</td>
                    <td colspan="2">Unknown</td>
                </tr>
            `;
        }
    }

    try {
        const response = await fetch(FirefoxURI.url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const release = await response.json();
        html += `
        <tr>
            <td>${FirefoxURI.title}</td>
            <td>${release.LATEST_FIREFOX_VERSION}</td>
            <td>${release.LAST_RELEASE_DATE}</td>
        </tr>
    `;
    } catch {
        html += `
                <tr>
                    <td>${FirefoxURI.title}/td>
                    <td colspan="2">Unknown</td>
                </tr>
            `;
    }

    html += `
            </tbody>
        </table>
    `;
    return html;
}

const VERSION_CACHE_KEY = 'softwareVersionCache';
const VERSION_CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hour

async function loadSoftwareVersion() {
    const el = document.getElementById("latestVersion");
    if (!el) return;

    const cached = localStorage.getItem(VERSION_CACHE_KEY);

    if (cached) {
        const { timestamp, html } = JSON.parse(cached);

        if (Date.now() - timestamp < VERSION_CACHE_DURATION) {
            el.innerHTML = html;
            return;
        }
    }

    const html = await getSoftwareVersion();
    el.innerHTML = html;

    localStorage.setItem(
        VERSION_CACHE_KEY,
        JSON.stringify({
            html,
            timestamp: Date.now()
        })
    );
}

/**
 * TeamViewer
 * @returns 
 */
async function updateTeamViewerStatus() {
    const el = document.getElementById("teamviewerStatus");
    if (!el) return;

    try {
        const response = await fetch(TeamViewerURL);
        const data = await response.json();

        if (!data.incidents || data.incidents.length === 0) {
            el.textContent = "OK";
            el.className = "status-ok";
        } else {
            el.textContent = data.incidents
                .map(i => i.name)
                .join(", ");
            el.className = "status-incident";
        }
    } catch {
        el.textContent = "Status Unknown";
    }
}

/**
 * VIC Earthquakes
 * @returns
 */
async function getEarthquakes() {
    const el = document.getElementById("vicEarthquakeStatus");
    if (!el) return;

    const { eventType, url } = ALERTS_CATALOG;
    // console.log(eventType, url);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const event = "earthquake";
        const earthquakes = data.features
            .filter(feature => feature.properties?.feedType === event)
            .map(feature => ({
                date: feature.properties.created,
                area: feature.properties.location
            }));
        if (earthquakes.length > 0) {
            el.textContent = earthquakes
                .map(eqk => `${eqk.date} - ${eqk.area}`)
                .join('\n');
        } else {
            el.textContent = "No earthquake";
        }
        // console.table(earthquakes);
    } catch {
        el.textContent = `Error: ${eventType}`;
    }
}
// getEarthquakes();

function refreshAllStatuses() {
    updateTeamViewerStatus();

    getEarthquakes();
}

const refresh30minInterval = CONFIG.refreshUnitInterval * 30;

export function startStatus() {
    // Load version once on page load or if cache expired
    loadSoftwareVersion();

    // Refresh statuses immediately
    refreshAllStatuses();

    // Refresh statuses periodically
    setInterval(refreshAllStatuses, refresh30minInterval);
    setInterval(loadSoftwareVersion, VERSION_CACHE_DURATION);
}