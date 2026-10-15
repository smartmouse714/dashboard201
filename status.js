import {
    CONFIG,
    FirefoxURI,
    GH_CATALOG,
    VENDOR_CATALOG
} from "./config.js";

function createReleaseRow(title, version, published) {
    const template = document.getElementById("release-row-template");
    const row = template.content.firstElementChild.cloneNode(true);

    row.querySelector(".app-name").textContent = title;
    row.querySelector(".version").textContent = version;
    row.querySelector(".published").textContent = published;

    return row;
}

function createReleaseErrorRow(title) {
    const template = document.getElementById("release-error-row-template");
    const row = template.content.firstElementChild.cloneNode(true);

    row.querySelector(".app-name").textContent = title;

    return row;
}

function createVendorStatus(product, message, cssClass) {
    const template = document.getElementById("vendor-status-template");
    const fieldset = template.content.firstElementChild.cloneNode(true);

    fieldset.querySelector("legend").textContent = product;

    const span = fieldset.querySelector("span");
    span.textContent = message;
    span.className = cssClass;

    return fieldset;
}

async function getSoftwareVersion() {
    const tableTemplate = document.getElementById("release-table-template");
    const table = tableTemplate.content.firstElementChild.cloneNode(true);
    const tbody = table.querySelector("tbody");

    for (const { title, url } of GH_CATALOG) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const release = await response.json();

            tbody.appendChild(
                createReleaseRow(
                    title,
                    release.tag_name,
                    release.published_at.slice(0, 10)
                )
            );
        } catch {
            tbody.appendChild(createReleaseErrorRow(title));
        }
    }

    try {
        const response = await fetch(FirefoxURI.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const release = await response.json();

        tbody.appendChild(
            createReleaseRow(
                FirefoxURI.title,
                release.LATEST_FIREFOX_VERSION,
                release.LAST_RELEASE_DATE
            )
        );
    } catch {
        tbody.appendChild(createReleaseErrorRow(FirefoxURI.title));
    }

    return table;
}

const VERSION_CACHE_KEY = "softwareVersionCache";
const VERSION_CACHE_DURATION = 12 * 60 * 60 * 1000;

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

    const table = await getSoftwareVersion();

    el.replaceChildren(table);

    localStorage.setItem(
        VERSION_CACHE_KEY,
        JSON.stringify({
            html: el.innerHTML,
            timestamp: Date.now()
        })
    );
}

async function updateVendorStatus() {
    const el = document.getElementById("vendorStatus");
    if (!el) return;

    const fragment = document.createDocumentFragment();

    for (const vendor of VENDOR_CATALOG) {
        switch (vendor.product) {
            case "TeamViewer":
                try {
                    const response = await fetch(vendor.url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const data = await response.json();

                    if (!data.incidents || data.incidents.length === 0) {
                        fragment.appendChild(
                            createVendorStatus(vendor.product, "OK", "status-ok")
                        );
                    } else {
                        const incidents = data.incidents.map(i => i.name).join(", ");

                        fragment.appendChild(
                            createVendorStatus(
                                vendor.product,
                                incidents,
                                "status-incident"
                            )
                        );
                    }
                } catch {
                    fragment.appendChild(
                        createVendorStatus(
                            vendor.product,
                            "Status Unknown",
                            "status-unknown"
                        )
                    );
                }
                break;

            case "SendGrid":
                try {
                    const response = await fetch(vendor.url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const data = await response.json();
                    const indicator = data.status.indicator;

                    const statusClass = ["minor", "major", "critical"].includes(indicator)
                        ? "status-incident"
                        : indicator === "none"
                            ? "status-ok"
                            : "status-unknown";

                    fragment.appendChild(
                        createVendorStatus(
                            vendor.product,
                            data.status.description,
                            statusClass
                        )
                    );
                } catch {
                    fragment.appendChild(
                        createVendorStatus(
                            vendor.product,
                            "Status Unknown",
                            "status-unknown"
                        )
                    );
                }
                break;

            default:
                console.log(vendor.product, "default");
        }
    }

    el.replaceChildren(fragment);
}

function refreshAllStatuses() {
    updateVendorStatus();
}

const refresh30minInterval = CONFIG.refreshUnitInterval * 30;

export function startStatus() {
    loadSoftwareVersion();
    refreshAllStatuses();

    setInterval(refreshAllStatuses, refresh30minInterval);
    setInterval(loadSoftwareVersion, VERSION_CACHE_DURATION);
}
