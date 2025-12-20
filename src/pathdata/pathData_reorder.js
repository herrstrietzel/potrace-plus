import { splitSubpaths, addExtemesToCommand } from './pathData_split.js';
import { getComThresh, commandIsFlat, getPathDataVertices, getSquareDistance } from '../geometry.js';
import { getPolyBBox } from '../geometry_bbox.js';


import { renderPoint, renderPath } from '../visualize.js';



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



/**
 * reorder pathdata by x/y
 */


export function sortPathCommands(pathData, bb = {}) {


}


export function pathDataToTopLeft2(pathData,
    {
        removeFinalLineto = true,
        startToTop = true,
        bb={x:0,y:0,width:0,height:0}
    } = {}
) {

    let pathDataNew = [];

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

    let newIndex = 0

    // top left point
    //let p0 = (!bb.width) ? { x: 0, y: 0 } : {x:bb.x, y:bb.y}

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
                //p.dist = getSquareDistance(p0, p);
                p.index = i
                indices.push(p)

            }
        }

        // find top most
        indices = indices.sort((a, b) => a.y - b.y || a.x - b.x);
        newIndex = indices[0].index
        //console.log('indices:', indices, newIndex);
    }

    // reorder 
    pathData = shiftSvgStartingPoint(pathData, newIndex)
    len = pathData.length

    // update M
    M = { x: pathData[0].values[0], y: pathData[0].values[1] }

    // remove last lineto
    let penultimateCom = pathData[len - 2];
    let penultimateType = penultimateCom.type;
    let penultimateComCoords = penultimateCom.values.slice(-2)

    let tolerance = 0.00001;
    let diffX= Math.abs(penultimateComCoords[0] - M.x);
    let diffY= Math.abs(penultimateComCoords[1] - M.y);

    let isClosingCommand = penultimateType === 'L' && 
    diffX<tolerance && 
    diffY<tolerance

    //console.log('closing', isClosingCommand, penultimateCom, diffX, diffY, 'removeFinalLineto', removeFinalLineto);

    if (removeFinalLineto && isClosingCommand) {
        pathData.splice(len - 2, 1)
    }
    pathDataNew.push(...pathData);


    console.log('pathDataToTopLeft2', pathDataNew );

    return pathDataNew
}





export function reorderPathData(pathData, sortBy = ["x", "y"]) {

    // console.log('reorderPathData');

    // split sub paths
    let pathDataArr = splitSubpaths(pathData);

    // has no sub paths - quit
    if (pathDataArr.length === 1) {
        return pathData
    }

    let subPathArr = [];
    pathDataArr.forEach(function (pathData, i) {
        // get verices from path data final points to approximate bbox
        let polyPoints = getPathDataVertices(pathData, true);
        let bb = getPolyBBox(polyPoints);
        let { x, y, width, height } = bb;

        // collect bbox info
        subPathArr.push({
            x: x,
            y: y,
            width: width,
            height: height,
            index: i
        });
    });


    //sort by x/y
    subPathArr.sort((a, b) => a.x - b.x || a.y - b.y);

    //console.log('subPathArr', subPathArr);

    // compile new path data
    let pathDataSorted = [];
    subPathArr.forEach(function (sub, i) {
        let index = sub.index;
        pathDataSorted.push(...pathDataArr[index]);
    });

    //console.log('subPathsSorted', pathDataSorted);
    return pathDataSorted;
}
