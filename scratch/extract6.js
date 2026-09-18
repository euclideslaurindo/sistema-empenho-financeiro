const fs = require('fs');

try {
  const content = fs.readFileSync('app/consulta-impressao/page.tsx', 'utf8');

  const empenhoStart = content.indexOf('const EmpenhoVia =');
  const reciboStart = content.indexOf('const ReciboVia =');
  const mainPageStart = content.indexOf('export default function ConsultaImpressao()');

  if (empenhoStart === -1 || reciboStart === -1 || mainPageStart === -1) {
    console.log('Could not find component boundaries');
    process.exit(1);
  }

  const empenhoComponent = content.substring(empenhoStart, reciboStart);
  const reciboComponent = content.substring(reciboStart, mainPageStart);

  const imports = `import { numeroPorExtenso } from '@/lib/utils';\n\n`;

  fs.writeFileSync('components/consulta-impressao/EmpenhoVia.tsx', imports + 'export ' + empenhoComponent.trim() + '\n');
  fs.writeFileSync('components/consulta-impressao/ReciboVia.tsx', imports + 'export ' + reciboComponent.trim() + '\n');

  const newContent = content.substring(0, empenhoStart) + 
    'import { EmpenhoVia } from "@/components/consulta-impressao/EmpenhoVia";\n' +
    'import { ReciboVia } from "@/components/consulta-impressao/ReciboVia";\n\n' +
    content.substring(mainPageStart);

  fs.writeFileSync('app/consulta-impressao/page.tsx', newContent);
  console.log('Extraction complete!');
} catch (e) {
  console.error(e);
}
