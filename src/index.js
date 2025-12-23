export {
    abs, acos, asin, atan, atan2, ceil, cos, exp, floor, hypot,
    log, max, min, pow, random, round, sin, sqrt, tan, PI
} from './constants';


import { Bitmap, getBmp, svg2Canvas, imgDataFromSrc } from './potrace_bitmap';
import { potraceGetPathList } from './potrace_pathlist';
//import { getSVG } from './potrace_svg';

//import { cleanUpPathData } from './pathdata/pathdata_cleanup';
import { getSVG } from './potrace_svg';
import { pathDataToD } from "./pathdata/pathData_stringify";
import { getPotracePathData } from './pathdata/pathData_from_potrace_Pathlist';
import { getExistingPath } from './url/url_helpers';

export function PotraceObj(data = {}) {
    Object.assign(this, data)
}


// get PDF Object URL
PotraceObj.prototype.getPdf = function () {
    const objectURL = URL.createObjectURL(new Blob([this.pdf], { type: 'application/pdf' }))
    return objectURL;
}

PotraceObj.prototype.getSVG = function (split = false) {
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


const PotracePlusWorkerUrl = './potrace-plus.workers.js';


export async function PotracePlus(input, {

    // potrace
    turnpolicy = "majority",
    turdsize = 1,
    optcurve = true,
    alphamax = 1,
    opttolerance = 1,

    // size adjustments
    minSize = 1000,
    maxSize = 2500,
    scale = 1,

    //filters
    brightness = 1,
    contrast = 1,
    invert = 0,
    blur = 0,

    // svg processing
    crop = true,
    optimize = true,
    // minify pathdata d string
    minifyD = true,

    addDimensions = true,
    toRelative = true,
    toShorthands = true,
    decimals = 3,

    // get unoptimized polygon
    getPolygon = true,

    // get PDF data
    getPDF = true,

    // use worker for larger files
    useWorker = false

} = {}) {


    // normalize minify param
    minifyD = parseFloat(minifyD);


    /**
     * normalize input
     * img element (raster/svg)
     * canvas element
     * file
     */

    let bmpData = await getBmp(input, { minSize, maxSize, crop, scale, brightness, contrast, invert, blur });

    // get image properties
    let { bmp, scaleAdjust, width, height, bb, w, h } = bmpData;


    /**
     * enable/disable worker processing 
     * if workers are supported
     * worker files are present
     * image is large
     */
    let largeImg = (w + h) / 2 > 1000;
    if (largeImg) useWorker = true;

    let workerExists = await getExistingPath(PotracePlusWorkerUrl)
    if (!workerExists) {
        console.warn(`Worker JS file does not exist.\nYou can download it from the github repo:\nhttps://raw.githubusercontent.com/herrstrietzel/potrace-plus/refs/heads/main/dist/potrace-plus.workers.js`);
    }

    useWorker = useWorker && typeof Worker === 'undefined' || !workerExists ? false : useWorker;
    //console.log('useWorker',  useWorker, largeImg);

    /**
     * trace
     * get pathData (and stringified "d")
     * and svg markup
     */

    let settings = {
        turnpolicy,
        turdsize,
        optcurve,
        alphamax,
        opttolerance,
        scaleAdjust,
        minSize,
        maxSize,

        width,
        height,
        w,
        h,
        bb,
        addDimensions,
        toRelative,
        toShorthands,
        optimize,
        minifyD,
        decimals,
        getPolygon,
        getPDF,
    }

    // get potrace pathlist 
    let type = 'pathlist';

    let pathListData = (!useWorker ? potraceGetPathList(bmp, settings) : await potrace_worker(type, { bmp, options: settings }));
    let { pathList, polygons } = pathListData;


    /**
     * get pathData (and stringified "d")
     * and svg markup
     */

    scale = 1 / scaleAdjust // scale back resized

    let svgData = {};
    type = 'svgData';
    let paramsSvg = {
        pathList,
        polygons,
        scale,
        scaleAdjust,
        ...settings
    }

    svgData = !useWorker ? getSVGData(paramsSvg) : await potrace_worker(type, paramsSvg);

    return new PotraceObj(svgData);

}


export function getSVGData({
    pathList = [],
    width = 0,
    height = 0,
    w = 0,
    h = 0,
    bb = { x: 0, y: 0, width: 0, height: 0 },
    scale = 1,
    scaleAdjust = 1,
    polygons = [],
    getPolygon = false,
    addDimensions = true,
    toRelative = true,
    toShorthands = true,
    optimize = true,
    minifyD = 0,
    decimals = 3,
    getPDF = true
} = {}) {


    // get SVG data
    let pathDataArray = getPotracePathData(pathList, scale)
    let pathData = pathDataArray.flat()

    if (!pathData.length) {
        throw new Error("Couldn't trace image")
    }

    let data = getSVG(pathDataArray, width, height, { addDimensions, toRelative, toShorthands, optimize, minifyD, decimals, getPDF });

    data.scaleAdjust = scaleAdjust;
    data.bb = bb
    data.w = w
    data.h = h
    data.polygons = getPolygon ? polygons : [];
    return data;
}

export function potrace_worker(type = "pathlist", data = {}) {

    return new Promise((resolve, reject) => {

        let worker = new Worker(
            new URL(PotracePlusWorkerUrl, import.meta.url),
            { type: 'module' }
        );

        // send request
        worker.postMessage({ type, data });

        worker.onmessage = (e) => {
            let { result, error } = e.data;
            worker.terminate();

            if (error) reject(new Error(error));
            else resolve(result);
        };

        worker.onerror = (err) => {
            worker.terminate();
            reject(err);
        };



    });
}


export { Bitmap as Bitmap }
export { potraceGetPathList as potraceGetPathList }
export { imgDataFromSrc as imgDataFromSrc }

//export {runPotraceInWorker as runPotraceInWorker}
export { svg2Canvas as svg2Canvas };

if (typeof window !== 'undefined') {
    window.pathDataToD = pathDataToD;
    window.PotracePlus = PotracePlus;
    window.imgDataFromSrc = imgDataFromSrc;
    //window.runPotraceInWorker = runPotraceInWorker;
    window.potraceGetPathList = potraceGetPathList;
    window.svg2Canvas = svg2Canvas;
}
