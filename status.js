import {
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
 * SendGrid, TeamViewer
 * @returns 
 */
async function updateVendorStatus() {
    const el = document.getElementById("vendorStatus");
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
                        html += `
                            <fieldset><legend>${vendor.product}</legend><span class="status-ok">OK</span></fieldset>
                        `;
                    } else {
                        const incidents = data.incidents
                            .map(i => i.name)
                            .join(", ");
                        html += `
                            <fieldset><legend>${vendor.product}</legend><span class="status-incident">${incidents}</span></fieldset>
                        `;
                    }
                } catch {
                    html += `
                        <fieldset><legend>${vendor.product}</legend><span class="status-unknown">Status Unknown</span></fieldset>
                    `;
                }
                break;
            case "SendGrid":
                try {
                    const response = await fetch(vendor.url);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    const data = await response.json();
                    const indicator = data.status.indicator;
                    const statusClass = ["minor", "major", "critical"].includes(indicator)
                        ? "status-incident"
                        : indicator === "none"
                            ? "status-ok"
                            : "status-unknown";
                    html += `
                        <fieldset><legend>${vendor.product}</legend><span class="${statusClass}">${data.status.description}</span></fieldset>
                    `;
                } catch {
                    html += `
                        <fieldset><legend>${vendor.product}</legend><span class="status-unknown">Status Unknown</span></fieldset>
                    `;
                }
                break;
            default:
                console.log(vendor.product, 'default');
        }
    }
    el.innerHTML = html;
}

function refreshAllStatuses() {
    updateVendorStatus();
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