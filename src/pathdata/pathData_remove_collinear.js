import { getPolygonArea } from "../geometry_area";
import { renderPoint } from "../visualize";

export function pathDataRemoveColinear(pathData, tolerance = 0.00001) {

    let pathDataN = [pathData[0]];

    //return pathData;
    //console.log('pathDataRemoveColinear', pathData);

    let lastType = 'L';
    let M = { x: pathData[0].values[0], y: pathData[0].values[1] }
    let p0 = M;
    let p = M

    for (let c = 1, l = pathData.length; c < l; c++) {
        //let comPrev = pathData[c - 1];
        let com = pathData[c];
        let comN = pathData[c + 1] || pathData[l - 1];
        let p1 = comN.type === 'Z' ? M : { x: comN.values[comN.values.length - 2], y: comN.values[comN.values.length - 1] }

        let { type, values } = com;
        let valsL = values.slice(-2)
        //p = { x: valsL[0], y: valsL[1] }
        p = type !== 'Z' ? { x: valsL[0], y: valsL[1] } : M;

        let cpts = type === 'C' ?
            [{ x: values[0], y: values[1] }, { x: values[2], y: values[3] }] :
            (type === 'Q' ? [{ x: values[0], y: values[1] }] : []);

        //let cpts = type==='C' ? [{x:values[0], y:values[1]}, {x:values[2], y:values[3]}] : (type==='Q' ?   : )

        let area = Math.abs(getPolygonArea([p0, ...cpts, p, p1]))


        /*
        if (c === l - 1) {
            let area = Math.abs(getPolygonArea([ p0, p, p1, M]))
            console.log(area, p, p1, M);
            if(area<tolerance){

                //renderPoint(svg, p)
                //return pathDataN
            }
        }
        */


        /**
         * Check for perfectly flat
         */

        // update end point
        p0 = p;

        if (area < tolerance) {
            //renderPoint(svg, p)
            continue;
        }

        if (type === 'M') {
            M = p
            p0 = M
        }

        else if (type === 'Z') {
            p0 = M;
        }


        // proceed and add command
        pathDataN.push(com)

    }

    // add close path
    pathDataN.push({ type: 'Z', values: [] })
    //console.log('pathDataN', pathDataN);

    return pathDataN;

}