/**
 * app.test.js — Integration Tests
 *
 * Tests all API endpoints using supertest (makes real HTTP requests to Express).
 * Uses a temporary directory for data storage during tests.
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Set up a temp directory BEFORE loading the app
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spreadsheet-test-'));
process.env.DATA_STORAGE_PATH = testDataDir;
process.env.PORT = '0'; // Use random port for tests

const app = require('./src/app');

// Clean up temp directory after all tests
afterAll(() => {
  fs.rmSync(testDataDir, { recursive: true, force: true });
});

// ─── Health Check ──────────────────────────────────────────────────────────────
describe('GET /health', () => {
  test('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ─── Save Sheet State ──────────────────────────────────────────────────────────
describe('PUT /api/sheets/:sheetId/state', () => {
  test('returns 204 and creates JSON file', async () => {
    const payload = {
      cells: { A1: 'Hello', B1: 'World', C1: '=10*2' }
    };

    const res = await request(app)
      .put('/api/sheets/sheet1/state')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(204);

    // Verify the file was actually created
    const filePath = path.join(testDataDir, 'sheet1.json');
    expect(fs.existsSync(filePath)).toBe(true);

    // Verify file content matches what we sent
    const savedContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(savedContent.cells.A1).toBe('Hello');
    expect(savedContent.cells.C1).toBe('=10*2');
  });

  test('returns 400 for invalid body (missing cells)', async () => {
    const res = await request(app)
      .put('/api/sheets/sheet-bad/state')
      .send({ data: 'wrong structure' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
  });
});

// ─── Load Sheet State ──────────────────────────────────────────────────────────
describe('GET /api/sheets/:sheetId/state', () => {
  test('returns 200 with sheet content', async () => {
    // First, create a file manually
    const testState = { cells: { A1: 'Test', B1: '=5+3' } };
    fs.writeFileSync(
      path.join(testDataDir, 'sheet2.json'),
      JSON.stringify(testState)
    );

    const res = await request(app).get('/api/sheets/sheet2/state');
    expect(res.status).toBe(200);
    expect(res.body.cells.A1).toBe('Test');
    expect(res.body.cells.B1).toBe('=5+3');
  });

  test('returns 404 for non-existent sheet', async () => {
    const res = await request(app).get('/api/sheets/nonexistent/state');
    expect(res.status).toBe(404);
  });
});

// ─── Atomic Write Integrity ────────────────────────────────────────────────────
describe('Atomic write integrity', () => {
  test('original file remains unchanged after failed write', async () => {
    // Step 1: Save valid initial state
    const initialPayload = { cells: { A1: 'initial' } };
    await request(app)
      .put('/api/sheets/atomic-test/state')
      .send(initialPayload)
      .set('Content-Type', 'application/json');

    // Verify initial state was saved
    const filePath = path.join(testDataDir, 'atomic-test.json');
    const originalContent = fs.readFileSync(filePath, 'utf8');

    // Step 2: Attempt invalid write (bad body structure)
    const badRes = await request(app)
      .put('/api/sheets/atomic-test/state')
      .send({ wrong: 'no cells key' })
      .set('Content-Type', 'application/json');

    expect(badRes.status).toBe(400);

    // Step 3: Verify original file is UNCHANGED
    const afterContent = fs.readFileSync(filePath, 'utf8');
    expect(afterContent).toBe(originalContent);
    const parsedAfter = JSON.parse(afterContent);
    expect(parsedAfter.cells.A1).toBe('initial');
  });
});

// ─── CSV Import ────────────────────────────────────────────────────────────────
describe('POST /api/sheets/:sheetId/import', () => {
  test('imports CSV and stores formulas as strings', async () => {
    const csvContent = 'Name,Value,Formula\nItem A,100,=A2+B2\nItem B,200,=5*10';

    const res = await request(app)
      .post('/api/sheets/csv-import-test/import')
      .attach('file', Buffer.from(csvContent), 'test.csv');

    expect(res.status).toBe(204);

    // Verify state was saved correctly
    const stateRes = await request(app).get('/api/sheets/csv-import-test/state');
    expect(stateRes.status).toBe(200);

    // Header row: A1=Name, B1=Value, C1=Formula
    expect(stateRes.body.cells.A1).toBe('Name');
    expect(stateRes.body.cells.B1).toBe('Value');
    expect(stateRes.body.cells.C1).toBe('Formula');

    // Data row 2: A2=Item A, B2=100, C2==A2+B2 (stored as formula string)
    expect(stateRes.body.cells.A2).toBe('Item A');
    expect(stateRes.body.cells.C2).toBe('=A2+B2'); // Formula stored as string!
    expect(stateRes.body.cells.C3).toBe('=5*10');  // Formula stored as string!
  });

  test('returns 400 when no file is uploaded', async () => {
    const res = await request(app)
      .post('/api/sheets/no-file-test/import');
    expect(res.status).toBe(400);
  });
});

// ─── CSV Export ────────────────────────────────────────────────────────────────
describe('GET /api/sheets/:sheetId/export', () => {
  test('exports CSV with formulas evaluated', async () => {
    // Set up sheet with formulas
    const state = {
      cells: {
        A1: 'Name', B1: 'Value',
        A2: 'Tax', B2: '=10+5',
        A3: 'Total', B3: '=3*4'
      }
    };
    fs.writeFileSync(
      path.join(testDataDir, 'export-test.json'),
      JSON.stringify(state)
    );

    const res = await request(app).get('/api/sheets/export-test/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);

    const csv = res.text;
    // B2 formula =10+5 should appear as 15, NOT =10+5
    expect(csv).toContain('15');
    expect(csv).not.toContain('=10+5');
    // B3 formula =3*4 should appear as 12
    expect(csv).toContain('12');
  });

  test('returns 404 for non-existent sheet export', async () => {
    const res = await request(app).get('/api/sheets/ghost-sheet/export');
    expect(res.status).toBe(404);
  });
});