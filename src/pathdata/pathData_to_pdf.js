

export function pathDataArrayToPDF(pathDataArray = [], { width = 0, height = 0 } = {}) {

    let content = '';
    pathDataArray.forEach(pathData => {
        content += pathDataToPDF(pathData, { height })+`\n`;
    })

    let contentLength = new TextEncoder().encode(content).length;

    let pdf = `%PDF-1.4\n`;
    let objects = [
        '<<\n/Type /Catalog\n/Pages 2 0 R\n>>',
        `<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>`,
        `<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 ${width} ${height}]\n/Contents 4 0 R\n>>`,
        `<<\n/Length ${contentLength}\n>>\nstream\n${content}endstream`,
    ];

    let xref = [];
    for (let i = 0; i < objects.length; i++) {
        xref.push(pdf.length);
        pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    }

    let xrefPos = new TextEncoder().encode(pdf).length;

    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let pos of xref) {
        pdf += `${String(pos).padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer\n<<\n/Size ${objects.length + 1}\n/Root 1 0 R\n>>\n`;
    pdf += `startxref\n${xrefPos}\n%%EOF`;


    return pdf;
}


export function pathDataToPDF(pathData, { height = 0, decimals=3 } = {}) {

    //black fill
    let pdf = [
            `q`,
            `0 0 0 1 k`,        
    ];

    pathData.forEach(com => {
        let { type, values } = com;
        if (values.length) {

            // apply offset
            let yOff = height;

            for (let i = 1, l = values.length; i < l; i += 2) {
                values[i - 1] = (values[i - 1]).toFixed(decimals);
                values[i] = +(yOff - values[i]).toFixed(decimals);
            }
        }
        let comPdf =  values.length ? `${values.join(' ')} ${type.toLowerCase()}` : 'h';
        pdf.push(
            comPdf,
        )
    })

    pdf.push(`f`,`Q`);
    
    let res =  pdf.join('\n')

    //console.log(res);

    return res
}