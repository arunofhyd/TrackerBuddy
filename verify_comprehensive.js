const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PORT = 8001; // Use a different port to avoid conflicts
const HOST = 'localhost';

const serveFile = (res, filePath, contentType) => {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500);
            res.end('Server Error');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
};

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filePath);
    let contentType = 'text/html';

    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
    }

    if (extname === '.js' || extname === '.css' || req.url === '/') {
        serveFile(res, filePath, contentType);
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

(async () => {
    server.listen(PORT, HOST, () => {
        console.log(`Server running at http://${HOST}:${PORT}/`);
    });

    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
        await page.goto(`http://${HOST}:${PORT}/`);

        await page.waitForSelector('#splash-screen', { state: 'visible' });
        await page.click('#splash-screen');

        await page.waitForSelector('#anon-continue-btn', { state: 'visible' });
        await page.click('#anon-continue-btn');

        console.log('Injecting multi-year data into local storage...');
        const testData = {
            yearlyData: {
                "2024": {
                    activities: {
                        '2024-07-22': {
                            note: 'Note for 2024',
                            '09:00-10:00': { text: 'Activity for 2024', order: 0 },
                            leave: { typeId: 'lt_1', dayType: 'full' }
                        }
                    },
                    leaveOverrides: {}
                },
                "2025": {
                    activities: {
                        '2025-08-15': {
                            note: 'Note for 2025',
                            '10:00-11:00': { text: 'Activity for 2025', order: 0 },
                            leave: { typeId: 'lt_2', dayType: 'half' }
                        }
                    },
                    leaveOverrides: {}
                }
            },
            leaveTypes: [
                { id: 'lt_1', name: 'Vacation', totalDays: 20, color: '#3b82f6' },
                { id: 'lt_2', name: 'Sick', totalDays: 10, color: '#ef4444' }
            ]
        };

        await page.evaluate(data => {
            localStorage.setItem('guestUserData', JSON.stringify(data));
        }, testData);

        await page.reload();
        await page.waitForSelector('#app-view', { state: 'visible' });

        // --- Verification for 2025 (default year) ---
        console.log('Verifying data for 2025...');
        await page.click('#current-period-display');
        await page.click('text="Aug"');
        await page.click('#close-month-picker-btn');

        const note2025 = await page.textContent('.calendar-day-cell[data-date="2025-08-15"] .day-note');
        assert.strictEqual(note2025.trim(), 'Note for 2025', '2025 note not found');
        console.log('2025 calendar note verified.');

        // --- Verification for 2024 ---
        console.log('Verifying data for 2024...');
        await page.click('#current-period-display');
        await page.click('#prev-year-btn'); // Go to 2024
        await page.click('text="Jul"');
        await page.click('#close-month-picker-btn');

        const note2024 = await page.textContent('.calendar-day-cell[data-date="2024-07-22"] .day-note');
        assert.strictEqual(note2024.trim(), 'Note for 2024', '2024 note not found');
        console.log('2024 calendar note verified.');

        // --- Verify Daily View ---
        console.log('Verifying daily view for 2024...');
        await page.click('.calendar-day-cell[data-date="2024-07-22"]');
        await page.waitForSelector('#daily-view', { state: 'visible' });
        const activityText = await page.textContent('.activity-text-editable');
        assert.strictEqual(activityText.trim(), 'Activity for 2024', 'Daily activity text mismatch');
        console.log('Daily activity view verified.');

        // --- Verify CSV Export ---
        console.log('Verifying CSV export...');
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.click('#download-csv-btn')
        ]);
        const csvPath = await download.path();
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        assert.ok(csvContent.includes('NOTE,2024-07-22,"Note for 2024"'), "CSV missing 2024 data");
        assert.ok(csvContent.includes('NOTE,2025-08-15,"Note for 2025"'), "CSV missing 2025 data");
        console.log('CSV export verified.');

        console.log('All verifications successful!');
    } catch (error) {
        console.error('Verification failed:', error.message);
        process.exit(1);
    } finally {
        await browser.close();
        server.close();
    }
})();
