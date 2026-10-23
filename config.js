/**
 * Single source of truth
 */
export const CONFIG = {
    myTimezone: "Australia/Melbourne",
    refreshUnitInterval: 60_000, // 1 minute
    releaseCheckInterval: 2 * 60 * 60 * 1000, // 2 hours
    colors: {
        black: "#444",
        white: "#fff"
    }
};

export const TIMEZONES = [
    { label: "Perth", timeZone: "Australia/Perth" },
    { label: "Darwin", timeZone: "Australia/Darwin" },
    { label: "Sydney", timeZone: "Australia/Sydney", dstRule: "AU" },
    { label: "Brisbane", timeZone: "Australia/Brisbane" },
    { label: "Adelaide", timeZone: "Australia/Adelaide" },
    { label: "Auckland", timeZone: "Pacific/Auckland", dstRule: "NZ" },
    { label: "London", timeZone: "Europe/London", dstRule: "UK" },
    { label: "Denver", timeZone: "America/Denver", dstRule: "CA" }
];

/**
 * DST zone → IANA timezone, derived from the TIMEZONES entries that opt in
 * with a dstRule key.
 */
export const DST_ZONES = Object.fromEntries(
    TIMEZONES
        .filter(({ dstRule }) => dstRule)
        .map(({ dstRule, timeZone }) => [dstRule, timeZone])
);

/**
 * DST rules:
 *   NZ  – starts last Sunday of September, ends first Sunday of April
 *   AU  – starts first Sunday of October,  ends first Sunday of April
 *   UK  – starts last Sunday of March,     ends last Sunday of October
 *   CA  – starts second Sunday of March,   ends first Sunday of November
 */
const DST_RULE_DEFS = {
    AU: {
        start: { month: 9, nth: 1, hour: 2 },
        end: { month: 3, nth: 1, hour: 3 }
    },
    CA: {
        start: { month: 2, nth: 2, hour: 2 },
        end: { month: 10, nth: 1, hour: 3 }
    },
    NZ: {
        start: { month: 8, last: true, hour: 2 },
        end: { month: 3, nth: 1, hour: 3 }
    },
    UK: {
        start: { month: 2, last: true, hour: 2 },
        end: { month: 9, last: true, hour: 3 }
    }
};
export const DST_RULES = Object.fromEntries(
    Object.entries(DST_RULE_DEFS).map(([key, rule]) => [
        key,
        {
            zone: DST_ZONES[key],
            ...rule
        }
    ])
);

/**
 * Holiday filters
 */
export const REGIONS = [
    { country: "CA", subdivision: "CA-AB", label: "Calgarians" },
    { country: "GB", subdivision: "GB-ENG", label: "Londoners" },
    { country: "AU", subdivision: "AU-VIC", label: "Melburnians" }
];

export const HolidayAPI_BASE = "https://date.nager.at/api/v3/PublicHolidays";

/**
 * API endpoints.
 * Each source carries a `pick(json)` adapter returning [version, published],
 * so status.js needs only one generic fetch path.
 */
export const FirefoxURI = {
    title: "Mozilla Firefox",
    url: "https://product-details.mozilla.org/1.0/firefox_versions.json",
    pick: (release) => [
        release.LATEST_FIREFOX_VERSION,
        release.LAST_RELEASE_DATE
    ]
};

const repos = {
    "Coreutils for Windows": "microsoft/coreutils",
    "Greenshot": "greenshot/greenshot",
    "PowerShell": "PowerShell/PowerShell",
    "Visual Studio Code": "microsoft/vscode",
    "Windows Terminal": "microsoft/terminal"
};
const ghPick = (release) => [
    release.tag_name,
    release.published_at.slice(0, 10)
];

export const GH_CATALOG = Object.entries(repos).map(([title, repo]) => ({
    title,
    url: `https://api.github.com/repos/${repo}/releases/latest`,
    pick: ghPick
}));
/**
 * Vendor payloads differ per provider, so each entry carries its own
 * `pick` adapter returning [message, cssClass] — the same contract as
 * the release sources above.
 */
const STATUSPAGE_CLASS = {
    none: "status-green",
    minor: "status-amber",
    major: "status-red",
    critical: "status-red"
};

/* TeamViewer publishes an Atlassian Statuspage payload */
const statuspagePick = ({ status }) => [
    status.description,
    STATUSPAGE_CLASS[status.indicator] ?? "status-unknown"
];

/* the proxy collapses maintenance, degraded performance and partial
   outage into a single yellow indicator, so name all three candidates */
const WEBEX_STATES = {
    green: ["Operational", "status-green"],
    yellow: [
        "Under Maintenance / Degraded Performance / Partial Outage",
        "status-amber"
    ],
    red: ["Major Outage", "status-red"]
};

export const VENDOR_CATALOG = [
    {
        product: "TeamViewer",
        url: "https://status.teamviewer.com/api/v2/status.json",
        pick: statuspagePick
    },
    {
        product: "WebEx",
        url: "https://webex-status-proxy.ps4bp.workers.dev/status.json",
        pick: ({ status }) =>
            WEBEX_STATES[status.indicator] ?? ["Status Unknown", "status-unknown"]
    }
];
