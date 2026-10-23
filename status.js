import {
    CONFIG,
    FirefoxURI,
    GH_CATALOG,
    VENDOR_CATALOG
} from "./config.js";
import { formatTime } from "./date-utils.js";
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
    /* the status class colours the whole box; only the vendor name shows,
       with the detail kept in the accessible name */
    const status = fromTemplate("vendor-status-template");

    status.className = `vendor-status ${cssClass}`;
    status.setAttribute("aria-label", `${product}: ${message}`);

    return fill(status, {
        '[data-field="product"]': product
    });
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

/**
 * Fetch one vendor status source and return plain status data.
 * The `pick` adapter (provided per vendor in config.js) decouples this
 * fetcher from each provider's payload shape. On any failure the data
 * falls back to "Status Unknown".
 */
async function fetchVendorStatus({ product, url, pick }) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const [message, cssClass] = pick(await response.json());

        return { product, message, cssClass };
    } catch {
        return { product, message: "Status Unknown", cssClass: "status-unknown" };
    }
}

function getVendorData() {
    return Promise.all(VENDOR_CATALOG.map(fetchVendorStatus));
}

const VERSION_CACHE_KEY = "softwareVersionCache";
const VERSION_CACHE_DURATION = CONFIG.releaseCheckInterval;

/* mirror the release refresh time into the "Updated" line under Latest Releases */
function renderLastUpdate(timestamp) {
    const el = document.getElementById("lastUpdated");
    if (!el) return;

    const date = new Date(timestamp);

    el.textContent = formatTime(date, CONFIG.myTimezone);
    el.dateTime = date.toISOString();
}

/* sortable column → row property; unknown values always sink to the bottom */
const SORT_FIELDS = { app: "title", published: "published" };

/* columns that only ever sort one way; any other column toggles on re-click */
const FIXED_DIR = { app: "asc", published: "desc" };

/* catalog order until a column header is used */
let releaseSort = { key: "app", dir: "asc" };

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
                renderLastUpdate(timestamp);
            }
        } catch {
            /* corrupt or legacy cache → refetch below */
        }
    }

    if (!rows) {
        rows = await getReleaseData();

        const timestamp = Date.now();
        localStorage.setItem(
            VERSION_CACHE_KEY,
            JSON.stringify({ rows, timestamp })
        );
        renderLastUpdate(timestamp);
    }

    renderReleaseTable(el, rows);
}

async function updateVendorStatus() {
    const anchor = document.querySelector(".release-details");
    if (!anchor) return;

    const fragment = document.createDocumentFragment();

    (await getVendorData())
        .forEach(({ product, message, cssClass }) =>
            fragment.appendChild(createVendorStatus(product, message, cssClass))
        );

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
