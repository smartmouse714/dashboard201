import {
    ALERTS_CATALOG,
    CONFIG,
    FirefoxURI,
    GH_CATALOG,
    VENDOR_CATALOG
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
 * SendGrid, TeamViewer, WebEx
 * @returns 
 */
async function updateVendorStatus() {
    const el = document.getElementById("teamviewerStatus");
    if (!el) return;

    let html = "";
    for (const vendor of VENDOR_CATALOG) {
        switch (vendor.product) {
            case "TeamViewer":
                try {
                    const response = await fetch(vendor.url);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    const data = await response.json();

                    if (!data.incidents || data.incidents.length === 0) {
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
                html += '<fieldset><legend>TeamViewer</legend><span>OK</span></fieldset>';

                break;
            case "WebEx":
                try {
                    const response = await fetch(vendor.url);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    const data = await response.json();
                    let t = "";
                    switch (data.status.indicator) {
                        case "green":
                            t = "Operational";
                            el.className = "status-ok";
                            break;
                        case "yellow":
                            t = "Degraded Performance";
                            el.className = "status-incident";
                            break;
                        case "red":
                            t = "Major Outage";
                            el.className = "status-incident";
                            break;
                    }
                    html += '<fieldset><legend>WebEx</legend><span>' + t + '</span></fieldset>';
                } catch {
                    el.textContent = "Status Unknown";
                }
                console.log(vendor.product, el.className);
                break;
            case "SendGrid":
                try {
                    const response = await fetch(vendor.url);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    const data = await response.json();

                    switch (data.status.indicator) {
                        case "minor":
                            el.className = "status-incident";
                            break;
                        default:
                            el.className = "status-incident";
                    }
                    // el.textContent = data.status.description;
                    html += '<fieldset><legend>SendGrid</legend><span>' + data.status.description + '</span></fieldset>';
                } catch {
                    el.className = "status-unknown";
                }
                // console.log(vendor.product, el.textContent, el.className);
                break;
            default:
                console.log(vendor.product, 'default');
        }
    }
    // html += "</fieldset>";
    console.log(html);
    el.innerHTML = html;
}

/**
 * VIC Events
 * @returns
 */

// 1. Store/retrieve the previous lastModified timestamp earlier in your code
// (Using localStorage here for persistence across runs, or fallback to a default date)
const previousLastModified = localStorage.getItem('previousLastModified') || '1970-01-01T00:00:00.000Z';

async function _updateVicEmergency() {
    const el = document.getElementById("vicEarthquakeStatus");
    if (!el) return;

    const { eventType, od_url, eg_url } = ALERTS_CATALOG;
    try {
        // 2. Fetch the delta file
        let response = await fetch(od_url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        let data = await response.json();
        const currentLastModified = data.lastModified;

        // 3. Set the changed flag to true if the new timestamp is more recent than the stored one
        const isRecentOrNewer = new Date(currentLastModified) > new Date(previousLastModified);
        const changed = isRecentOrNewer; // You can also use: currentLastModified !== previousLastModified

        if (changed) {
            console.log('Changes detected! Fetching full event data...');
            // 4. Fetch the events GeoJSON if changed is true
            response = await fetch(eg_url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            data = await response.json();
            /*
                        const matches = data.features
                            .filter(feature => eventType.includes(feature.properties?.feedType || ""))
                            .sort((a, b) =>
                                new Date(b.properties.updated || b.properties.created) -
                                new Date(a.properties.updated || a.properties.created)
                            );
            */
            let matches = data.features.filter(feature => {
                const p = feature.properties ?? {};
                // console.log(p, p.feedType, p.category2);
                return (
                    eventType.includes((p.feedType || "").toLowerCase()) ||
                    eventType.includes((p.category2 || "").toLowerCase())
                );

            });

            console.log(matches);
            matches = data.features.filter(feature => eventType.includes(feature.properties?.feedType || ""));
            if (matches.length === 0) {
                el.textContent = matches.map(feature => {
                    const properties = feature.properties;
                    const eventType = properties?.feedType || "Unknown";
                    const time = properties?.updated || properties?.created || "";
                    const location = properties?.location || "Unknown location";
                    return `${eventType}, ${time}, ${location}`;
                }).join("\n");
            } else {
                el.textContent = "No current alerts";
            }

            // Process your events data here
            console.log('Events GeoJSON loaded successfully');


            // Update the stored timestamp for future checks
            // localStorage.setItem('previousLastModified', currentLastModified);

        } else {
            console.log('No new updates found. Last modified:', currentLastModified);
        }

    } catch (error) {
        console.error('Failed to fetch emergency data:', error);
    } finally {
        el.textContent = "No current alerts";
    }

}

async function _getAlerts() {
    const el = document.getElementById("vicEarthquakeStatus");
    if (!el) return;

    const { eventType, od_url, eg_url } = ALERTS_CATALOG;
    try {
        let response = await fetch(od_url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        let data = await response.json();

        response = await fetch(eg_url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        data = await response.json();
        const event = "earthquake";
        const earthquakes = data.features
            .filter(feature => feature.properties?.feedType === event)
            .map(feature => ({
                date: feature.properties.created,
                area: feature.properties.location
            }));
        if (earthquakes.length > 0) {
            el.textContent = earthquakes
                .map(row => `${row.date} - ${row.area}`)
                .join('\n');
        } else {
            el.textContent = "No earthquake";
        }
    } catch {
        el.textContent = `Error: ${eventType}`;
    }
}

function refreshAllStatuses() {
    updateVendorStatus();

    // updateVicEmergency();
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