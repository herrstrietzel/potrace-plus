export function removeZeroLengthLinetos(pathData) {

    let M = { x: pathData[0].values[0], y: pathData[0].values[1] }
    let p0 = M
    let p = p0

    let pathDataN = [pathData[0]]

    for (let c = 1, l = pathData.length; c < l; c++) {
        let com = pathData[c];
        let { type, values, t = 0 } = com;

        let valsL = values.slice(-2);
        p = { x: valsL[0], y: valsL[1] };

        if (type === 'L' && p.x === p0.x && p.y === p0.y) {
            //renderPoint(svg, p, 'purple')
            continue
        }

        pathDataN.push(com)
        p0 = p;
    }


    return pathDataN

}