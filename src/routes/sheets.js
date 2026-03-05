const express = require('express');
const router = express.Router();
const sheetController = require('../controllers/sheetController');
const multer = require('multer');

// Configure multer for memory storage (file buffer is available in req.file.buffer)
const upload = multer({ storage: multer.memoryStorage() });

// State endpoints
router.put('/:sheetId/state', sheetController.saveState);
router.get('/:sheetId/state', sheetController.loadState);

// CSV IO endpoints
router.post('/:sheetId/import', upload.single('file'), sheetController.importCsv);
router.get('/:sheetId/export', sheetController.exportCsv);

module.exports = router;
