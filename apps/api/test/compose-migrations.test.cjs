const assert = require('node:assert/strict');
const fs = require('node:fs');

const compose = fs.readFileSync('docker-compose.yml', 'utf8');
const dockerfile = fs.readFileSync('apps/api/Dockerfile', 'utf8');
const lines = compose.split('\n');

function serviceBlock(name) {
  const start = lines.findIndex((line) => line === `  ${name}:`);
  assert.notEqual(start, -1, `Compose must define ${name}`);
  const end = lines.findIndex(
    (line, index) => index > start && /^\x20{2}\S/.test(line)
  );
  return lines.slice(start, end === -1 ? lines.length : end).join('\n');
}

const migration = serviceBlock('migration');
assert.match(migration, /command: \["\.\/node_modules\/\.bin\/prisma", "migrate", "deploy"\]/);
assert.match(migration, /depends_on:[\s\S]*?postgres:[\s\S]*?condition: service_healthy/);

for (const service of ['api', 'webhook-worker', 'scheduler-worker']) {
  const block = serviceBlock(service);
  assert.match(
    block,
    /depends_on:[\s\S]*?migration:[\s\S]*?condition: service_completed_successfully/,
    `${service} must wait for completed migrations`
  );
  assert.doesNotMatch(block, /prisma migrate deploy/, `${service} must not migrate itself`);
}

assert.doesNotMatch(
  dockerfile,
  /prisma migrate deploy/,
  'API runtime image must not migrate during application startup'
);

console.log('Single migration service configuration: OK');
