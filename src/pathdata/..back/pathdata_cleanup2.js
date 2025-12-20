import { getPathDataVertices, getSquareDistance } from "../../geometry";
import { getPolyBBox } from "../../geometry_bbox";
import { convertPathData, pathDataToRelative } from "../pathData_convert";
import { pathDataRemoveColinear } from "../pathData_remove_collinear";
import { pathDataToTopLeft2 } from "../pathData_reorder";
import { addExtremePoints, splitSubpaths } from "../pathData_split";
//import { pathDataToD } from "./potrace_svg";
//import { renderPoint } from "./visualize";

export function fixPathData(pathData, {
    addExtremes = false,
    sortSubPaths = true,
    sortCommands = true,
    fixFlatCubics = true,
    removeCollinear = true
} = {}) {

    //console.log('before', pathData.length);
    //return pathData


    //let dT = pathDataToD(convertPathData(pathData, {toRelative:true}))
    //console.log(pathData.length);
    //console.log(dT);


    /*
    let pathPoly = getPathDataVertices(pathData);
    let bb = getPolyBBox(pathPoly)
    console.log('bb', bb);
    */

    let pathDataN = [];

    // find subpaths
    let subPathArr = splitSubpaths(pathData);

    // add more data for bbox
    let subPathData = subPathArr.map(pathData => {
        return { pathData, bb: {}, tolerance: 0 }
    })

    //console.log(subPathData);
    let len = subPathData.length;

    for (let i = 0; i < len; i++) {

        let { pathData } = subPathData[i];
        //console.log(pathData);

        // add extremes - better bbox
        if (addExtremes) {
            let verbose = true
            pathData = addExtremePoints(pathData, verbose)
            subPathData[i].pathData = pathData
        }


        /**
         * get bbox
         */
        let pathPoly = getPathDataVertices(pathData);
        let bb = getPolyBBox(pathPoly)
        let { width, height } = bb;

        // path global tolerance
        subPathData[i].tolerance = (width + height) / 2 * 0.001

        // subpath bbox
        subPathData[i].bb = bb

    }

    /**
     * get total bounding box of compound path
     */
    let xArr = subPathData.map(sub => [sub.bb.x, sub.bb.right]).flat()
    let yArr = subPathData.map(sub => [sub.bb.y, sub.bb.bottom]).flat()

    let left = Math.min(...xArr)
    let right = Math.max(...xArr)

    let top = Math.min(...yArr)
    let bottom = Math.max(...yArr)

    let width = right - left
    let height = bottom - top


    let bb = {
        x: left,
        y: top,
        left,
        top,
        right,
        bottom,
        width,
        height
    }


    /**
     * sort subpaths
     * to top-left
     * potrace messes this up
     */
    let pt0 = { x: bb.x, y: bb.y }
    subPathData.forEach((sub, s) => {
        // distance to top left
        let pt = { x: sub.bb.x, y: sub.bb.y }
        let dist = getSquareDistance(pt0, pt);
        sub.dist = dist

    })

    subPathData.sort((a, b) => a.dist - b.dist || a.bb.y - b.bb.y)

    //svg.setAttribute('viewBox', [bb.x, bb.y, bb.width, bb.height])

    /**
     * remove zero length linetos
     * fix extremes close 
     * to adjacent beziers
     */

    for (let i = 0; i < len; i++) {

        let { pathData, tolerance, bb } = subPathData[i];

        //console.log(pathData.length);

        // remove zero linetos
        pathData = removeZeroLengthLinetos(pathData)

        // sort to top left
        pathData = pathDataToTopLeft2(pathData, { bb });

        //let d= pathDataToD(pathData)
        //console.log(d);

        //console.log('tol', tolerance);
        pathData = pathDataRemoveColinear(pathData);


        //console.log('after', pathData.length);



        pathDataN.push(...pathData)

    }

    pathDataN = convertPathData(pathDataN)

    return pathDataN;

}


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