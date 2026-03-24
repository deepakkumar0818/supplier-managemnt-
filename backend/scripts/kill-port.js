#!/usr/bin/env node
/**
 * Kills any process listening on port 8000 before starting the server.
 * Prevents EADDRINUSE when a previous instance is still running.
 */
const { execSync } = require('child_process');
const PORT = process.env.PORT || 8000;

try {
    if (process.platform === 'win32') {
        const out = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        const lines = out.trim().split('\n').filter(l => l.includes('LISTENING'));
        const pids = new Set();
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') pids.add(pid);
        }
        for (const pid of pids) {
            try {
                execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
                console.log(` freed port ${PORT} (was PID ${pid})`);
            } catch (_) {}
        }
    } else {
        execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true`, { stdio: 'pipe' });
    }
} catch (_) {
    // No process on port - continue
}
