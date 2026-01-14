/**
 * CSS Property Computation
 * Computes final CSS property values with inheritance, initial values,
 * and value resolution (converting specified values to computed values).
 */

import type { ComputedStyle } from "../../../types/css.ts";

/**
 * ComputedStyle implementation
 */
class ComputedStyleImpl implements ComputedStyle {
    properties: Map<string, string> = new Map();

    getPropertyValue(property: string): string {
        return this.properties.get(property) || "";
    }

    setProperty(property: string, value: string): void {
        this.properties.set(property, value);
    }

    removeProperty(property: string): void {
        this.properties.delete(property);
    }

    getPropertyNames(): string[] {
        return Array.from(this.properties.keys());
    }
}

/**
 * CSS properties that inherit by default
 */
const INHERITED_PROPERTIES = new Set([
    // Text
    "color",
    "font-family",
    "font-size",
    "font-style",
    "font-variant",
    "font-weight",
    "font",
    "letter-spacing",
    "line-height",
    "text-align",
    "text-indent",
    "text-transform",
    "white-space",
    "word-spacing",

    // Lists
    "list-style",
    "list-style-image",
    "list-style-position",
    "list-style-type",

    // Cursor
    "cursor",

    // Visibility (partially)
    "visibility",

    // Quotes
    "quotes",

    // Direction
    "direction",
]);

/**
 * Default initial values for CSS properties
 */
const INITIAL_VALUES: Map<string, string> = new Map([
    // Display & Box Model
    ["display", "inline"],
    ["position", "static"],
    ["top", "auto"],
    ["right", "auto"],
    ["bottom", "auto"],
    ["left", "auto"],
    ["width", "auto"],
    ["height", "auto"],
    ["min-width", "0"],
    ["min-height", "0"],
    ["max-width", "none"],
    ["max-height", "none"],
    ["margin-top", "0"],
    ["margin-right", "0"],
    ["margin-bottom", "0"],
    ["margin-left", "0"],
    ["padding-top", "0"],
    ["padding-right", "0"],
    ["padding-bottom", "0"],
    ["padding-left", "0"],
    ["border-width", "medium"],
    ["border-style", "none"],
    ["border-color", "currentColor"],

    // Text
    ["color", "black"],
    ["font-family", "serif"],
    ["font-size", "medium"],
    ["font-style", "normal"],
    ["font-variant", "normal"],
    ["font-weight", "normal"],
    ["line-height", "normal"],
    ["text-align", "start"],
    ["text-decoration", "none"],
    ["text-indent", "0"],
    ["text-transform", "none"],
    ["letter-spacing", "normal"],
    ["word-spacing", "normal"],
    ["white-space", "normal"],

    // Background
    ["background-color", "transparent"],
    ["background-image", "none"],
    ["background-position", "0% 0%"],
    ["background-repeat", "repeat"],
    ["background-attachment", "scroll"],

    // Visibility
    ["visibility", "visible"],
    ["opacity", "1"],
    ["overflow", "visible"],
    ["overflow-x", "visible"],
    ["overflow-y", "visible"],

    // Flexbox
    ["flex-direction", "row"],
    ["flex-wrap", "nowrap"],
    ["justify-content", "flex-start"],
    ["align-items", "stretch"],
    ["align-content", "stretch"],
    ["flex-grow", "0"],
    ["flex-shrink", "1"],
    ["flex-basis", "auto"],
    ["order", "0"],

    // Grid
    ["grid-template-columns", "none"],
    ["grid-template-rows", "none"],
    ["grid-auto-columns", "auto"],
    ["grid-auto-rows", "auto"],
    ["grid-auto-flow", "row"],
    ["gap", "0"],

    // Other
    ["z-index", "auto"],
    ["cursor", "auto"],
    ["float", "none"],
    ["clear", "none"],
]);

/**
 * Shorthand properties and their longhand components
 */
const SHORTHAND_PROPERTIES: Map<string, string[]> = new Map([
    ["margin", ["margin-top", "margin-right", "margin-bottom", "margin-left"]],
    ["padding", ["padding-top", "padding-right", "padding-bottom", "padding-left"]],
    ["border", ["border-width", "border-style", "border-color"]],
    ["border-width", [
        "border-top-width",
        "border-right-width",
        "border-bottom-width",
        "border-left-width",
    ]],
    ["border-style", [
        "border-top-style",
        "border-right-style",
        "border-bottom-style",
        "border-left-style",
    ]],
    ["border-color", [
        "border-top-color",
        "border-right-color",
        "border-bottom-color",
        "border-left-color",
    ]],
    ["font", [
        "font-style",
        "font-variant",
        "font-weight",
        "font-size",
        "line-height",
        "font-family",
    ]],
    ["background", [
        "background-color",
        "background-image",
        "background-repeat",
        "background-attachment",
        "background-position",
    ]],
    ["flex", ["flex-grow", "flex-shrink", "flex-basis"]],
    ["gap", ["row-gap", "column-gap"]],
]);

/**
 * Compute CSS properties with inheritance and initial values
 *
 * @param declared - Declared property values from matched rules (Map or array of declarations)
 * @param parent - Parent element's computed style (for inheritance)
 * @returns Computed style with all properties resolved
 */
export function computeProperties(
    declared: Map<string, string> | Array<{ property: string; value: string; important: boolean }>,
    parent: ComputedStyle | null,
): ComputedStyle {
    const computed = new ComputedStyleImpl();

    // Convert array format to Map if necessary
    let declaredMap: Map<string, string>;
    if (Array.isArray(declared)) {
        declaredMap = new Map();
        for (const decl of declared) {
            declaredMap.set(decl.property, decl.value);
        }
    } else {
        declaredMap = declared;
    }

    // Expand shorthand properties first
    const expanded = expandShorthands(declaredMap);

    // Process each property
    for (const [property, value] of expanded.entries()) {
        const computedValue = computePropertyValue(property, value, parent);
        computed.setProperty(property, computedValue);
    }

    // Inherit properties from parent
    if (parent) {
        for (const property of INHERITED_PROPERTIES) {
            if (!computed.properties.has(property)) {
                const parentValue = parent.getPropertyValue(property);
                if (parentValue) {
                    computed.setProperty(property, parentValue);
                } else {
                    // Use initial value if parent doesn't have it
                    const initialValue = INITIAL_VALUES.get(property) || "";
                    computed.setProperty(property, initialValue);
                }
            }
        }
    } else {
        // Root element - set inherited properties to initial values
        for (const property of INHERITED_PROPERTIES) {
            if (!computed.properties.has(property)) {
                const initialValue = INITIAL_VALUES.get(property) || "";
                computed.setProperty(property, initialValue);
            }
        }
    }

    // Set initial values for non-inherited properties that weren't declared
    for (const [property, initialValue] of INITIAL_VALUES.entries()) {
        if (!computed.properties.has(property) && !INHERITED_PROPERTIES.has(property)) {
            computed.setProperty(property, initialValue);
        }
    }

    return computed;
}

/**
 * Expand shorthand properties to longhand
 *
 * @param properties - Property map with potential shorthands
 * @returns Expanded property map
 */
function expandShorthands(properties: Map<string, string>): Map<string, string> {
    const expanded = new Map<string, string>();

    for (const [property, value] of properties.entries()) {
        const longhandProps = SHORTHAND_PROPERTIES.get(property);

        if (longhandProps) {
            // Expand shorthand
            const longhandValues = expandShorthand(property, value, longhandProps);
            for (const [longhand, longhandValue] of longhandValues.entries()) {
                expanded.set(longhand, longhandValue);
            }
            // Also keep the original shorthand property
            expanded.set(property, value);
        } else {
            // Regular property
            expanded.set(property, value);
        }
    }

    return expanded;
}

/**
 * Expand a single shorthand property
 *
 * @param shorthand - Shorthand property name
 * @param value - Shorthand value
 * @param longhandProps - Longhand property names
 * @returns Map of longhand properties to values
 */
function expandShorthand(
    shorthand: string,
    value: string,
    longhandProps: string[],
): Map<string, string> {
    const result = new Map<string, string>();

    // Handle 4-value shorthands (margin, padding, border-width, etc.)
    if (["margin", "padding", "border-width", "border-style", "border-color"].includes(shorthand)) {
        const values = value.trim().split(/\s+/);

        if (values.length === 1) {
            // All sides
            for (const prop of longhandProps) {
                result.set(prop, values[0]);
            }
        } else if (values.length === 2) {
            // Vertical | Horizontal
            result.set(longhandProps[0], values[0]); // top
            result.set(longhandProps[1], values[1]); // right
            result.set(longhandProps[2], values[0]); // bottom
            result.set(longhandProps[3], values[1]); // left
        } else if (values.length === 3) {
            // Top | Horizontal | Bottom
            result.set(longhandProps[0], values[0]); // top
            result.set(longhandProps[1], values[1]); // right
            result.set(longhandProps[2], values[2]); // bottom
            result.set(longhandProps[3], values[1]); // left
        } else if (values.length >= 4) {
            // Top | Right | Bottom | Left
            result.set(longhandProps[0], values[0]);
            result.set(longhandProps[1], values[1]);
            result.set(longhandProps[2], values[2]);
            result.set(longhandProps[3], values[3]);
        }
    } else {
        // For other shorthands, just set all longhand properties to the full value
        // Proper parsing would be more complex
        for (const prop of longhandProps) {
            result.set(prop, value);
        }
    }

    return result;
}

/**
 * Compute a single property value
 *
 * @param property - Property name
 * @param value - Specified value
 * @param parent - Parent computed style
 * @returns Computed value
 */
function computePropertyValue(
    property: string,
    value: string,
    parent: ComputedStyle | null,
): string {
    // Handle CSS-wide keywords
    if (value === "inherit") {
        if (parent) {
            return parent.getPropertyValue(property) || INITIAL_VALUES.get(property) || "";
        }
        return INITIAL_VALUES.get(property) || "";
    }

    if (value === "initial") {
        return INITIAL_VALUES.get(property) || "";
    }

    if (value === "unset") {
        if (INHERITED_PROPERTIES.has(property)) {
            // Acts like inherit for inherited properties
            if (parent) {
                return parent.getPropertyValue(property) || INITIAL_VALUES.get(property) || "";
            }
        }
        // Acts like initial for non-inherited properties
        return INITIAL_VALUES.get(property) || "";
    }

    // Handle relative units - convert to absolute
    // For now, we'll do basic conversions (a real implementation would need context like viewport size, parent font size)
    value = resolveRelativeUnits(property, value, parent);

    // Handle currentColor
    if (value === "currentColor" || value === "currentcolor") {
        if (property !== "color") {
            return parent?.getPropertyValue("color") || "black";
        }
    }

    // Return as-is (already computed)
    return value;
}

/**
 * Resolve relative units to absolute values
 *
 * @param property - Property name
 * @param value - Value with potential relative units
 * @param parent - Parent computed style
 * @returns Value with resolved units
 */
function resolveRelativeUnits(
    property: string,
    value: string,
    parent: ComputedStyle | null,
): string {
    // Handle percentage values
    if (value.endsWith("%")) {
        // Percentages need context (parent size, viewport size, etc.)
        // For now, return as-is
        return value;
    }

    // Handle em units (relative to font-size)
    if (value.match(/[\d.]+em\b/)) {
        const numMatch = value.match(/([\d.]+)em/);
        if (numMatch) {
            const emValue = parseFloat(numMatch[1]);
            const parentFontSize = parent?.getPropertyValue("font-size") || "16px";
            const parentSize = parseFloat(parentFontSize);

            if (!isNaN(parentSize)) {
                const pxValue = emValue * parentSize;
                return value.replace(/[\d.]+em/, `${pxValue}px`);
            }
        }
    }

    // Handle rem units (relative to root font-size)
    if (value.match(/[\d.]+rem\b/)) {
        const numMatch = value.match(/([\d.]+)rem/);
        if (numMatch) {
            const remValue = parseFloat(numMatch[1]);
            // Default root font size is 16px
            const rootFontSize = 16;
            const pxValue = remValue * rootFontSize;
            return value.replace(/[\d.]+rem/, `${pxValue}px`);
        }
    }

    // Handle viewport units (vw, vh, vmin, vmax)
    if (value.match(/[\d.]+v[wh]|vmin|vmax\b/)) {
        // Would need viewport dimensions from context
        // For now, return as-is
        return value;
    }

    // Return unchanged
    return value;
}

/**
 * Check if property is inherited
 *
 * @param property - Property name
 * @returns Whether property inherits
 */
export function isInherited(property: string): boolean {
    return INHERITED_PROPERTIES.has(property);
}

/**
 * Get initial value for property
 *
 * @param property - Property name
 * @returns Initial value or empty string
 */
export function getInitialValue(property: string): string {
    return INITIAL_VALUES.get(property) || "";
}

/**
 * Check if property is a shorthand
 *
 * @param property - Property name
 * @returns Whether property is a shorthand
 */
export function isShorthand(property: string): boolean {
    return SHORTHAND_PROPERTIES.has(property);
}

/**
 * Get longhand properties for a shorthand
 *
 * @param shorthand - Shorthand property name
 * @returns Array of longhand property names, or empty array
 */
export function getLonghandProperties(shorthand: string): string[] {
    return SHORTHAND_PROPERTIES.get(shorthand) || [];
}
