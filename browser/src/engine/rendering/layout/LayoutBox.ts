/**
 * LayoutBox - Geometry and box model for layout
 */

export interface LayoutBox {
    x: number;
    y: number;
    width: number;
    height: number;
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
}

export function createLayoutBox(): LayoutBox {
    return {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        marginTop: 0,
        marginRight: 0,
        marginBottom: 0,
        marginLeft: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
    };
}
