

/**
 * get "raw" SVG pathData
 * converts internal path list to 
 * SVG path data array
 */

import { getPathDataVertices, isPointInPolygon } from "./geometry";
import { getPathArea, getPolygonArea } from "./geometry_area";
import { checkBBoxIntersections, getPathDataBBox } from "./geometry_bbox";
import { cleanUpPathData, optimizeStartingPoints } from "./pathdata_cleanup";
import { convertPathData, pathDataToRelative } from "./pathData_convert";
import { reorderPathData } from "./pathData_reorder";
import { addExtremePoints, splitSubpaths } from "./pathData_split";

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



    /**
     * decompose compound path
     */
    let pathDataCloned = JSON.parse(JSON.stringify(pathData))
    //pathDataCloned = addExtremePoints(pathDataCloned);
    let pathDataSorted = reorderPathData(pathDataCloned);
    let pathDataArray = splitSubpaths(pathDataSorted);



    /**
     * analyze subpaths
     * get bounding boxes 
     * and poly approximation for 
     * overlap checking
     */

    let subPathArr = []
    let l = pathDataArray.length;

    for (let i = 0; i < l; i++) {
        let pathData = pathDataArray[i]

        // add extreme points for better poly approximation
        let pathDataExt = addExtremePoints(JSON.parse(JSON.stringify(pathData)))
        let bb = getPathDataBBox(pathDataExt)
        let poly = getPathDataVertices(pathDataExt)
        subPathArr.push({ pathData, bb, poly, includes: [] })
    }



    /**
     * check overlapping 
     * sub paths
     */
    for (let i = 0, l = subPathArr.length; i < l; i++) {
        let sub1 = subPathArr[i];
        let { bb, poly } = sub1;

        for (let j = 0; j < l; j++) {

            let sub1 = subPathArr[j];
            if (i === j) continue;

            let [bb1, poly1] = [sub1.bb, sub1.poly];

            // sloppy bbox intersection test
            let intersects = checkBBoxIntersections(bb, bb1);
            if (!intersects) continue;


            // test sample on-path points
            let ptM = { x: bb1.x + bb1.width * 0.5, y: bb1.y + bb1.height * 0.5 }
            let pt2 = poly1[0]
            let pt3 = poly1[Math.floor(poly1.length / 2)];
            let pt4 = poly1[poly1.length - 1];

            let pts = [ptM, pt2, pt3, pt4];
            let inPoly = false;

            for (let i = 0; i < pts.length; i++) {
                let pt = pts[i];
                if (isPointInPolygon(pt, poly, bb, true)) {
                    inPoly = true;
                    break
                }
            }

            //inPoly
            if (inPoly) {
                subPathArr[i].includes.push(j)
            }
        }
    }


    /**
     * combine overlapping 
     * compound paths
     */
    for (let i = 0, l = subPathArr.length; i < l; i++) {
        let sub = subPathArr[i];
        let { includes } = sub;

        includes.forEach(s => {
            let sub1 = subPathArr[s].pathData
            if (sub1.length) {
                subPathArr[i].pathData.push(...sub1)
                subPathArr[s].pathData = []
            }
        })
    }

    // remove empty els
    subPathArr = subPathArr.filter(sub => sub.pathData.length)
    //console.log('!!!subPathArr', subPathArr);

    // Add explicit dimension attributes sometimes reasonable for graphic editors
    let dimAtts = addDimensions ? `width="${w}" height="${h}" ` : '';

    let svgSplit = `<svg viewBox="0 0 ${w} ${h}" ${dimAtts}xmlns="http://www.w3.org/2000/svg">`;
    let dArr = []
    subPathArr.forEach(sub => {
        let { pathData } = sub;
        //let pathData  = sub;
        try {
            if (toRelative || toShorthands || decimals != -1) pathData = convertPathData(pathData, { toRelative, toShorthands, decimals });
            let d = pathDataToD(pathData, decimals)
            //console.log(d);
            dArr.push(d)
            svgSplit += `<path d="${d}"/>`

        } catch {
            console.log('catch', pathData);
        }
    })

    svgSplit += '</svg>';


    /**
     * optimize pathData
     * apply shorthands where possible
     * convert to relative commnds
     * round
     */
    if (toRelative || toShorthands || decimals != -1) pathData = convertPathData(pathData, { toRelative, toShorthands, decimals });


    let d = pathDataToD(pathData, decimals)

    let svg = `<svg viewBox="0 0 ${w} ${h}" ${dimAtts}xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`;

    return { svg, d, svgSplit, dArr, pathData }

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