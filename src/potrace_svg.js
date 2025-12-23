

/**
 * get "raw" SVG pathData
 * converts internal path list to 
 * SVG path data array
 */

import { getPathDataVertices, isPointInPolygon } from "./geometry";
//import { getPathArea, getPolygonArea } from "./geometry_area";
import { checkBBoxIntersections, getPathDataBBox } from "./geometry_bbox";
//import { cleanUpPathData, optimizeStartingPoints } from "./pathdata/pathdata_cleanup";
import { convertPathData } from "./pathdata/pathData_convert";

// optimizations
import { pathDataToTopLeft } from "./pathdata/pathData_reorder";
import { removeZeroLengthLinetos } from "./pathdata/pathData_remove_zerolength";
import { pathDataRemoveColinear } from "./pathdata/pathData_remove_collinear";


//import { reorderPathData } from "./pathdata/pathData_reorder";
//import { addExtremePoints, splitSubpaths } from "./pathdata/pathData_split";

import { pathDataToD } from "./pathdata/pathData_stringify";
import { pathDataArrayToPDF, pathDataToPDF } from "./pathdata/pathData_to_pdf";

export function getSVG(pathDataArray, width, height, {
    toRelative = true,
    toShorthands = true,
    decimals = 3,
    addDimensions = false,
    optimize = true,
    getPDF= true,
    minifyD = true,
} = {}) {


    width = Math.ceil(width);
    height = Math.ceil(height);

    /**
     * analyze subpaths
     * and poly approximation for 
     * overlap checking
     */

    let subPathArr = []
    let l = pathDataArray.length;
    let includeCpts = true;

    for (let i = 0; i < l; i++) {
        let pathData = pathDataArray[i]

        // we already know the bbox from Potrace
        let bb = pathData[0].bb;

        // include control points for better overlapping approximation
        let poly = getPathDataVertices(pathData, includeCpts)
        subPathArr.push({ pathData, bb, poly, includes: [] })
    }



    /**
     * optimize:
     * starting point
     * remove colinear/flat segments
     */
    if (optimize) {
        for (let i = 0, l = subPathArr.length; i < l; i++) {

            let { pathData, bb } = subPathArr[i];

            // remove zero length linetos
            pathData = removeZeroLengthLinetos(pathData)

            // sort to top left
            pathData = pathDataToTopLeft(pathData);

            // remove colinear/flat
            pathData = pathDataRemoveColinear(pathData);

            // update
            subPathArr[i].pathData = pathData
        }
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
            let pathData = subPathArr[s].pathData;
            if (pathData.length) {
                subPathArr[i].pathData.push(...pathData)
                subPathArr[s].pathData = []
            }
        })
    }


    // remove empty els due to grouping
    subPathArr = subPathArr.filter(sub => sub.pathData.length)

    // clone sub pathdata array
    let pathDataArr = JSON.parse(JSON.stringify(subPathArr)).map(pd => pd.pathData);

    // flat path data 
    let pathData = JSON.parse(JSON.stringify(pathDataArr)).flat();


    // Add explicit dimension attributes sometimes reasonable for graphic editors
    let dimAtts = addDimensions ? `width="${width}" height="${height}" ` : '';

    let svgSplit = `<svg viewBox="0 0 ${width} ${height}" ${dimAtts}xmlns="http://www.w3.org/2000/svg">`;
    let dArr = []
    subPathArr.forEach(sub => {
        let { pathData } = sub;
        //let pathData  = sub;
        try {
            if (toRelative || toShorthands || decimals != -1) {
                pathData = convertPathData(pathData, { toRelative, toShorthands, decimals });
            }
            let d = pathDataToD(pathData, minifyD)

            dArr.push(d)
            svgSplit += `<path d="${d}"/>`

        } catch {
            console.warn('catch pathdata could not be parsed', pathData);
        }
    })

    svgSplit += '</svg>';


    /**
     * combined pathData-  single path
     * optimize pathData
     * apply shorthands where possible
     * convert to relative commnds
     * round
     */

    if (toRelative || toShorthands || decimals != -1) pathData = convertPathData(pathData, { toRelative, toShorthands, decimals });
    let d = pathDataToD(pathData, minifyD)
    let svg = `<svg viewBox="0 0 ${width} ${height}" ${dimAtts}xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`;

    // generate PDF output
    let pdf = '';
    if(getPDF){
        try {
            pdf = pathDataArrayToPDF(pathDataArr, { width, height })
        } catch {
            console.warn('pdf generation failed');
        }
    }

    return { width, height, commands: pathData.length, svg, d, svgSplit, dArr, pathData, pathDataArr, pdf }

}





