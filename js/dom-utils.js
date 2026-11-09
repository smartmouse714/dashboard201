/**
 * Shared DOM helpers for <template>-based rendering.
 */

/** Clone the template's root element by id. */
export function fromTemplate(id) {
    return document.getElementById(id).content.firstElementChild.cloneNode(true);
}

/** Fill elements inside `el` by selector, returning `el` for chaining. */
export function fill(el, values) {
    for (const [selector, value] of Object.entries(values)) {
        el.querySelector(selector).textContent = value;
    }
    return el;
}

/**
 * Remove nodes previously rendered into `scope` (matched by `ownSelector`),
 * then hand `nodes` to `place` for insertion — e.g.
 * `(nodes) => container.append(nodes)` or `(nodes) => anchor.before(nodes)`.
 * Static siblings (nav rows, headings, anchors) are never touched.
 */
export function swapRendered(scope, ownSelector, nodes, place) {
    clearRendered(scope, ownSelector);
    place(nodes);
}

/** Remove previously rendered content from `scope` without inserting anything. */
export function clearRendered(scope, ownSelector) {
    scope.querySelectorAll(ownSelector).forEach((node) => node.remove());
}