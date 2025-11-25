

/**
 * get "raw" SVG pathData
 * converts internal path list to 
 * SVG path data array
 */

import { cleanUpPathData, optimizeStartingPoints } from "./pathdata_cleanup";
import { convertPathData, pathDataToRelative } from "./pathData_convert";
import { reorderPathData } from "./pathData_reorder";

export function getPotracePathData(pathList = [], scale = 1) {

    let len = pathList.length;
    let pathData = []


    for (let l = 0; l < len; l++) {

        // sub paths starting with ;M
        let curve = pathList[l].curve;
        let n = curve.n, coms;
        pathData.push(
            {
                type: 'M', values: [
                    curve.c[(n - 1) * 3 + 2].x * scale,
                    curve.c[(n - 1) * 3 + 2].y * scale
                ]
            },
        );

        for (let i = 0; i < n; i++) {
            let type = curve.tag[i];
            if (type === "curve") {
                coms = [{
                    type: 'C', values: [
                        curve.c[i * 3].x * scale,
                        curve.c[i * 3].y * scale,
                        curve.c[i * 3 + 1].x * scale,
                        curve.c[i * 3 + 1].y * scale,
                        curve.c[i * 3 + 2].x * scale,
                        curve.c[i * 3 + 2].y * scale
                    ]
                }]

            } else if (type === "corner") {
                coms = [

                    {
                        type: 'L', values: [
                            curve.c[i * 3 + 1].x * scale,
                            curve.c[i * 3 + 1].y * scale,
                        ]
                    },
                    {
                        type: 'L', values: [
                            curve.c[i * 3 + 2].x * scale,
                            curve.c[i * 3 + 2].y * scale,
                        ]
                    }
                ]
            }
            pathData.push(...coms)
        }

        pathData.push({ type: 'Z', values: [] })

    }

    return pathData

}

export function getSVG(pathData, w, h, {
    toRelative = true,
    toShorthands = true,
    decimals = 3,
    addDimensions = false,
} = {}) {


    w = Math.ceil(w);
    h = Math.ceil(h);

    // simplify/cleanup
    /*
    let removeFinalLineto = false;
    let startToTop = false;
    pathData = optimizeStartingPoints(pathData, removeFinalLineto, startToTop);
    pathData = cleanUpPathData(pathData);
    */



    /**
     * optimize pathData
     * apply shorthands where possible
     * convert to relative commnds
     * round
     */
    if (toRelative || toShorthands || decimals != -1) pathData = convertPathData(pathData, { toRelative, toShorthands, decimals });


    let d = pathDataToD(pathData, decimals)

    // Add explicit dimension attributes sometimes reasonable for graphic editors
    let dimAtts = addDimensions ? `width="${w}" height="${h}" ` : '';

    let svg = `<svg viewBox="0 0 ${w} ${h}" ${dimAtts}xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`;

    return { svg, d }

}



/**
* serialize pathData array to 
* d attribute string 
*/
export function pathDataToD(pathData, decimals = -1, minify = false) {
    // implicit l command
    if (pathData[1].type === "l" && minify) {
        pathData[0].type = "m";
    }
    let d = `${pathData[0].type}${pathData[0].values.join(" ")}`;

    for (let i = 1; i < pathData.length; i++) {
        let com0 = pathData[i - 1];
        let com = pathData[i];

        let type = (com0.type === com.type && minify) ?
            " " : (
                (com0.type === "m" && com.type === "l") ||
                (com0.type === "M" && com.type === "l") ||
                (com0.type === "M" && com.type === "L")
            ) && minify ?
                " " : com.type;

        // round
        if (com.values.length && decimals > -1) {
            com.values = com.values.map(val => { return +val.toFixed(decimals) })
        }
        d += `${type}${com.values.join(" ")}`;
    }


    if (minify) {
        d = d
            .replaceAll(" 0.", " .")
            .replaceAll(" -", "-")
            .replaceAll("-0.", "-.")
            .replace(/\s+([mlcsqtahvz])/gi, "$1")
            .replaceAll("Z", "z");
    }

    return d;
}