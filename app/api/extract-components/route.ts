import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const basePath = process.cwd();
    const pagePath = path.join(basePath, 'app/consulta-impressao/page.tsx');
    const empenhoPath = path.join(basePath, 'components/consulta-impressao/EmpenhoVia.tsx');
    const reciboPath = path.join(basePath, 'components/consulta-impressao/ReciboVia.tsx');

    const content = fs.readFileSync(pagePath, 'utf8');

    const empenhoStart = content.indexOf('const EmpenhoVia =');
    const reciboStart = content.indexOf('const ReciboVia =');
    const mainPageStart = content.indexOf('export default function ConsultaImpressao()');

    if (empenhoStart === -1 || reciboStart === -1 || mainPageStart === -1) {
      return NextResponse.json({ success: false, error: 'Could not find component boundaries' });
    }

    const empenhoComponent = content.substring(empenhoStart, reciboStart);
    const reciboComponent = content.substring(reciboStart, mainPageStart);

    const imports = `import { numeroPorExtenso } from '@/lib/utils';\n\n`;

    fs.mkdirSync(path.join(basePath, 'components/consulta-impressao'), { recursive: true });

    fs.writeFileSync(empenhoPath, imports + 'export ' + empenhoComponent.trim() + '\n');
    fs.writeFileSync(reciboPath, imports + 'export ' + reciboComponent.trim() + '\n');

    const newContent = content.substring(0, empenhoStart) + 
      'import { EmpenhoVia } from "@/components/consulta-impressao/EmpenhoVia";\n' +
      'import { ReciboVia } from "@/components/consulta-impressao/ReciboVia";\n\n' +
      content.substring(mainPageStart);

    fs.writeFileSync(pagePath, newContent);

    return NextResponse.json({ success: true, message: 'Extraction completed successfully!' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
