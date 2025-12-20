//import { quadratic2Cubic } from './convert.js';
//import { splitSubpaths, shiftSvgStartingPoint } from './convert_segments.js';
import { shiftSvgStartingPoint, reorderPathData } from '../pathData_reorder.js';
import { splitSubpaths, addExtemesToCommand } from '../pathData_split.js';
import { getComThresh, commandIsFlat, getPathDataVertices, getSquareDistance } from '../../geometry.js';

import { getPolyBBox } from '../../geometry_bbox.js';
import { renderPoint } from '../../visualize.js';






/**
 * remove zero length commands
 * replace flat beziers with lintos
 * replace closing lines with z
 * rearrange commands to avoid unnessessary linetos
 */


export function cleanUpPathData(pathData, addExtremes = false, removeClosingLines = true, startToTop = true, debug = false) {

    //collect logs
    let simplyfy_debug_log = [];

    // clone pathData
    pathData = JSON.parse(JSON.stringify(pathData));

    // reorder subpaths to top-left first
    pathData = reorderPathData(pathData);


    //optimize starting point to top-left
    pathData = optimizeStartingPoints(pathData, removeClosingLines, startToTop);


    // begin with M - starting point
    let pathDataNew = [pathData[0]];

    /**
     * get poly bbox to define
     * an appropriate relative threshold
     * for flat or short segment detection
     */
    let pathPoly = getPathDataVertices(pathData);
    let bb = getPolyBBox(pathPoly)
    let { width, height } = bb;
    let tolerance = (width + height) / 2 * 0.001


    // previous on path point
    let p0 = { x: pathData[0].values[0], y: pathData[0].values[1] };
    let M = { x: pathData[0].values[0], y: pathData[0].values[1] };


    for (let c = 1, len = pathData.length; len && c < len; c++) {
        let com = pathData[c];
        let comN = pathData[c + 1] ? pathData[c + 1] : '';
        let { type, values } = com;
        //let typeRel = type.toLowerCase();
        let valsL = values.slice(-2);
        let p = { x: valsL[0], y: valsL[1] };

        // segment command points - including previous final on-path
        let pts = [p0, p]
        if (type === 'C' || type === 'Q') pts.push({ x: values[0], y: values[1] })
        if (type === 'C') pts.push({ x: values[2], y: values[3] })


        // get relative threshold based on averaged command dimensions
        let xArr = pts.map(pt => { return pt.x });
        let yArr = pts.map(pt => { return pt.y });
        let xMax = Math.max(...xArr)
        let xMin = Math.min(...xArr)
        let yMax = Math.max(...yArr)
        let yMin = Math.min(...yArr)

        let w = xMax - xMin
        let h = yMax - yMin
        let dimA = (w + h) / 2 || 0;

        if (type.toLowerCase() !== 'z') {

            // zero length
            if ((p.x === p0.x && p.y === p0.y) || (type === 'L' && dimA < tolerance)) {
                //console.log('zero', com, dimA, tolerance, w, h);
                if (debug) simplyfy_debug_log.push(`removed zero length ${type}`)
                continue
            }

            /**
             * simplify adjacent linetos
             * based on their flatness
             */
            else if (type === 'L') {

                //unnessecary closing linto
                if (removeClosingLines && p.x === M.x && p.y === M.y && comN.type.toLowerCase() === 'z') {
                    if (debug) simplyfy_debug_log.push(`unnessecary closing linto`)
                    continue
                }


                if (comN.type === 'L') {

                    let valuesNL = comN.values.slice(-2)
                    let pN = { x: valuesNL[0], y: valuesNL[1] }


                    // check if adjacent linetos are flat
                    let flatness = commandIsFlat([p0, p, pN], tolerance)
                    let isFlatN = flatness.flat;


                    // next lineto is flat – don't add command
                    if (isFlatN) {
                        //console.log('flat', flatness, [p0, p, pN]);
                        if (debug) simplyfy_debug_log.push(`remove flat linetos`)
                        continue
                    }
                }
            }


            if (type === 'C') {
                /**
                 * detect flat beziers
                 * often used for morphing 
                 * animation
                 */

                let cp1 = { x: values[0], y: values[1] }
                let cp2 = { x: values[2], y: values[3] }
                let pts = [p0, cp1, cp2, p];

                let flatness = commandIsFlat(pts, tolerance)
                let isFlat = flatness.flat

                //check adjacent flat C - convert to linetos
                if (isFlat) {
                    com = { type: 'L', values: [p.x, p.y] };
                }
            }

        }

        // add new commands
        pathDataNew.push(com);



        if (type.toLowerCase() === "z") {
            p0 = M;
        } else if (type === "M") {
            M = { x: valsL[0], y: valsL[1] };
        }

        // new previous point
        p0 = { x: valsL[0], y: valsL[1] };

    }


    simplyfy_debug_log.push(`original command count: ${pathData.length}; removed:${pathData.length - pathDataNew.length} `)

    if (debug) console.log(simplyfy_debug_log);

    //console.log(pathData.length, pathDataNew.length)
    return pathDataNew;
}


/**
 * avoids starting points in the middle of 2 smooth curves
 * can replace linetos with closepaths
 */

export function pathDataToTopLeft(pathData, removeFinalLineto = false, startToTop = true) {

    let pathDataNew = [];

    // move starting point to first lineto
    //let firstLIndex = pathData.findIndex(cmd => cmd.type === 'L');
    //let firstBezierIndex = pathData.findIndex(cmd => cmd.type === 'C' || cmd.type === 'Q');
    let commands = new Set([...pathData.map(com => com.type)]);
    //let hasLinetos = commands.has('L')
    //let hasBeziers = commands.has('C') || commands.has('Q')


    let len = pathData.length;

    let M = { x: pathData[0].values[0], y: pathData[0].values[1] }
    let isClosed = pathData[len - 1].type.toLowerCase() === 'z'

    /*
    let comL = pathData[len - 1].type.toLowerCase() === 'z' ? pathData[len - 2] : pathData[len - 1]
    let valsL = comL.values.slice(-2)
    let isClosedByCom = M.x===valsL[0] && M.y===valsL[1]
    */

    // we can't change starting point for non closed paths
    if (!isClosed) {
        return pathData
    }


    let extremeIndex = -1;
    let newIndex = 0

    let p0 = { x: 0, y: 0 }

    if (startToTop) {
        //get top most index
        let indices = [];
        for (let i = 0, len = pathData.length; i < len; i++) {
            let com = pathData[i];
            let { type, values } = com;
            if (values.length) {

                let valsL = values.slice(-2)
                let p = { x: valsL[0], y: valsL[1], dist: 0, index: 0 }

                // add square distance
                p.dist = getSquareDistance(p0, p);
                p.index = i

                indices.push(p)

            }
        }

        // find top most
        indices = indices.sort((a, b) => a.dist - b.dist || a.y - b.y);
        newIndex = indices[0].index
        //console.log(indices, newIndex);

    }


    // reorder 
    pathData = shiftSvgStartingPoint(pathData, newIndex)
    len = pathData.length

    // remove last lineto
    let penultimateCom = pathData[len - 2];
    let penultimateType = penultimateCom.type;
    let penultimateComCoords = penultimateCom.values.slice(-2)

    let isClosingCommand = penultimateType === 'L' && penultimateComCoords[0] === M.x && penultimateComCoords[1] === M.y

    if (removeFinalLineto && isClosingCommand) {
        pathData.splice(len - 2, 1)
    }
    pathDataNew.push(...pathData);


    //console.log('pathDataToTopLeft', pathDataNew,  newIndex);
    return pathDataNew
}






export function optimizeStartingPoints(pathData, removeFinalLineto = false, startToTop = false) {

    //console.log(removeFinalLineto, startToTop);

    let pathDataArr = splitSubpaths(pathData);
    //console.log(pathDataArr);

    let pathDataNew = [];
    let len = pathDataArr.length;

    for (let i = 0; i < len; i++) {
        let pathData = pathDataToTopLeft(pathDataArr[i], removeFinalLineto, startToTop)
        pathDataNew.push(...pathData)
    }

    return pathDataNew
}



