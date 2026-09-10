import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const html = readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(Boolean);
if (scripts.length === 0) throw new Error('No inline script found');
const source = scripts.at(-1);
const result = spawnSync(process.execPath, ['--check'], { input: source, encoding: 'utf8' });
if (result.status !== 0) { process.stderr.write(result.stderr); process.exit(result.status ?? 1); }
const required = ['smartfarm/relay/pump/set','smartfarm/relay/pump/status','smartfarm/sensor/dht11','smartfarm/system/error'];
for (const topic of required) if (!html.includes(topic)) throw new Error(`Missing required topic: ${topic}`);
if (html.includes('MQTT Password') || html.includes('Firebase Secret')) throw new Error('Potential secret label found in source');
console.log(`Dashboard validation passed: ${scripts.length} script block(s), ${html.length} bytes`);
