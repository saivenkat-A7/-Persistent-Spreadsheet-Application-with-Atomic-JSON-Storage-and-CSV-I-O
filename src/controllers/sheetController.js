const storageService = require('../services/storageService');
const csvService = require('../services/csvService');

/**
 * Save Sheet State
 * PUT /api/sheets/:sheetId/state
 */
async function saveState(req, res) {
    try {
        const { sheetId } = req.params;
        const data = req.body;

        // ensure body is present and contains valid 'cells' attribute
        if (!data || Object.keys(data).length === 0 || !data.cells) {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }

        await storageService.saveSheetState(sheetId, data);
        res.status(204).send();
    } catch (error) {
        if (error instanceof SyntaxError) {
            return res.status(400).json({ error: 'Malformed JSON' });
        }
        console.error('Save State Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

/**
 * Load Sheet State
 * GET /api/sheets/:sheetId/state
 */
async function loadState(req, res) {
    try {
        const { sheetId } = req.params;
        const data = await storageService.loadSheetState(sheetId);
        res.status(200).json(data);
    } catch (error) {
        if (error.code === 'NOT_FOUND') {
            return res.status(404).json({ error: 'Sheet not found' });
        }
        console.error('Load State Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

/**
 * Import CSV
 * POST /api/sheets/:sheetId/import
 */
async function importCsv(req, res) {
    try {
        const { sheetId } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'No CSV file provided' });
        }

        const stateObj = csvService.csvToState(req.file.buffer);

        // Validate CSV produced valid state
        if (!stateObj || !stateObj.cells) {
            return res.status(400).json({ error: 'Failed to process CSV data' });
        }

        // Save as atomic JSON state
        await storageService.saveSheetState(sheetId, stateObj);

        res.status(204).send();
    } catch (error) {
        console.error('Import CSV Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

/**
 * Export CSV
 * GET /api/sheets/:sheetId/export
 */
async function exportCsv(req, res) {
    try {
        const { sheetId } = req.params;

        // Load current state
        const data = await storageService.loadSheetState(sheetId);

        // Convert to CSV
        const csvString = csvService.stateToCsv(data);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${sheetId}.csv"`);
        res.status(200).send(csvString);
    } catch (error) {
        if (error.code === 'NOT_FOUND') {
            return res.status(404).json({ error: 'Sheet not found' });
        }
        console.error('Export CSV Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

module.exports = {
    saveState,
    loadState,
    importCsv,
    exportCsv
};
