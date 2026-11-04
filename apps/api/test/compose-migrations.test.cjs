const assert = require('node:assert/strict');
const fs = require('node:fs');

const compose = fs.readFileSync('docker-compose.yml', 'utf8');
const dockerfile = fs.readFileSync('apps/api/Dockerfile', 'utf8');

assert.match(compose, /^  migration:\n/m, 'Compose must define one migration service');
assert.match(
  compose,
  /  migration:[\s\S]*?command: \["\.\/node_modules\/\.bin\/prisma", "migrate", "deploy"\]/,
  'migration service must run Prisma migrations'
);
assert.match(
  compose,
  /  migration:[\s\S]*?depends_on:\n      postgres:\n        condition: service_healthy/,
  'migration service must wait for healthy PostgreSQL'
);

for (const service of ['api', 'webhook-worker', 'scheduler-worker']) {
  const start = compose.indexOf(`  ${service}:\n`);
  assert.notEqual(start, -1, `Compose must define ${service}`);
  const next = compose.indexOf('\n  ', start + 3);
  const block = compose.slice(start, next === -1 ? compose.length : next);
  assert.match(
    block,
    /depends_on:[\s\S]*?migration:[\s\S]*?condition: service_completed_successfully/,
    `${service} must wait for completed migrations`
  );
  assert.doesNotMatch(
    block,
    /prisma migrate deploy/,
    `${service} must not run migrations itself`
  );
}

assert.doesNotMatch(
  dockerfile,
  /prisma migrate deploy/,
  'API runtime image must not migrate during application startup'
);

console.log('Single migration service configuration: OK');
