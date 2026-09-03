import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const cwd = process.cwd();
    const filesInDir = fs.readdirSync(cwd);
    const xlsxFileName = filesInDir.find(f => f.endsWith('.xlsx')) || 'Sistema de Empenho e Gestão Financeira (1).xlsx';
    const targetPath = path.join(cwd, xlsxFileName);

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ error: 'Arquivo não encontrado: ' + targetPath }, { status: 200 });
    }

    const buf = fs.readFileSync(targetPath);

    // Parse ZIP by scanning local headers
    const localHeaders: any[] = [];
    for (let i = 0; i < buf.length - 30; i++) {
      if (buf[i] === 0x50 && buf[i+1] === 0x4b && buf[i+2] === 0x03 && buf[i+3] === 0x04) {
        const flags = buf.readUInt16LE(i + 6);
        const method = buf.readUInt16LE(i + 8);
        const compSize = buf.readUInt32LE(i + 18);
        const uncompSize = buf.readUInt32LE(i + 22);
        const nameLen = buf.readUInt16LE(i + 26);
        const extraLen = buf.readUInt16LE(i + 28);
        const fileName = buf.toString('utf8', i + 30, i + 30 + nameLen);
        localHeaders.push({ offset: i, fileName, method, compSize, uncompSize, extraLen, flags, nameLen });
      }
    }

    const zipFiles: Record<string, string> = {};
    for (let idx = 0; idx < localHeaders.length; idx++) {
      const h = localHeaders[idx];
      const dataOffset = h.offset + 30 + h.nameLen + h.extraLen;
      let compData: Buffer;
      
      if (h.compSize > 0) {
        compData = buf.subarray(dataOffset, dataOffset + h.compSize);
      } else {
        const nextOffset = idx + 1 < localHeaders.length ? localHeaders[idx + 1].offset : buf.length;
        compData = buf.subarray(dataOffset, nextOffset);
      }

      if (h.method === 0) {
        zipFiles[h.fileName] = compData.toString('utf8');
      } else if (h.method === 8) {
        try {
          const uncomp = zlib.inflateRawSync(compData);
          zipFiles[h.fileName] = uncomp.toString('utf8');
        } catch (e: any) {
          try {
            const uncomp = zlib.inflateSync(compData);
            zipFiles[h.fileName] = uncomp.toString('utf8');
          } catch (e2) {}
        }
      }
    }

    // Shared strings
    const sharedStrings: string[] = [];
    if (zipFiles['xl/sharedStrings.xml']) {
      const sst = zipFiles['xl/sharedStrings.xml'];
      const matches = sst.match(/<t[^>]*>(.*?)<\/t>/gs) || [];
      for (const m of matches) {
        const text = m.replace(/<[^>]+>/g, '');
        sharedStrings.push(text);
      }
    }

    // Workbook sheets
    const sheets: Array<{ name: string; sheetId: string; rId: string }> = [];
    if (zipFiles['xl/workbook.xml']) {
      const wb = zipFiles['xl/workbook.xml'];
      const sheetMatches = wb.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*sheetId="([^"]+)"[^>]*r:id="([^"]+)"/g);
      for (const match of sheetMatches) {
        sheets.push({ name: match[1], sheetId: match[2], rId: match[3] });
      }
    }

    // Defined names
    const definedNames: Array<{ name: string; formula: string }> = [];
    if (zipFiles['xl/workbook.xml']) {
      const wb = zipFiles['xl/workbook.xml'];
      const dnMatches = wb.matchAll(/<definedName[^>]*name="([^"]+)"[^>]*>(.*?)<\/definedName>/gs);
      for (const match of dnMatches) {
        definedNames.push({ name: match[1], formula: match[2] });
      }
    }

    // Rels
    const rels: Record<string, string> = {};
    if (zipFiles['xl/_rels/workbook.xml.rels']) {
      const rXml = zipFiles['xl/_rels/workbook.xml.rels'];
      const relMatches = rXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g);
      for (const match of relMatches) {
        rels[match[1]] = match[2];
      }
    }

    const sheetsDetail: Record<string, any> = {};

    sheets.forEach((s) => {
      const target = rels[s.rId] || '';
      const targetPath = target.startsWith('xl/') ? target : `xl/${target}`;
      const sheetXml = zipFiles[targetPath];
      
      if (!sheetXml) {
        sheetsDetail[s.name] = { error: 'XML não encontrado: ' + targetPath, targetPath };
        return;
      }

      const formulas: Array<{ ref: string; formula: string; val?: string }> = [];
      const cellMatches = sheetXml.matchAll(/<c\s+r="([A-Z0-9]+)"(?:[^>]*?t="([^"]+)")?[^>]*>(?:<f[^>]*>(.*?)<\/f>)?(?:<v>(.*?)<\/v>)?<\/c>/gs);
      
      const cellsMap: Record<string, { val?: string; formula?: string; type?: string }> = {};
      for (const cm of cellMatches) {
        const ref = cm[1];
        const type = cm[2];
        const formula = cm[3];
        let val = cm[4];
        
        if (type === 's' && val !== undefined) {
          const idx = parseInt(val, 10);
          val = sharedStrings[idx] || val;
        }
        
        cellsMap[ref] = { val, formula, type };
        if (formula) {
          formulas.push({ ref, formula, val });
        }
      }

      // Group formulas by pattern / column
      const colFormulas: Record<string, Array<{ ref: string; formula: string; val?: string }>> = {};
      formulas.forEach(f => {
        const col = f.ref.replace(/[0-9]/g, '');
        if (!colFormulas[col]) colFormulas[col] = [];
        colFormulas[col].push(f);
      });

      // Rows structured
      const rowsMap: Record<number, Record<string, any>> = {};
      Object.keys(cellsMap).forEach(ref => {
        const rowMatch = ref.match(/([A-Z]+)(\d+)/);
        if (rowMatch) {
          const rNum = parseInt(rowMatch[2], 10);
          if (!rowsMap[rNum]) rowsMap[rNum] = {};
          rowsMap[rNum][ref] = cellsMap[ref];
        }
      });

      const sortedRows = Object.keys(rowsMap).map(Number).sort((a,b) => a - b);
      const topRows: Record<number, Record<string, any>> = {};
      // Pegar até 50 linhas
      sortedRows.slice(0, 50).forEach(r => {
        topRows[r] = rowsMap[r];
      });

      sheetsDetail[s.name] = {
        totalCells: Object.keys(cellsMap).length,
        totalFormulas: formulas.length,
        formulaSummary: Object.entries(colFormulas).map(([col, list]) => ({
          column: col,
          count: list.length,
          sample: list[0],
          sampleEnd: list.length > 1 ? list[list.length - 1] : undefined
        })),
        allUniqueFormulas: Array.from(new Set(formulas.map(f => f.formula))),
        topRows
      };
    });

    return NextResponse.json({
      success: true,
      fileName: xlsxFileName,
      fileSizeBytes: buf.length,
      totalSheets: sheets.length,
      sheets,
      definedNames,
      extractedFiles: Object.keys(zipFiles),
      sheetsDetail
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 200 });
  }
}
