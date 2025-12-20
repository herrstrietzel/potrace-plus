//import { imageDataTo1Bit } from "./bitmap_convert";
import { getBBox_fromCtx, getBBox_fromImageData } from "./canvas_getBBox";


/**
 * convert inputs to digestable
 * 1-bit (black and white) image data
 */

export async function getBmp(input, {
    minSize = 1000,
    maxSize = 5000,
    filter = '',
    scale = 1,
    stripWhite = true,
    crop = true,

    canvas = null,

    //filters
    brightness = 1,
    contrast = 1,
    invert = false,
    blur = 0,



} = {}) {


    let type = detectInputType(input);
    //console.log('type', type, input);

    let settings = { minSize, maxSize, filter, scale, brightness, contrast, invert, blur, canvas }
    let canvasImgData, src;

    if (type === 'img') {
        src = input.src;
        canvasImgData = await imgDataFromSrc(src, settings);
    }

    else if (type === 'blob' || type === 'file') {
        src = await URL.createObjectURL(input);
        canvasImgData = await imgDataFromSrc(src, settings);
    }


    else if (type === 'url') {
        src = input;
        console.log('is URL', input);
        canvasImgData = await imgDataFromSrc(src, settings);
    }


    else if (type === 'svg') {
        // object URL from element - add missing dimensions
        src = await objectUrlFromSVG(input)
        canvasImgData = await imgDataFromSrc(src, settings);
        //URL.revokeObjectURL(src)
    }

    else if (type === 'canvas') {
        let ctx = input.getContext('2d');

        invert = !invert ? '0' : '1';
        let filter = `grayscale(1) invert(${invert}) blur(${blur}px) brightness(${brightness}) contrast(${contrast})`;
        ctx.filter = filter;


        let ctxImgData = await ctx.getImageData(0, 0, input.width, input.height);
        canvasImgData = {
            imgData: ctxImgData,
            width: ctxImgData.width,
            height: ctxImgData.height,
            scaleAdjust: 1
        }
    }

    let { imgData, scaleAdjust, width, height } = canvasImgData;


    /**
     * crop and 
     * convert to 1-bit 
     */

    // null bbox for no cropping
    let bb = { x: 0, y: 0, width: 0, height: 0 };

    if (crop) {

        bb = getBBox_fromImageData(imgData, stripWhite)

        // update dimensions
        width = Math.ceil(bb.width / scaleAdjust)
        height = Math.ceil(bb.height / scaleAdjust)

        canvasImgData.width = width;
        canvasImgData.height = height;
    }


    // create 1-bit array
    let bmp = imageDataTo1Bit(imgData, bb.x, bb.y, bb.width, bb.height)
    //console.log('bmp', bmp);

    return { bmp, scaleAdjust, width, height }
}





/**
 * render src to
 * canvas to retrieve
 * image data
 */

async function imgDataFromSrc(src = '',
    { minSize = 1000,
        maxSize = 5000,
        scale = 1,
        brightness = 1,
        contrast = 1,
        invert = 0,
        blur = 0,
        canvas = null
    } = {}) {

    let img, w, h, imgData;

    // used to get a reasonable rendering size
    let scaleAdjust = 1;

    // scaled dimensions
    let dimMin = 0;

    // increase size limits via scale
    minSize *= scale
    maxSize *= scale

    // create new canvas
    if (!canvas) {
        canvas = document.getElementById('canvasPot');
        if (!canvas) canvas = document.createElement('canvas');

        canvas.id = 'canvasPot';
        //canvas.classList.add('sr-only');
        document.body.append(canvas)

    }

    //let ctx = canvas.getContext('2d');
    let ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });

    //fetch src
    let res = await fetch(src);
    let isRaster;


    if (res.ok) {
        let blob = await res.blob();

        //check mime-type
        let { type } = blob;

        // is raster image
        if (type !== 'image/svg+xml') {
            isRaster = true;
            img = await createImageBitmap(blob);
            [w, h] = [img.width, img.height];
        }
        // svg image src
        else {
            //console.log('is svg');
            img = new Image();
            img.src = src;
            img.crossOrigin = "anonymous";

            // wait for image
            await img.decode();
            [w, h] = [img.naturalWidth, img.naturalHeight]

        }

        dimMin = Math.min(w, h);

        // scale up or down
        scaleAdjust = (!isRaster && (dimMin < minSize || dimMin > maxSize)) ? minSize / dimMin : 1;

        w *= scaleAdjust
        h *= scaleAdjust

        // adjust canvas size
        canvas.width = w;
        canvas.height = h;


        /**
         * flatten transparency
         */
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, w, h);


        /**
         * apply filters
         * we always convert to grayscale
         */
        invert = !invert ? '0' : '1';
        let filter = `grayscale(1) invert(${invert}) blur(${blur}px) brightness(${brightness}) contrast(${contrast})`;
        ctx.filter = filter;


        ctx.drawImage(img, 0, 0, w, h);
        imgData = ctx.getImageData(0, 0, w, h);

    }


    // add dimensions
    let { width, height } = imgData;
    width = Math.ceil(width / scaleAdjust)
    height = Math.ceil(height / scaleAdjust)

    return { imgData, scaleAdjust, width, height }

}






export async function svg2Canvas(el, { minSize = 1000, maxSize = 5000, filter = '', scale = 1, canvas = null } = {}) {

    // create canvas
    if (!canvas) canvas = document.createElement('canvas');
    let objectUrl = await objectUrlFromSVG(el);

    // create temporary image
    let tmpImg = new Image();
    tmpImg.src = objectUrl;
    tmpImg.crossOrigin = "anonymous";

    // wait for image
    await tmpImg.decode();

    let [w, h] = [tmpImg.naturalWidth, tmpImg.naturalHeight];

    // scale up or down
    let dimMin = Math.min(w, h);
    let scaleAdjust = dimMin < minSize || dimMin > maxSize ? minSize / dimMin : 1;

    let wS = w * scaleAdjust
    let hS = h * scaleAdjust

    canvas.width = wS;
    canvas.height = hS;

    let ctx = canvas.getContext("2d");

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, wS, hS);

    // apply filter to enhance contrast
    if (filter) {
        ctx.filter = filter;
    }
    ctx.drawImage(tmpImg, 0, 0, wS, hS);
    URL.revokeObjectURL(objectUrl);

    return canvas;

}






export function detectInputType(input) {
    if (input instanceof HTMLImageElement) return "img";
    if (input instanceof SVGElement) return "svg";
    if (input instanceof HTMLCanvasElement) return "canvas";
    if (input instanceof File) return "file";
    if (input instanceof ArrayBuffer) return "buffer";
    if (input instanceof Blob) return "blob";
    if (Array.isArray(input)) return "array";

    if (typeof input === "string") {
        let url = /^(file:|https?:\/\/|\/|\.\/|\.\.\/)/.test(input);
        let dataUrl = input.startsWith('data:image');
        return url || dataUrl ? "url" : "string";
    }

    let type = typeof input
    let constructor = input.constructor.name

    return (constructor || type).toLowerCase();
}





export async function objectUrlFromSVG(el) {
    /**
     * clone svg to add width and height
     * for better compatibility
     * without affecting the original svg
     */
    const svgEl = el.cloneNode(true);
    document.body.append(svgEl)

    if (!svgEl.hasAttribute('width') && !svgEl.hasAttribute('height')) {

        // get intrinsic dimensions
        let bb = !svgEl.hasAttribute('viewBox') ? el.getBBox() : { x: 0, y: 0, width: 300, height: 150 };

        let width = el.viewBox.baseVal.width ?
            svgEl.viewBox.baseVal.width :
            el.width.baseVal.value ?
                el.width.baseVal.value :
                bb.width;
        let height = el.viewBox.baseVal.height ?
            svgEl.viewBox.baseVal.height :
            el.height.baseVal.value ?
                el.height.baseVal.value :
                bb.height;


        // add width and height for firefox compatibility
        svgEl.setAttribute("width", width);
        svgEl.setAttribute("height", height);
    }


    // create blob
    let svgString = new XMLSerializer().serializeToString(svgEl);
    let blob = new Blob([svgString], {
        type: "image/svg+xml"
    });

    //console.log(blob);
    let objectUrl = URL.createObjectURL(blob);
    svgEl.remove();
    return objectUrl;

}



/**
 * get black and white bitmap data
 */

export function imageDataTo1Bit(imageData, dx = 0, dy = 0, w = 0, h = 0) {
    let { data, width, height } = imageData;

    w = w || width;
    h = h || height;

    // Create bitmap with CROPPED dimensions
    let bmp = new Bitmap(w, h);

    // row width in bytes (4 bytes per pixel)
    let wRow = width * 4;

    let y = 0; // output row counter

    for (let row = dy; row < dy + h; row++) {
        let x = 0;
        let rowStartIdx = row * wRow;

        // Iterate through cropped columns
        for (let col = dx; col < dx + w; col++) {
            // Get the color value from the original image
            let pixelIdx = rowStartIdx + (col * 4);
            let color = data[pixelIdx];

            // Write to output bitmap
            let outputIdx = y * w + x;
            bmp.data[outputIdx] = (color < 127 ? 1 : 0);

            x++;
        }
        y++;
    }

    return bmp;
}


export function Bitmap(w, h) {
    this.w = w;
    this.h = h;
    this.size = w * h;
    this.arraybuffer = new ArrayBuffer(this.size);
    this.data = new Int8Array(this.arraybuffer);
}

Bitmap.prototype.at = function (x, y) {
    return (x >= 0 && x < this.w && y >= 0 && y < this.h) &&
        this.data[this.w * y + x] === 1;
};

Bitmap.prototype.index = function (i) {
    let pt = { x: 0, y: Math.floor(i / this.w) };
    pt.x = i - pt.y * this.w;
    return pt;
};

Bitmap.prototype.flip = function (x, y) {
    if (this.at(x, y)) {
        this.data[this.w * y + x] = 0;
    } else {
        this.data[this.w * y + x] = 1;
    }
};

Bitmap.prototype.copy = function () {
    let bmp = new Bitmap(this.w, this.h), i;
    for (i = 0; i < this.size; i++) {
        bmp.data[i] = this.data[i];
    }
    return bmp;
};
