/**
 * Single source of truth
 */
export const CONFIG = {
    myTimezone: "Australia/Melbourne",
    refreshUnitInterval: 60_000, // 1 minute
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
DST_ZONES = {
    AU: "Australia/Sydney",
    CA: "America/Denver",
    NZ: "Pacific/Auckland",
    UK: "Europe/London"
};
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
/**
DST_RULES = {
    AU: {
        zone: DST_ZONES.AU,
        start: FIRST_SUN(9, 2),
        end: FIRST_SUN(3, 3)
    },
    CA: {
        zone: DST_ZONES.CA,
        start: SECOND_SUN(2, 2),
        end: FIRST_SUN(10, 3)
    },
    NZ: {
        zone: DST_ZONES.NZ,
        start: LAST_SUN(8, 2),
        end: FIRST_SUN(3, 3)
    },
    UK: {
        zone: DST_ZONES.UK,
        start: LAST_SUN(2, 2),
        end: LAST_SUN(9, 3)
    }
};
 */
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
 * API endpoints
 */
export const FirefoxURI = {
    title: "Mozilla Firefox",
    url: "https://product-details.mozilla.org/1.0/firefox_versions.json"
};

const repos = {
    "Coreutils for Windows": "microsoft/coreutils",
    "Deno": "denoland/deno",
    "Notepad++": "notepad-plus-plus/notepad-plus-plus",
    "PowerShell": "PowerShell/PowerShell",
    "Windows Terminal": "microsoft/terminal"
};
/**
GH_CATALOG = [
    {
        title: "Coreutils for Windows",
        url: "https://api.github.com/repos/microsoft/coreutils/releases/latest"
    },
    {
        title: "Deno",
        url: "https://api.github.com/repos/denoland/deno/releases/latest"
    },
    {
        title: "Notepad++",
        url: "https://api.github.com/repos/notepad-plus-plus/notepad-plus-plus/releases/latest"
    },
    {
        title: "PowerShell",
        url: "https://api.github.com/repos/PowerShell/PowerShell/releases/latest"
    },
    {
        title: "Windows Terminal",
        url: "https://api.github.com/repos/microsoft/terminal/releases/latest"
    }
];
 */
export const GH_CATALOG = Object.entries(repos).map(([title, repo]) => ({
    title,
    url: `https://api.github.com/repos/${repo}/releases/latest`
}));
export const ALERTS_CATALOG = {
    eventType: "VicEarthquakes",
    url: "https://emergency.vic.gov.au/public/events-geojson.json"
}
export const TeamViewerURL = "https://status.teamviewer.com/api/v2/summary.json";
