import sys
import os

try:
    with open('app/consulta-impressao/page.tsx', 'r', encoding='utf-8') as f:
        content = f.read()
    
    empenhoStart = content.find('const EmpenhoVia =')
    reciboStart = content.find('const ReciboVia =')
    mainPageStart = content.find('export default function ConsultaImpressao()')
    
    print(f"empenhoStart: {empenhoStart}")
    print(f"reciboStart: {reciboStart}")
    print(f"mainPageStart: {mainPageStart}")

    if empenhoStart == -1 or reciboStart == -1 or mainPageStart == -1:
        print("Could not find component boundaries")
        sys.exit(1)
        
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
        
    print("Extraction complete!")
except Exception as e:
    print(f"Error: {e}")
