const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const TRACE_FILE = path.join(__dirname, 'test-trace.jsonl');

try {
    console.log('🚀 Running tests and intercepting SQL queries. Please wait...\n');
    
    // Clear old trace
    if (fs.existsSync(TRACE_FILE)) fs.unlinkSync(TRACE_FILE);
    
    const stdout = execSync('npx jest --json --runInBand --forceExit --silent', { 
        encoding: 'utf-8', 
        stdio: ['pipe', 'pipe', 'ignore'],
        maxBuffer: 10 * 1024 * 1024 
    });
    
    processResults(stdout);
} catch (error) {
    if (error.stdout) {
        processResults(error.stdout);
    } else {
        console.error('Failed to run tests:', error.message);
    }
}

function inferDetail(title) {
    const rules = [
        { regex: /returns (\d{3})/i, format: (m) => `Status Code ${m[1]}` },
        { regex: /returns (\d+[\.%])/i, format: (m) => `Return Value ${m[1]}` },
        { regex: /applies (\d+[\.%])/i, format: (m) => `Applied Discount ${m[1]}` },
        { regex: /caps .* at (\d+[\.%])/i, format: (m) => `Maximum Cap ${m[1]}` },
        { regex: /returns a (\w+) UUID/i, format: (m) => `Generated ${m[1]} UUID` },
        { regex: /hides PII/i, format: () => "PII Masking / Anonymization" },
        { regex: /includes history/i, format: () => "Data inclusion (History/Invoices)" },
        { regex: /anonymizes patient data/i, format: () => "Data Anonymization Logic" },
        { regex: /deducts stock via FEFO/i, format: () => "FEFO Stock Deduction Algorithm" },
        { regex: /inserts sale items/i, format: () => "Batch Item Database Insertion" },
        { regex: /restores batch stock/i, format: () => "Stock Restoration Logic" },
        { regex: /assigns the least-loaded driver/i, format: () => "Load Balancing Driver Algorithm" },
        { regex: /rate limit exceeded/i, format: () => "API Rate Limiting Enforcement" },
        { regex: /audit log entry/i, format: () => "Audit Logging Protocol" }
    ];

    for (const rule of rules) {
        const match = title.match(rule.regex);
        if (match) return rule.format(match);
    }
    return "Verified Logical Assertion";
}

function processResults(output) {
    const jsonStart = output.indexOf('{');
    if (jsonStart === -1) {
        console.error('Could not find JSON output from Jest.');
        return;
    }
    
    const jsonStr = output.substring(jsonStart);
    let data;
    try {
        data = JSON.parse(jsonStr);
    } catch (e) {
        console.error('Failed to parse Jest JSON output:', e.message);
        return;
    }

    // Load Trace Queries
    const traces = [];
    if (fs.existsSync(TRACE_FILE)) {
        const lines = fs.readFileSync(TRACE_FILE, 'utf-8').split('\n').filter(Boolean);
        lines.forEach(l => traces.push(JSON.parse(l)));
    }

    const memberResults = {};

    data.testResults.forEach(suite => {
        const filename = path.basename(suite.name);
        const parts = filename.split('.');
        const memberId = parts.length > 1 ? parts[1] : 'Unknown';
        const moduleName = parts.length > 2 ? parts[2] : 'Unknown Module';

        if (!memberResults[memberId]) {
            memberResults[memberId] = { file: filename, module: moduleName, tests: [] };
        }

        suite.assertionResults.forEach(res => {
            const testNameRaw = [...res.ancestorTitles, res.title].join(' ');
            const normalize = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            const testName = normalize(testNameRaw);
            
            let recording = false;
            let queries = [];
            let txnEvents = [];

            for (const t of traces) {
                const traceName = t.name ? normalize(t.name) : '';
                if (t.type === 'test_start' && traceName === testName) {
                    recording = true;
                    continue;
                }
                if (recording && t.type === 'test_start') break; // Next test started
                
                if (recording) {
                    if (t.type === 'query' || t.type === 'execute') {
                        queries.push(t.sql.trim().replace(/\s+/g, ' '));
                    } else if (['begin', 'commit', 'rollback'].includes(t.type)) {
                        txnEvents.push(t.type.toUpperCase());
                    }
                }
            }

            memberResults[memberId].tests.push({
                name: testName,
                title: res.title,
                status: res.status,
                duration: res.duration,
                failureMessages: res.failureMessages,
                queries: queries
            });
        });
    });

    console.log('================================================================================');
    console.log('                         TEAM MEMBER TEST REPORT                                ');
    console.log('================================================================================');

    for (const [memberId, info] of Object.entries(memberResults)) {
        console.log(`\n👨‍💻 MEMBER:  ${memberId.toUpperCase()}`);
        console.log(`📦 MODULE:  ${info.module.toUpperCase().replace(/-/g, ' ')}`);
        console.log(`📄 FILE:    ${info.file}`);
        console.log(`--------------------------------------------------------------------------------`);
        
        let memberPassCount = 0;
        let memberFailCount = 0;
        
        info.tests.forEach(t => {
            const isPass = t.status === 'passed';
            if (isPass) memberPassCount++; else memberFailCount++;
            
            const statusIcon = isPass ? '✅ PASS' : (t.status === 'failed' ? '❌ FAIL' : '⚠️ SKIP');
            const durationStr = t.duration !== undefined ? ` [${t.duration}ms]` : '';
            console.log(`${statusIcon} | Test: ${t.name}${durationStr}`);
            
            const detail = inferDetail(t.title);
            console.log(`           Expected Logic : ${detail}`);
            
            if (t.queries && t.queries.length > 0) {
                t.queries.forEach((q, i) => {
                    console.log(`           Got Query [${i+1}]   : ${q}`);
                });
            } else if (isPass) {
                console.log(`           Result         : Logic Verified (No DB interaction)`);
            }

            if (!isPass && t.status === 'failed') {
                const msg = t.failureMessages.join('\n');
                const expectedMatch = msg.match(/Expected:\s*(.*)/);
                const receivedMatch = msg.match(/Received:\s*(.*)/);
                console.log(`           Error          : ${expectedMatch ? expectedMatch[1] : 'Fail'} vs ${receivedMatch ? receivedMatch[1] : 'Got'}`);
            }
            console.log('');
        });
        
        console.log(`> MEMBER SUMMARY: ${memberPassCount} Passed, ${memberFailCount} Failed`);
        console.log(`--------------------------------------------------------------------------------`);
    }
    
    console.log(`\n📊 SUMMARY`);
    console.log(`Total Tests: ${data.numTotalTests}`);
    console.log(`Passed     : ${data.numPassedTests}`);
    console.log(`Failed     : ${data.numFailedTests}`);
    console.log(`Skipped    : ${data.numPendingTests}`);
    console.log('================================================================================\n');
}
