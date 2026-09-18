const fs = require('fs');

try {
  const lines = fs.readFileSync('app/consulta-impressao/page.tsx', 'utf8').split('\n');
  const result = {};

  lines.forEach((line, index) => {
    if (line.includes('const EmpenhoVia =')) result.empenho = index + 1;
    if (line.includes('const ReciboVia =')) result.recibo = index + 1;
    if (line.includes('export default function ConsultaImpressao()')) result.main = index + 1;
  });

  fs.writeFileSync('scratch/lines.json', JSON.stringify(result));
} catch (e) {
  fs.writeFileSync('scratch/lines.json', JSON.stringify({error: e.message}));
}
