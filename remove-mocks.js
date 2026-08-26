const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, 'app/ordem-pagamento/page.tsx'),
  path.join(__dirname, 'app/consulta-impressao/page.tsx')
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf-8');

  // Remove mockNEDatabase declaration
  content = content.replace(/const mockNEDatabase: Record<string, any> = \{[\s\S]*?\};\n\n/g, '');
  content = content.replace(/const mockNEDatabase: Record<string, any> = \{[\s\S]*?\};\n/g, '');

  // Remove CREDORES_BASE declaration
  content = content.replace(/const CREDORES_BASE = \[[\s\S]*?\];\n\n/g, '');

  if (file.includes('ordem-pagamento')) {
    // Replace initial data fallback
    content = content.replace(
      /const initialData =\s*mockNEDatabase\[initialNe\] \|\| mockNEDatabase\["2024NE00142"\];/,
      `const initialData = {
    empenho: "", gestao: "", unidade: "", elementoSubelemento: "", sub: "01",
    nomeCredor: "", cpfCnpj: "", rgIe: "", endereco: "",
    saldoAnterior: 0, valorEmpenho: 0, historico: "", dataPagamento: ""
  };`
    );

    // Replace auto-fill logic for credor
    content = content.replace(
      /const match = CREDORES_BASE\.find\([\s\S]*?if \(match\) \{/,
      `const res = await fetch(\`/api/credores?busca=\${strippedValue}\`);
      const data = await res.json();
      const match = data.credores?.find(
        (c: any) => c.cpfCnpj.replace(/\\D/g, "") === strippedValue,
      );
      if (match) {`
    );
    // Add async to handleCpfCnpjChange
    content = content.replace(
      /const handleCpfCnpjChange = \(value: string\) => \{/,
      `const handleCpfCnpjChange = async (value: string) => {`
    );

    // Replace NE mock fallback in fetch logic
    content = content.replace(
      /\/\/ Fallback: mock local[\s\S]*?toast\.error\('NE não encontrada\. Verifique o número digitado\.'\);/,
      `toast.error('NE não encontrada. Verifique o número digitado.');`
    );

    // Replace NE modal mock list
    content = content.replace(
      /\[\.\.\.nesDB, \.\.\.Object\.entries\(mockNEDatabase\)\.map\(\(\[k, v\]\) => \(\{[\s\S]*?\}\)\)\]/,
      `[...nesDB]`
    );

    // Replace NE modal fallback selection
    content = content.replace(
      /\/\/ Fallback mock[\s\S]*?setShowNeModal\(false\);\n\s*\}\}/,
      `setShowNeModal(false);
                    }}`
    );
  }

  if (file.includes('consulta-impressao')) {
    // Replace mockData usage
    content = content.replace(
      /const mockData = mockNEDatabase\[formattedNe\] \|\| null;[\s\S]*?if \(!mockData\) \{/,
      `// mock removido
      if (true) {`
    );

    // Replace NE modal mock list
    content = content.replace(
      /\[\.\.\.nesDB, \.\.\.Object\.entries\(mockNEDatabase\)\.map\(\(\[k, v\]\) => \(\{[\s\S]*?\}\)\)\]/,
      `[...nesDB]`
    );
    
    // Replace OP modal mock fetch fallback
    content = content.replace(
      /const neLocal = mockNEDatabase\[dataOP\.numeroNe\];/g,
      `const neLocal = null;`
    );
  }

  fs.writeFileSync(file, content);
});
console.log('Script finalizado com sucesso.');
