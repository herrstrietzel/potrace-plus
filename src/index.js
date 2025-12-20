export {
    abs, acos, asin, atan, atan2, ceil, cos, exp, floor, hypot,
    log, max, min, pow, random, round, sin, sqrt, tan, PI
} from './constants';


import { getBmp, svg2Canvas } from './potrace_bitmap';
import { potraceGetPathList } from './potrace_pathlist';
//import { getSVG } from './potrace_svg';

//import { cleanUpPathData } from './pathdata/pathdata_cleanup';
import { getSVG } from './potrace_svg';
import {pathDataToD} from "./pathdata/pathData_stringify";

import { fixPathData } from './pathdata/pathdata_cleanup2';
import { getPotracePathData } from './pathdata/pathData_from_potrace_Pathlist';

export function PotraceObj(data = {}) {
    Object.assign(this, data)
}


PotraceObj.prototype.getSVG = function (split=false) {
    return !split ? this.svg : this.svgSplit;
}

PotraceObj.prototype.getPathData = function () {
    return this.pathDataNorm
}

PotraceObj.prototype.getPathDataNorm = function () {
    return this.pathDataNorm
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
    optimize = false,

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
    let {pathList, polygons} = potraceGetPathList(bmp, { turnpolicy, turdsize, optcurve, alphamax, opttolerance, scaleAdjust, minSize, maxSize });


    /**
     * get pathData (and stringified "d")
     * and svg markup
     */

    // scale back
    scale = 1 / scaleAdjust


    // get SVG data
    let pathDataArray= getPotracePathData(pathList, scale)
    let pathData = pathDataArray.flat()

    if (!pathData.length) {
        throw new Error("Couldn't trace image")
        //return false;
    }

    let data = getSVG(pathDataArray, width, height, { addDimensions, toRelative, toShorthands, optimize, decimals });
    /*
    data.width = width;
    data.height = height;
    data.commands = data.pathData.length;
    */

    data.scaleAdjust = scaleAdjust;

    // return object
    return new PotraceObj(data);

}

export { svg2Canvas as svg2Canvas };
//export {cleanUpPathData as cleanUpPathData}
export {fixPathData as fixPathData}

if (typeof window !== 'undefined') {
    //window.fixPathData = fixPathData;
    window.pathDataToD = pathDataToD;
    //window.cleanUpPathData = cleanUpPathData;
    window.PotracePlus = PotracePlus;
    window.svg2Canvas = svg2Canvas;
}
