import { splitSubpaths, addExtemesToCommand } from './pathData_split.js';
import { getComThresh, commandIsFlat, getPathDataVertices, getSquareDistance } from '../geometry.js';
import { getPolyBBox } from '../geometry_bbox.js';


import { renderPoint, renderPath } from '../visualize.js';



export function pathDataToTopLeft(pathData, removeFinalLineto = false, startToTop = true) {

    let pathDataNew = [];
    let len = pathData.length;
    let M = { x: pathData[0].values[0], y: pathData[0].values[1] }
    let isClosed = pathData[len - 1].type.toLowerCase() === 'z'


    // we can't change starting point for non closed paths
    if (!isClosed) {
        return pathData
    }

    let newIndex = 0

    if (startToTop) {
        //get top most index
        let indices = [];
        for (let i = 0, len = pathData.length; i < len; i++) {
            let com = pathData[i];
            let { type, values } = com;
            if (values.length) {

                let valsL = values.slice(-2)
                let p = { x: valsL[0], y: valsL[1], dist: 0, index: 0 }
                p.index = i
                indices.push(p)
            }
        }

        // find top most
        indices = indices.sort((a, b) => a.x - b.x || a.y - b.y);
        newIndex = indices[0].index

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



/**
 * shift starting point
 */
export function shiftSvgStartingPoint(pathData, offset) {
    let pathDataL = pathData.length;
    let newStartIndex = 0;
    let lastCommand = pathData[pathDataL - 1]["type"];
    let isClosed = lastCommand.toLowerCase() === "z";

    if (!isClosed || offset < 1 || pathData.length < 3) {
        return pathData;
    }

    //exclude Z/z (closepath) command if present
    let trimRight = isClosed ? 1 : 0;


    // add explicit lineto
    addClosePathLineto(pathData)


    // M start offset
    newStartIndex =
        offset + 1 < pathData.length - 1
            ? offset + 1
            : pathData.length - 1 - trimRight;

    // slice array to reorder
    let pathDataStart = pathData.slice(newStartIndex);
    let pathDataEnd = pathData.slice(0, newStartIndex);

    // remove original M
    pathDataEnd.shift();
    let pathDataEndL = pathDataEnd.length;

    let pathDataEndLastValues, pathDataEndLastXY;
    pathDataEndLastValues = pathDataEnd[pathDataEndL - 1].values || [];
    pathDataEndLastXY = [
        pathDataEndLastValues[pathDataEndLastValues.length - 2],
        pathDataEndLastValues[pathDataEndLastValues.length - 1]
    ];


    //remove z(close path) from original pathdata array
    if (trimRight) {
        pathDataStart.pop();
        pathDataEnd.push({
            type: "Z",
            values: []
        });
    }
    // prepend new M command and concatenate array chunks
    pathData = [
        {
            type: "M",
            values: pathDataEndLastXY
        },
        ...pathDataStart,
        ...pathDataEnd,
    ]


    return pathData;
}



/**
 * Add closing lineto:
 * needed for path reversing or adding points
 */

export function addClosePathLineto(pathData) {
    let pathDataL = pathData.length;
    let closed = pathData[pathDataL - 1]["type"] == "Z" ? true : false;

    let M = pathData[0];
    let [x0, y0] = [M.values[0], M.values[1]].map(val => { return +val.toFixed(8) });
    let lastCom = closed ? pathData[pathDataL - 2] : pathData[pathDataL - 1];
    let lastComL = lastCom.values.length;
    let [xE, yE] = [lastCom.values[lastComL - 2], lastCom.values[lastComL - 1]].map(val => { return +val.toFixed(8) });

    if (closed && (x0 != xE || y0 != yE)) {

        pathData.pop();
        pathData.push(
            {
                type: "L",
                values: [x0, y0]
            },
            {
                type: "Z",
                values: []
            }
        );
    }

    return pathData;
}


