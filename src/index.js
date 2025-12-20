export {
    abs, acos, asin, atan, atan2, ceil, cos, exp, floor, hypot,
    log, max, min, pow, random, round, sin, sqrt, tan, PI
} from './constants';


import { getBmp, svg2Canvas } from './potrace_bitmap';
import { potraceGetPathList } from './potrace_pathlist';
//import { getSVG } from './potrace_svg';

//import { cleanUpPathData } from './pathdata/pathdata_cleanup';
import { getSVG } from './potrace_svg';
import { pathDataToD } from "./pathdata/pathData_stringify";
import { getPotracePathData } from './pathdata/pathData_from_potrace_Pathlist';

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
    blur = 0,

    // svg processing
    crop = true,
    optimize = true,

    addDimensions = true,
    toRelative = true,
    toShorthands = true,
    decimals = 3,

    // get unoptimized polygon
    getPolygon = true,

    // get PDF data
    getPDF = true

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


    /**
     * trace
     * get pathData (and stringified "d")
     * and svg markup
     */
    let { pathList, polygons } = potraceGetPathList(bmp, { turnpolicy, turdsize, optcurve, alphamax, opttolerance, scaleAdjust, minSize, maxSize, getPolygon });


    /**
     * get pathData (and stringified "d")
     * and svg markup
     */

    // scale back
    scale = 1 / scaleAdjust

    // get SVG data
    let pathDataArray = getPotracePathData(pathList, scale)
    let pathData = pathDataArray.flat()

    if (!pathData.length) {
        throw new Error("Couldn't trace image")
    }


    let data = getSVG(pathDataArray, width, height, { addDimensions, toRelative, toShorthands, optimize, decimals, getPDF });
    data.scaleAdjust = scaleAdjust;



    /*
    if (getPolygon) {
        // find top-left most and round
        let subPolyIndices = [];

        polygons.forEach((poly,p) => {

            let indices = [];
            poly.forEach((pt, i) => {
                pt.x = +pt.x.toFixed(decimals)
                pt.y = +pt.y.toFixed(decimals)
                pt.index = i;
                indices.push(pt)
            })

            // find top most
            indices = indices.sort((a, b) => a.x - b.x || a.y - b.y);
            let newIndex = indices[0].index;

            polygons[p]= [...poly.slice(newIndex), ...poly.slice(0, newIndex)];

            subPolyIndices.push({x:indices[0].x, y:indices[0].y, index:p} )
            //console.log('newIndex', newIndex);
        })

        subPolyIndices = subPolyIndices.sort((a, b) => a.x - b.x || a.y - b.y);
        let newIndex = subPolyIndices[0].index;
        polygons= [...polygons.slice(newIndex), ...polygons.slice(0, newIndex)];

        console.log(polygons);

        let pointAtts = [];
        polygons.forEach(poly=>{
            //console.log(poly);
            let pointAtt = 'M'+poly.map(pt=>{ return [pt.x, pt.y].join(' ')} ).join(' ');
            console.log(pointAtt);
            pointAtts.push(pointAtt);
        })
        //console.log(pointAtts);
    }
    */


    data.polygons = getPolygon ? polygons : [];

    // return object
    return new PotraceObj(data);

}

export { svg2Canvas as svg2Canvas };

if (typeof window !== 'undefined') {
    window.pathDataToD = pathDataToD;
    window.PotracePlus = PotracePlus;
    window.svg2Canvas = svg2Canvas;
}
