import * as fs from 'node:fs';
import * as path from 'node:path';

describe('schema Prisma do módulo Sites', () => {
  const schemaPath = path.join(__dirname, '../../../prisma/schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  it('declara siteId como UUID em todos os modelos que relacionam com Site', () => {
    const modelBlocks = schema.match(/model\s+\w+\s*\{[\s\S]*?\n\}/g) ?? [];
    expect(modelBlocks.length).toBeGreaterThan(0);

    const relatedToSite = modelBlocks.filter((block) =>
      /site\s+Site\s+@relation\(fields:\s*\[siteId\]/.test(block),
    );
    expect(relatedToSite.length).toBeGreaterThan(5);

    const offenders = relatedToSite
      .filter((block) => !/siteId\s+String[^\n]*@db\.Uuid/.test(block))
      .map((block) => block.match(/model\s+(\w+)/)?.[1]);

    expect(offenders).toEqual([]);
  });
});
