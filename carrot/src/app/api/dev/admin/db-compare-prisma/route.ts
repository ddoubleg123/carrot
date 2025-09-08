import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getDbPath() {
  const raw = process.env.DATABASE_URL || 'file:./prisma/dev.db';
  const p = raw.startsWith('file:') ? raw.slice('file:'.length) : raw;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

// Very lightweight Prisma schema parser: extracts table names (with @@map) and field column names (with @map)
function parsePrismaSchema(schemaText: string) {
  const models: Array<{ model: string; table: string; fields: Array<{ field: string; column: string }> }> = [];
  const modelBlocks = schemaText.match(/model\s+\w+\s+\{[\s\S]*?\}/g) || [];
  for (const block of modelBlocks) {
    const headerMatch = block.match(/^model\s+(\w+)\s+\{/m);
    if (!headerMatch) continue;
    const modelName = headerMatch[1];
    let tableName = modelName;
    const mapMatch = block.match(/@@map\(\"([^\"]+)\"\)/);
    if (mapMatch) tableName = mapMatch[1];

    // Extract fields: lines like `name String? @map("first_name")`
    const fieldLines = block
      .split('\n')
      .slice(1, -1) // drop first/last brace lines
      .filter(l => !l.trim().startsWith('@@'));

    const fields: Array<{ field: string; column: string }> = [];
    for (let line of fieldLines) {
      line = line.trim();
      if (!line || line.startsWith('//')) continue;
      // Field name is first token
      const parts = line.split(/\s+/);
      const fieldName = parts[0];
      if (!fieldName || fieldName.includes('@@')) continue;
      // Skip relation-only definitions (contain @relation but no type)? still have a column generally
      let columnName = fieldName;
      const colMap = line.match(/@map\(\"([^\"]+)\"\)/);
      if (colMap) columnName = colMap[1];
      fields.push({ field: fieldName, column: columnName });
    }
    models.push({ model: modelName, table: tableName, fields });
  }
  return models;
}

function inspectTable(db: any, tableName: string) {
  try {
    const cols: Array<{ name: string }> = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return cols.map(c => c.name);
  } catch {
    return null;
  }
}

export const runtime = 'nodejs';

export async function GET(req: Request, _ctx: { params: Promise<{}> }) { return POST(req, _ctx); }

export async function POST(_req: Request, _ctx: { params: Promise<{}> }) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ ok: false, error: 'Disabled in production' }, { status: 403 });
    }

    const absPath = getDbPath();
    let Database: any;
    try {
      const req = eval('require') as NodeRequire;
      Database = req('better-sqlite3');
    } catch {
      return NextResponse.json({ ok: false, error: 'better-sqlite3 not installed' }, { status: 500 });
    }
    const db = new Database(absPath);

    const schemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
    const schemaText = fs.readFileSync(schemaPath, 'utf-8');

    const models = parsePrismaSchema(schemaText);
    const results: any[] = [];

    for (const m of models) {
      const physical = m.table.startsWith('"') || m.table.includes('-') ? m.table : `"${m.table}"`;
      const columns = inspectTable(db, physical);
      const expected = m.fields.map(f => f.column);
      if (columns === null) {
        results.push({ ok: false, table: m.table, error: 'Table not found', expectedColumns: expected });
        continue;
      }
      const missing = expected.filter(c => !columns.includes(c));
      const extra = columns.filter(c => !expected.includes(c));

      const alters = missing.map(name => ({
        column: name,
        // We don't know exact type here; suggest TEXT which is safe for most of our string/json columns in dev.
        sql: `ALTER TABLE ${physical} ADD COLUMN ${name} TEXT;`
      }));

      results.push({ ok: true, model: m.model, table: m.table, columns, missing, extra, suggest: alters });
    }

    db.close();
    return NextResponse.json({ ok: true, db: absPath, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
