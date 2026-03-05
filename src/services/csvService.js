const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// Helper to get A, B, C... notation for columns (0-indexed)
function getColumnLetter(colIndex) {
    let temp, letter = '';
    while (colIndex >= 0) {
        temp = colIndex % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = (colIndex - temp - 26) / 26;
    }
    return letter;
}

function csvToState(csvBuffer) {
    // Parse CSV
    const records = parse(csvBuffer, {
        skip_empty_lines: true
    });

    const state = { cells: {} };
    for (let r = 0; r < records.length; r++) {
        for (let c = 0; c < records[r].length; c++) {
            const val = records[r][c];
            if (val !== undefined && val !== null && val !== '') {
                const cellId = `${getColumnLetter(c)}${r + 1}`;
                state.cells[cellId] = val;
            }
        }
    }
    return state;
}

function evaluateFormula(formulaStr) {
    try {
        const expr = formulaStr.substring(1).trim(); // Remove '='
        // Only allow digits, basic operators and spaces for safety
        if (/^[0-9+\-*/.\s]+$/.test(expr)) {
            // Evaluate simple math
            return new Function(`return ${expr}`)();
        }
        return formulaStr;
    } catch (e) {
        return formulaStr;
    }
}

function stateToCsv(state) {
    const cells = state.cells || {};
    let maxRow = -1;
    let maxCol = -1;
    const parsedCells = [];

    for (const [id, value] of Object.entries(cells)) {
        const match = id.match(/^([A-Z]+)(\d+)$/);
        if (match) {
            const colStr = match[1];
            const row = parseInt(match[2], 10) - 1;

            let col = 0;
            for (let i = 0; i < colStr.length; i++) {
                col = col * 26 + (colStr.charCodeAt(i) - 64);
            }
            col -= 1; // 0-indexed

            if (row > maxRow) maxRow = row;
            if (col > maxCol) maxCol = col;

            parsedCells.push({ row, col, val: value });
        }
    }

    if (maxRow === -1 || maxCol === -1) {
        return stringify([]); // Empty CSV
    }

    // Create grid
    const grid = Array.from({ length: maxRow + 1 }, () => Array(maxCol + 1).fill(''));

    for (const { row, col, val } of parsedCells) {
        let finalVal = val;
        if (typeof val === 'string' && val.startsWith('=')) {
            finalVal = evaluateFormula(val);
        }
        grid[row][col] = finalVal;
    }

    return stringify(grid);
}

module.exports = {
    csvToState,
    stateToCsv,
    evaluateFormula
};
