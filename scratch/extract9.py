import traceback

try:
    with open('app/consulta-impressao/page.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    empenhoStart = content.find('const EmpenhoVia =')
    reciboStart = content.find('const ReciboVia =')
    mainPageStart = content.find('export default function ConsultaImpressao()')

    if empenhoStart == -1 or reciboStart == -1 or mainPageStart == -1:
        with open('scratch/error.txt', 'w', encoding='utf-8') as f:
            f.write(f"Could not find boundaries: {empenhoStart}, {reciboStart}, {mainPageStart}")
        exit(1)

    empenhoComponent = content[empenhoStart:reciboStart]
    reciboComponent = content[reciboStart:mainPageStart]

    imports = "import { numeroPorExtenso } from '@/lib/utils';\n\n"

    with open('components/consulta-impressao/EmpenhoVia.tsx', 'w', encoding='utf-8') as f:
        f.write(imports + 'export ' + empenhoComponent.strip() + '\n')

    with open('components/consulta-impressao/ReciboVia.tsx', 'w', encoding='utf-8') as f:
        f.write(imports + 'export ' + reciboComponent.strip() + '\n')

    newContent = content[:empenhoStart] + \
                 "import { EmpenhoVia } from '@/components/consulta-impressao/EmpenhoVia';\n" + \
                 "import { ReciboVia } from '@/components/consulta-impressao/ReciboVia';\n\n" + \
                 content[mainPageStart:]

    with open('app/consulta-impressao/page.tsx', 'w', encoding='utf-8') as f:
        f.write(newContent)

    with open('scratch/success.txt', 'w', encoding='utf-8') as f:
        f.write("Extraction completed successfully!")

except Exception as e:
    with open('scratch/error.txt', 'w', encoding='utf-8') as f:
        f.write(traceback.format_exc())
