
/**
 * constructors
 */

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





/**
 * convert inputs to digestable
 * 1-bit (black and white) image data
 */

export function detectInputType(input) {
    if (input instanceof HTMLImageElement) return "img";
    if (input instanceof SVGElement) return "svg";
    if (input instanceof HTMLCanvasElement) return "canvas";
    if (input instanceof File) return "file";
    if (input instanceof ArrayBuffer) return "buffer";

    if (typeof input === "string") {
        return /^(file:|https?:\/\/|\/|\.\/|\.\.\/)/.test(input) ? "url" : "string";
    }

    return "unknown";
}



export async function getBmp(input, {
    minSize = 1000,
    maxSize = 5000,
    filter = '',
    scale = 1,
    canvas = null
} = {}) {
    let type = detectInputType(input);
    //console.log('type', type);

    let settings = { minSize, maxSize, filter, scale, canvas }
    //console.log(settings);

    let canvasImgData

    if (type === 'img') {

        let src = input.src;
        canvasImgData = await canvasFromSrc(src, settings);

    }

    else if (type === 'svg') {

        //imgData = await svg2BmpData(input);
    }

    // convert to 1-bit
    let { imgData, scaleAdjust, width, height } = canvasImgData;
    let bmp = imageDataTo1Bit(imgData)

    return { bmp, scaleAdjust, width, height }
}


/**
 * render src to
 * canvas to retrieve
 * image data
 */

async function canvasFromSrc(src = '', { minSize = 1000, maxSize = 5000, filter = '', scale = 1, canvas = null } = {}) {

    let img, w, h, imgData;

    // used to get a reasonable rendering size
    let scaleAdjust = 1;

    // scaled dimensions
    let wS, hS;
    let dimMin = 0;

    // increase size limits via scale
    minSize *= scale
    maxSize *= scale

    // create new canvas
    if (!canvas) canvas = new OffscreenCanvas(300, 150);
    //if (!canvas) canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');

    //fetch src
    let res = await fetch(src);

    if (res.ok) {
        let blob = await res.blob();

        //check mime-type
        let { type } = blob;

        // is raster image
        if (type !== 'image/svg+xml') {
            img = await createImageBitmap(blob);
            [w, h] = [img.width, img.height];

            canvas.width = w;
            canvas.height = h;

            ctx.drawImage(img, 0, 0);
            imgData = ctx.getImageData(0, 0, w, h);
        }
        // svg image src
        else {
            //console.log('is svg');

            img = new Image();
            img.src = src;
            img.crossOrigin = "anonymous";

            // wait for image
            await img.decode();

            w = img.naturalWidth
            h = img.naturalHeight

            dimMin = Math.min(w, h);

            // scale up or down
            scaleAdjust = dimMin < minSize || dimMin > maxSize ? minSize / dimMin : 1;

            wS = w * scaleAdjust
            hS = h * scaleAdjust
            //console.log(w, h, scaleAdjust);

            // adjust canvas size
            canvas.width = wS;
            canvas.height = hS;

            ctx = canvas.getContext("2d");

            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, wS, hS);
            ctx.drawImage(img, 0, 0, wS, hS);

            imgData = ctx.getImageData(0, 0, wS, hS);
        }
    }

    // add dimensions
    let { width, height } = imgData;
    width = Math.ceil(width / scaleAdjust)
    height = Math.ceil(height / scaleAdjust)

    //document.body.append(canvas)

    return { imgData, scaleAdjust, width, height }

}



/*
export async function img2Canvas(input) {
    let img = svg2BmpData(input)
    return img;
}
*/

export async function svg2BmpData(el, filter = "") {
    /**
     *  clone svg to add width and height
     * for better compatibility
     * without affecting the original svg
     */
    const svgEl = el.cloneNode(true);
    document.body.append(svgEl)

    // get dimensions
    let {
        width,
        height
    } = el.getBBox();

    let w = el.viewBox.baseVal.width ?
        svgEl.viewBox.baseVal.width :
        el.width.baseVal.value ?
            el.width.baseVal.value :
            width;
    let h = el.viewBox.baseVal.height ?
        svgEl.viewBox.baseVal.height :
        el.height.baseVal.value ?
            el.height.baseVal.value :
            height;


    // autoscale for better tracing results
    let sidelength = Math.min(w, h)
    let scaledW = 1000
    let scale = scaledW / sidelength > 1 ? scaledW / sidelength : 1;

    // apply scaling
    [w, h] = [w * scale, h * scale];

    // add width and height for firefox compatibility
    svgEl.setAttribute("width", w);
    svgEl.setAttribute("height", h);

    // create canvas
    let canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    // create blob
    let svgString = new XMLSerializer().serializeToString(svgEl);
    let blob = new Blob([svgString], {
        type: "image/svg+xml"
    });

    let objectUrl = URL.createObjectURL(blob);

    // create temporary image
    let tmpImg = new Image();
    tmpImg.src = objectUrl;
    tmpImg.width = w;
    tmpImg.height = h;
    tmpImg.crossOrigin = "anonymous";

    // wait for image
    await tmpImg.decode();

    /**
     * render to canvas 
     * get 1-bit image data for
     * potrace
     */
    //let ctx = canvas.getContext("2d");
    let ctx = canvas.getContext("2d", { willReadFrequently: true });

    //ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, w, h);

    // apply filter to enhance contrast
    if (filter) {
        ctx.filter = filter;
    }
    ctx.drawImage(tmpImg, 0, 0, w, h);

    // remove clone
    svgEl.remove()
    URL.revokeObjectURL(objectUrl);


    // black and white image
    let imageData = ctx.getImageData(0, 0, w, h);
    //let bmp = imageDataTo1Bit(imageData);
    return imageData

}



/**
 * get black and white bitmap data
 */

export function imageDataTo1Bit(imageData) {
    let { data, width, height } = imageData;
    let bmp = new Bitmap(width, height);
    let l = data.length, color;
    //console.log(imageData);
    for (let i = 0, j = 0; i < l; i += 4, j++) {
        /*
        color = 0.2126 * data[i] + 0.7153 * data[i + 1] +
            0.0721 * data[i + 2];
        */
        color = data[i];
        bmp.data[j] = (color < 128 ? 1 : 0);
    }
    //console.log(bmp);
    return bmp;
}
