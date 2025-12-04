export {
    abs, acos, asin, atan, atan2, ceil, cos, exp, floor, hypot,
    log, max, min, pow, random, round, sin, sqrt, tan, PI
} from './constants';


import { getBmp, svg2Canvas } from './bitmap';
import { potraceGetPathList } from './potrace_pathlist';
import { getPotracePathData, getSVG } from './svg';


export function PotraceObj(data = {}) {
    Object.assign(this, data)
}



PotraceObj.prototype.getSVG = function (split=false) {
    return !split ? this.svg : this.svgSplit;
}

PotraceObj.prototype.getPathData = function () {
    return this.pathData
}

PotraceObj.prototype.getD = function () {
    return this.d
}


export async function PotracePlus(input, {

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

    //filters
    brightness = 1,
    contrast = 1,
    invert = 0,
    blur=0,

    // svg processing
    crop = true,

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

    let bmpData = await getBmp(input, { minSize, maxSize, crop, scale, brightness, contrast, invert, blur });


    // get image properties
    let { bmp, scaleAdjust, width, height } = bmpData;
    //console.log(minSize, maxSize, bmpData);


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


    // get SVG data
    let pathData = getPotracePathData(pathList, scale)

    if (!pathData.length) {
        throw new Error("Couldn't trace image")
        //return false;
    }

    let pathDataNorm = JSON.parse(JSON.stringify(pathData))
    let data = getSVG(pathData, width, height, { addDimensions, toRelative, toShorthands, decimals });
    data.width = width;
    data.height = height;
    data.commands = pathData.length;

    data.scaleAdjust = scaleAdjust;

    // absolute pathData
    data.pathDataNorm = pathDataNorm;

    //console.log('!!!data', data, pathData);

    // return object
    return new PotraceObj(data);

}

export { svg2Canvas as svg2Canvas };

if (typeof window !== 'undefined') {
    window.PotracePlus = PotracePlus;
    window.svg2Canvas = svg2Canvas;
}
