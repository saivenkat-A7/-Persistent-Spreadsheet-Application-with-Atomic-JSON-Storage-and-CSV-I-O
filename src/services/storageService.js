const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Get data storage path from environment or default
const DATA_DIR = process.env.DATA_STORAGE_PATH || path.join(__dirname, '../../app_data');

/**
 * Ensures that the data directory exists.
 */
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(DATA_DIR, { recursive: true });
        } else {
            throw error;
        }
    }
}

/**
 * Atomically saves a sheet state to a JSON file.
 * Write to a temp file, then rename it to the target file.
 * @param {string} sheetId 
 * @param {object} payload 
 */
async function saveSheetState(sheetId, payload) {
    await ensureDataDir();

    const targetPath = path.join(DATA_DIR, `${sheetId}.json`);
    const tempPath = path.join(DATA_DIR, `${sheetId}_${crypto.randomBytes(6).toString('hex')}.tmp`);

    try {
        // Write data to the temporary file
        await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf8');

        // Atomically rename the temp file to the target file
        await fs.rename(tempPath, targetPath);
    } catch (error) {
        // If anything fails during write, try to clean up the temp file
        try {
            await fs.unlink(tempPath);
        } catch (cleanupError) {
            // Ignore cleanup error if file doesn't exist
        }
        throw error;
    }
}

/**
 * Loads a sheet state from a JSON file.
 * @param {string} sheetId 
 * @returns {object} The parsed JSON state
 */
async function loadSheetState(sheetId) {
    const targetPath = path.join(DATA_DIR, `${sheetId}.json`);

    try {
        const data = await fs.readFile(targetPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            const err = new Error('Sheet not found');
            err.code = 'NOT_FOUND';
            throw err;
        }
        throw error;
    }
}

module.exports = {
    saveSheetState,
    loadSheetState
};
