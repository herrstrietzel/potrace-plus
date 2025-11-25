export {
    abs, acos, asin, atan, atan2, ceil, cos, exp, floor, hypot,
    log, max, min, pow, random, round, sin, sqrt, tan, PI
} from './constants';


import { getBmp, svg2BmpData } from './bitmap';
import { potraceGetPathList } from './main';
import { getPotracePathData, getSVG } from './svg';


export function PotraceObj(data = {}) {
    Object.assign(this, data)
}



PotraceObj.prototype.getSVG = function () {
    return this.svg
}

PotraceObj.prototype.getPathData = function () {
    return this.pathData
}

PotraceObj.prototype.getD = function () {
    return this.d
}


export async function Potrace(input, {

    // potrace
    turnpolicy = "majority",
    turdsize = 1,
    optcurve = true,
    alphamax = 1,
    opttolerance = 1,

    // size adjustments
    minSize = 1000,
    maxSize = 5000,
    scale = 1,

    // svg processing
    addDimensions = true,
    toRelative = true,
    toShorthands = true,
    decimals = 3

} = {}) {


    /**
     * normalize input
     * img element (raster/svg)
     * canvas element
     * file
     */

    let bmpData = await getBmp(input, {minSize, maxSize, scale});


    // get image properties
    let { bmp, scaleAdjust, width, height } = bmpData;


    console.log(minSize, maxSize, bmpData);


    /**
     * trace
     * get pathData (and stringified "d")
     * and svg markup
     */
    let pathList = potraceGetPathList(bmp, { turnpolicy, turdsize, optcurve, alphamax, opttolerance, scaleAdjust, minSize, maxSize });


    /**
     * get pathData (and stringified "d")
     * and svg markup
     */

    // scale back
    scale = 1 / scaleAdjust

    console.log(toRelative, toShorthands, decimals);

    // get SVG data
    let pathData = getPotracePathData(pathList, scale)
    let pathDataNorm = JSON.parse(JSON.stringify(pathData))
    let data = getSVG(pathData, width, height, { addDimensions, toRelative, toShorthands, decimals });
    data.pathData = pathData;

    data.scaleAdjust = scaleAdjust;

    // absolute pathData
    data.pathDataNorm = pathDataNorm;

    console.log('!!!data', data, pathData);


    // return object
    return new PotraceObj(data);

}

if (typeof window !== 'undefined') {
    window.Potrace = Potrace;
}
