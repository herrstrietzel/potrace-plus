
/**
 * avoids starting points in the middle of 2 smooth curves
 * can replace linetos with closepaths
 */


import { shiftSvgStartingPoint } from "../pathData_reorder";

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
