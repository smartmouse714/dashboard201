import {
    CONFIG,
    FirefoxURI,
    GH_CATALOG,
    VENDOR_CATALOG
} from "./config.js";
import {
    fromTemplate,
    fill,
    swapRendered
} from "./dom-utils.js";

function createReleaseRow({ title, version = "Unknown", published = "—" }) {
    return fill(fromTemplate("release-row-template"), {
        '[data-field="app"]': title,
        '[data-field="version"]': version,
        '[data-field="published"]': published
    });
}

function createVendorStatus(product, message, cssClass) {
    const fieldset = fromTemplate("vendor-status-template");

    const status = fill(fieldset, {
        '[data-field="product"]': product,
        '[data-field="message"]': message
    });

    status.querySelector('[data-field="message"]').className = cssClass;

    return status;
}

/**
 * Fetch one release source and return plain row data.
 * The `pick` adapter (provided per source in config.js) decouples this
 * fetcher from each API's payload shape. On any failure the row data
 * carries only the title, so the caller renders "Unknown" defaults.
 */
async function fetchRelease({ title, url, pick }) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const [version, published] = pick(await response.json());

        return { title, version, published };
    } catch {
        return { title };
    }
}

function getReleaseData() {
    return Promise.all([...GH_CATALOG, FirefoxURI].map(fetchRelease));
}

const VERSION_CACHE_KEY = "softwareVersionCache";
const VERSION_CACHE_DURATION = 12 * 60 * 60 * 1000;

/* sortable column → row property; unknown values always sink to the bottom */
const SORT_FIELDS = { app: "title", published: "published" };

/* columns that only ever sort one way; any other column toggles on re-click */
const FIXED_DIR = { app: "asc", published: "desc" };

/* catalog order until a column header is used */
let releaseSort = { key: null, dir: "asc" };

function isBlank(value) {
    return value === undefined || value === "" || value === "—";
}

function sortReleases(rows) {
    if (!releaseSort.key) return rows;

    const field = SORT_FIELDS[releaseSort.key];
    const factor = releaseSort.dir === "desc" ? -1 : 1;
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

    return [...rows].sort((a, b) => {
        const [x, y] = [a[field], b[field]];

        if (isBlank(x) || isBlank(y)) {
            return isBlank(x) === isBlank(y) ? 0 : isBlank(x) ? 1 : -1;
        }

        return factor * collator.compare(String(x), String(y));
    });
}

function renderReleaseTable(container, rows) {
    const table = fromTemplate("release-table-template");
    const tbody = table.querySelector("tbody");

    sortReleases(rows).map(createReleaseRow).forEach((row) => tbody.appendChild(row));

    for (const th of table.querySelectorAll("th[data-sort]")) {
        const active = th.dataset.sort === releaseSort.key;

        th.setAttribute(
            "aria-sort",
            active ? (releaseSort.dir === "asc" ? "ascending" : "descending") : "none"
        );

        th.querySelector("button").addEventListener("click", () => {
            const key = th.dataset.sort;

            releaseSort = {
                key,
                /* Application is always A→Z, Published always newest-first;
                   any column without a fixed direction toggles on re-click */
                dir: FIXED_DIR[key]
                    ?? (active && releaseSort.dir === "asc" ? "desc" : "asc")
            };

            renderReleaseTable(container, rows);
        });
    }

    container.replaceChildren(table);
}

async function loadSoftwareVersion() {
    const el = document.getElementById("latestVersion");
    if (!el) return;

    let rows;
    const cached = localStorage.getItem(VERSION_CACHE_KEY);

    if (cached) {
        try {
            const { timestamp, rows: cachedRows } = JSON.parse(cached);

            if (Date.now() - timestamp < VERSION_CACHE_DURATION) {
                rows = cachedRows;
            }
        } catch {
            /* corrupt or legacy cache → refetch below */
        }
    }

    if (!rows) {
        rows = await getReleaseData();

        localStorage.setItem(
            VERSION_CACHE_KEY,
            JSON.stringify({ rows, timestamp: Date.now() })
        );
    }

    renderReleaseTable(el, rows);
}

async function updateVendorStatus() {
    const anchor = document.querySelector(".release-details");
    if (!anchor) return;

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

    swapRendered(
        anchor.parentElement,
        "fieldset.vendor-status",
        fragment,
        (nodes) => anchor.before(nodes)
    );
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
