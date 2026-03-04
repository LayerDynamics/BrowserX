/**
 * Table Layout Algorithm
 *
 * Implements CSS table layout for <table>, <tr>, <td>, <th> elements.
 * Supports auto and fixed table-layout, colspan/rowspan, border-collapse
 * and border-separate modes.
 */

import type { RenderObject } from "../rendering/RenderObject.ts";
import type { RenderBox } from "../rendering/RenderBox.ts";
import type { Pixels } from "../../../types/identifiers.ts";
import type { LayoutConstraints } from "../../../types/rendering.ts";

/**
 * Table cell info for layout
 */
interface TableCell {
  renderObject: RenderObject;
  column: number;
  row: number;
  colspan: number;
  rowspan: number;
  minWidth: Pixels;
  maxWidth: Pixels;
  height: Pixels;
}

/**
 * Table row info
 */
interface TableRow {
  renderObject: RenderObject;
  cells: TableCell[];
  height: Pixels;
}

/**
 * TableLayout
 * Implements the CSS table layout algorithm
 */
export class TableLayout {
  /**
   * Layout a table element and its children (rows, cells)
   *
   * @param parent - The table render object
   * @param children - Direct children (table-row or table-row-group)
   * @param constraints - Layout constraints
   * @returns Total content height
   */
  layoutTable(
    parent: RenderBox,
    children: RenderObject[],
    constraints: LayoutConstraints,
  ): Pixels {
    if (!parent.layout) {
      throw new Error("Table parent must have layout computed");
    }

    const tableLayoutMode = parent.style.getPropertyValue("table-layout") || "auto";
    const borderCollapse = parent.style.getPropertyValue("border-collapse") || "separate";
    const borderSpacing = parent.getPixelValue("border-spacing", 2 as Pixels);
    const spacing = borderCollapse === "collapse" ? 0 as Pixels : borderSpacing;

    // Collect rows and cells
    const rows = this.collectRows(children);
    if (rows.length === 0) {
      return 0 as Pixels;
    }

    // Determine number of columns
    const numColumns = this.getColumnCount(rows);
    if (numColumns === 0) {
      return 0 as Pixels;
    }

    // Calculate column widths
    const availableWidth = (parent.layout.width -
      parent.layout.paddingLeft - parent.layout.paddingRight) as Pixels;
    const columnWidths = tableLayoutMode === "fixed"
      ? this.calculateFixedColumnWidths(rows, numColumns, availableWidth, spacing)
      : this.calculateAutoColumnWidths(rows, numColumns, availableWidth, spacing);

    // Layout cells and rows
    let currentY = spacing;

    for (const row of rows) {
      let rowHeight = 0 as Pixels;

      // Layout each cell in the row
      for (const cell of row.cells) {
        // Calculate cell width (account for colspan)
        let cellWidth = 0;
        for (let c = cell.column; c < cell.column + cell.colspan && c < numColumns; c++) {
          cellWidth += columnWidths[c];
          if (c > cell.column) {
            cellWidth += spacing;
          }
        }

        // Calculate cell X position
        let cellX = parent.layout.x + parent.layout.paddingLeft + spacing;
        for (let c = 0; c < cell.column; c++) {
          cellX += columnWidths[c] + spacing;
        }

        // Layout cell content
        const cellConstraints: LayoutConstraints = {
          minWidth: 0 as Pixels,
          maxWidth: cellWidth as Pixels,
          minHeight: 0 as Pixels,
          maxHeight: Number.POSITIVE_INFINITY as Pixels,
        };

        cell.renderObject.doLayout(cellConstraints);

        if (cell.renderObject.layout) {
          cell.renderObject.layout.width = cellWidth as Pixels;
          const cellHeight = cell.renderObject.layout.height || cell.renderObject.layout.getTotalHeight();
          if (cell.rowspan <= 1) {
            rowHeight = Math.max(rowHeight, cellHeight) as Pixels;
          }
          cell.height = cellHeight;
        }
      }

      // Position cells in the row with the computed row height
      for (const cell of row.cells) {
        let cellX = parent.layout.x + parent.layout.paddingLeft + spacing;
        for (let c = 0; c < cell.column; c++) {
          cellX += columnWidths[c] + spacing;
        }

        const cellY = (parent.layout.y + parent.layout.paddingTop + currentY) as Pixels;
        cell.renderObject.setPosition(cellX as Pixels, cellY);

        if (cell.renderObject.layout) {
          cell.renderObject.layout.height = rowHeight;
        }
      }

      // Position row
      if (row.renderObject.layout) {
        row.renderObject.setPosition(
          parent.layout.x + parent.layout.paddingLeft as Pixels,
          (parent.layout.y + parent.layout.paddingTop + currentY) as Pixels,
        );
        row.renderObject.layout.width = availableWidth;
        row.renderObject.layout.height = rowHeight;
      }

      row.height = rowHeight;
      currentY += rowHeight + spacing;
    }

    return currentY as Pixels;
  }

  /**
   * Collect table rows from children (handles table-row-group wrappers)
   */
  private collectRows(children: RenderObject[]): TableRow[] {
    const rows: TableRow[] = [];

    for (const child of children) {
      const display = child.style.getPropertyValue("display");

      if (display === "table-row") {
        rows.push(this.createTableRow(child));
      } else if (
        display === "table-row-group" ||
        display === "table-header-group" ||
        display === "table-footer-group"
      ) {
        // Recurse into row group
        for (const groupChild of child.children) {
          if (groupChild.style.getPropertyValue("display") === "table-row") {
            rows.push(this.createTableRow(groupChild));
          }
        }
      } else {
        // Treat as anonymous row containing a single cell
        rows.push({
          renderObject: child,
          cells: [{
            renderObject: child,
            column: 0,
            row: rows.length,
            colspan: 1,
            rowspan: 1,
            minWidth: 0 as Pixels,
            maxWidth: 0 as Pixels,
            height: 0 as Pixels,
          }],
          height: 0 as Pixels,
        });
      }
    }

    return rows;
  }

  /**
   * Create a TableRow from a table-row render object
   */
  private createTableRow(rowObj: RenderObject): TableRow {
    const cells: TableCell[] = [];
    let column = 0;

    for (const cellChild of rowObj.children) {
      const colspan = this.getIntAttribute(cellChild, "colspan", 1);
      const rowspan = this.getIntAttribute(cellChild, "rowspan", 1);

      cells.push({
        renderObject: cellChild,
        column,
        row: 0,
        colspan,
        rowspan,
        minWidth: 0 as Pixels,
        maxWidth: 0 as Pixels,
        height: 0 as Pixels,
      });

      column += colspan;
    }

    return {
      renderObject: rowObj,
      cells,
      height: 0 as Pixels,
    };
  }

  /**
   * Get an integer attribute from a render object's element
   */
  private getIntAttribute(obj: RenderObject, attr: string, defaultValue: number): number {
    const val = obj.element.attributes?.get(attr);
    if (val) {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0) return num;
    }
    return defaultValue;
  }

  /**
   * Get the total column count from all rows
   */
  private getColumnCount(rows: TableRow[]): number {
    let maxCols = 0;
    for (const row of rows) {
      let cols = 0;
      for (const cell of row.cells) {
        cols += cell.colspan;
      }
      maxCols = Math.max(maxCols, cols);
    }
    return maxCols;
  }

  /**
   * Calculate column widths in auto table-layout mode
   * Distributes width based on content
   */
  private calculateAutoColumnWidths(
    rows: TableRow[],
    numColumns: number,
    availableWidth: Pixels,
    spacing: Pixels,
  ): Pixels[] {
    // Total spacing
    const totalSpacing = spacing * (numColumns + 1);
    const distributable = Math.max(0, availableWidth - totalSpacing);

    // Measure min/max content width per column
    const minWidths = new Array(numColumns).fill(0);
    const maxWidths = new Array(numColumns).fill(0);

    for (const row of rows) {
      for (const cell of row.cells) {
        if (cell.colspan === 1 && cell.renderObject.layout) {
          const cellWidth = cell.renderObject.layout.width || 0;
          minWidths[cell.column] = Math.max(minWidths[cell.column], cellWidth * 0.5);
          maxWidths[cell.column] = Math.max(maxWidths[cell.column], cellWidth);
        }
      }
    }

    // Distribute available width proportionally
    const totalMax = maxWidths.reduce((a: number, b: number) => a + b, 0);

    const columnWidths: Pixels[] = [];
    if (totalMax > 0 && totalMax > distributable) {
      // Scale down proportionally
      for (let i = 0; i < numColumns; i++) {
        columnWidths.push(((maxWidths[i] / totalMax) * distributable) as Pixels);
      }
    } else if (totalMax > 0) {
      // Scale up to fill
      for (let i = 0; i < numColumns; i++) {
        columnWidths.push(((maxWidths[i] / totalMax) * distributable) as Pixels);
      }
    } else {
      // Equal distribution
      const equalWidth = (distributable / numColumns) as Pixels;
      for (let i = 0; i < numColumns; i++) {
        columnWidths.push(equalWidth);
      }
    }

    return columnWidths;
  }

  /**
   * Calculate column widths in fixed table-layout mode
   * Uses first row to determine widths, then distributes remaining equally
   */
  private calculateFixedColumnWidths(
    rows: TableRow[],
    numColumns: number,
    availableWidth: Pixels,
    spacing: Pixels,
  ): Pixels[] {
    const totalSpacing = spacing * (numColumns + 1);
    const distributable = Math.max(0, availableWidth - totalSpacing);

    const columnWidths: Pixels[] = new Array(numColumns).fill(0);
    let assignedWidth = 0;
    let unassignedCols = numColumns;

    // Use first row to set widths
    if (rows.length > 0) {
      for (const cell of rows[0].cells) {
        if (cell.colspan === 1) {
          const widthVal = cell.renderObject.style.getPropertyValue("width");
          if (widthVal && widthVal !== "auto") {
            const px = cell.renderObject.getPixelValue("width");
            if (px > 0) {
              columnWidths[cell.column] = px as Pixels;
              assignedWidth += px;
              unassignedCols--;
            }
          }
        }
      }
    }

    // Distribute remaining width equally to unassigned columns
    if (unassignedCols > 0) {
      const remaining = Math.max(0, distributable - assignedWidth);
      const perCol = (remaining / unassignedCols) as Pixels;
      for (let i = 0; i < numColumns; i++) {
        if (columnWidths[i] === 0) {
          columnWidths[i] = perCol;
        }
      }
    }

    return columnWidths;
  }
}
