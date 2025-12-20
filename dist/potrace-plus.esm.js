const {
    abs: abs$1, acos: acos$1, asin: asin$1, atan: atan$1, atan2: atan2$1, ceil: ceil$1, cos: cos$1, exp: exp$1, floor: floor$1,
    log: log$1, hypot, max: max$1, min: min$1, pow: pow$1, random: random$1, round: round$1, sin: sin$1, sqrt: sqrt$1, tan: tan$1, PI: PI$1
} = Math;

function getBBox_fromImageData(imgData, stripWhite = true, cornerCheck = true, debug = false, target = null) {

    let [w, h] = [imgData.width, imgData.height];

    // no width or height - exit
    if (!w && !h) {
        throw new Error('No width or height specified')
    }

    // collect top and bottom results
    let xArr = [];
    let pt;

    let bb = {
        x: 0,
        y: 0,
        width: w,
        height: h
    };

    /**
     * get image data and
     * convert to 32bit pixel color array
     * 255 x 255 x 255 x 0 = 0 => transparent
    */
    let data = new Uint32Array(imgData.data.buffer);

    // find alpha or white
    const tolerance = 100000;
    const white = 4294967295 - tolerance;

    // debugging: count pixel checks
    let checks = 0;
    let svg = '';

    // helper to translate pixel indices to x/y 
    const pixelIndexToXY = (w, h, i) => {
        let y = floor((i) / (w));
        let x = i - y * w;
        return { x, y }
    };

    const isNot = (color = 0, stripWhite = false, px = null) => {
        if (debug && px) {
            checks++;
            let pt = pixelIndexToXY(w, h, px);
            svg += `<rect x="${pt.x}" y="${pt.y}" transform="scale(1)" transform-origin="center" width="1" height="1" fill="rgba(0,255,255,0.25)" stroke="none" />`;
        }

        return stripWhite ? color < white : color > 0;
    };

    // init x/y
    let x = 0, y = 0, top = 0, left = 0, right = w, bottom = h;

    // pixel data indices
    let idx1 = 0;
    let idx2 = w * h - 1;

    /**
     * check corners
     * pixel indices in data array for corners
     * educated guess: check also mid points
     */

    // crop edge candidates
    let [cropTop, cropLeft, cropRight, cropBottom] = [1, 1, 1, 1];

    if (cornerCheck) {
        let xMid = floor(w / 2);
        let yMid = floor(h / 2);

        let cornerIndices = [
            // 0.top left
            0,

            // 1. bottom right
            h * w - 1,

            // 2. top right
            w - 1,

            // 3. bottom left
            h * w - w,

            // 4. top mid
            xMid,

            // 5. bottom mid
            h * w - xMid - 1,

            // 6. right mid
            yMid * w - 1,

            // 7. left mid
            yMid * w,

        ];

        for (let i = 0; i < cornerIndices.length; i++) {
            let idx = cornerIndices[i];

            // can't be cropped if 4 criteria are fulfilled
            if (!cropTop && !cropBottom && !cropLeft && !cropRight) break;

            if (isNot(data[idx], stripWhite, idx)) {

                if (i === 0) {
                    cropTop = 0;
                    cropLeft = 0;
                }

                else if (i === 1) {
                    cropBottom = 0;
                    cropRight = 0;
                }

                else if (i === 2) {
                    cropBottom = 0;
                    cropLeft = 0;
                }

                else if (i === 3) {
                    cropTop = 0;
                    cropLeft = 0;
                }

                // mid points
                else if (i === 4) {
                    cropTop = 0;
                }

                else if (i === 5) {
                    cropBottom = 0;
                }

                else if (i === 6) {
                    cropRight = 0;
                }

                else if (i === 7) {
                    cropLeft = 0;
                }
            }

        }

        if (debug) {
            console.log('corner mid check', checks, 'cropTop', cropTop, 'cropLeft', cropLeft, 'cropRight', cropRight, 'cropBottom', cropBottom);
        }

        // image can't be cropped - quit!
        if (!cropTop && !cropLeft && !cropRight && !cropBottom) {
            if (debug) {
                console.log('image cannot be cropped – opaque pixels in corners', checks, 'cropTop', cropTop, 'cropLeft', cropLeft, 'cropRight', cropRight, 'cropBottom', cropBottom);
            }
            return bb;
        }
    }

    /**
     * search from top and bottom to 
     * find first rows containing a 
     * non transparent/white pixel
     */
    for (y = 0; y < h; y++) {

        for (x = 0; x < w; x++) {

            if (cropTop && isNot(data[idx1], stripWhite, idx1)) {
                top = y;
                cropTop = 0;

                // top may also be horizontal/left extreme
                xArr.push(x);

                // top and bottom found then stop the search
                if (!cropBottom) {
                    break;
                }
            }

            if (cropBottom && isNot(data[idx2], stripWhite, idx2)) {
                bottom = h - y;
                cropBottom = 0;

                // bottom may also be horizontal/right extreme
                pt = pixelIndexToXY(w, h, idx2);
                xArr.push(pt.x);

                // top and bottom found then stop the search
                if (!cropTop) {
                    break;
                }
            }

            idx1++;
            idx2--;
        }

        // stop loop when both extremes are found
        if (!cropTop && !cropBottom) {

            break
        }

        // nothing to find in top-to-bottom scan - exit
        if (y + 2 >= h - y && !top) {
            if (debug) {
                console.log('image is empty', y, checks, w * h);
                target.insertAdjacentHTML('beforeend', svg);
            }
            return bb
        }

    }

    /**
     * search from left and right to find 
     * first column containing a non transparent pixel.
     */

    for (x = 0; x < w; x++) {
        idx1 = (top + 1) * w + x;
        idx2 = (top) * w + (w - x - 1);

        for (y = top; y < bottom - 1; y++) {

            if (cropLeft && isNot(data[idx1], stripWhite, idx1)) {
                left = x;
                cropLeft = 0;

                if (!cropRight) {
                    break;
                }
            }

            if (cropRight && isNot(data[idx2], stripWhite, idx2)) {
                right = w - x;
                cropRight = 0;

                if (!cropLeft) {
                    break;
                }
            }

            idx1 += w;
            idx2 += w;
        }
    }

    /**
     * top or bottom
     * scan may have found extremes
     */
    left = min(...xArr, left);
    right = max(...xArr, right);

    bb.x = left;
    bb.y = top;
    bb.width = right - left;
    bb.height = bottom - top;

    if (debug) {
        console.log(checks, w * h, 'skipped:', (w * h - checks), xArr);
        target.insertAdjacentHTML('beforeend', svg);
    }

    return bb;
}

/**
 * convert inputs to digestable
 * 1-bit (black and white) image data
 */

async function getBmp(input, {
    minSize = 1000,
    maxSize = 5000,
    filter = '',
    scale = 1,
    stripWhite = true,
    crop = true,

    canvas = null,

    brightness = 1,
    contrast = 1,
    invert = false,
    blur = 0,

} = {}) {

    let type = detectInputType(input);

    let settings = { minSize, maxSize, filter, scale, brightness, contrast, invert, blur, canvas };
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
        src = await objectUrlFromSVG(input);
        canvasImgData = await imgDataFromSrc(src, settings);

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
        };
    }

    let { imgData, scaleAdjust, width, height } = canvasImgData;

    /**
     * crop and 
     * convert to 1-bit 
     */

    // null bbox for no cropping
    let bb = { x: 0, y: 0, width: 0, height: 0 };

    if (crop) {

        bb = getBBox_fromImageData(imgData, stripWhite);

        // update dimensions
        width = ceil(bb.width / scaleAdjust);
        height = ceil(bb.height / scaleAdjust);

        canvasImgData.width = width;
        canvasImgData.height = height;
    }

    // create 1-bit array
    let bmp = imageDataTo1Bit(imgData, bb.x, bb.y, bb.width, bb.height);

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
    minSize *= scale;
    maxSize *= scale;

    // create new canvas
    if (!canvas) {
        canvas = document.getElementById('canvasPot');
        if (!canvas) canvas = document.createElement('canvas');

        canvas.id = 'canvasPot';

        document.body.append(canvas);

    }

    let ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });

    let res = await fetch(src);
    let isRaster;

    if (res.ok) {
        let blob = await res.blob();

        let { type } = blob;

        // is raster image
        if (type !== 'image/svg+xml') {
            isRaster = true;
            img = await createImageBitmap(blob);
            [w, h] = [img.width, img.height];
        }
        // svg image src
        else {

            img = new Image();
            img.src = src;
            img.crossOrigin = "anonymous";

            // wait for image
            await img.decode();
            [w, h] = [img.naturalWidth, img.naturalHeight];

        }

        dimMin = min(w, h);

        // scale up or down
        scaleAdjust = (!isRaster && (dimMin < minSize || dimMin > maxSize)) ? minSize / dimMin : 1;

        w *= scaleAdjust;
        h *= scaleAdjust;

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
    width = ceil(width / scaleAdjust);
    height = ceil(height / scaleAdjust);

    return { imgData, scaleAdjust, width, height }

}

async function svg2Canvas(el, { minSize = 1000, maxSize = 5000, filter = '', scale = 1, canvas = null } = {}) {

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
    let dimMin = min(w, h);
    let scaleAdjust = dimMin < minSize || dimMin > maxSize ? minSize / dimMin : 1;

    let wS = w * scaleAdjust;
    let hS = h * scaleAdjust;

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

function detectInputType(input) {
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

    let type = typeof input;
    let constructor = input.constructor.name;

    return (constructor || type).toLowerCase();
}

async function objectUrlFromSVG(el) {
    /**
     * clone svg to add width and height
     * for better compatibility
     * without affecting the original svg
     */
    const svgEl = el.cloneNode(true);
    document.body.append(svgEl);

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

    let objectUrl = URL.createObjectURL(blob);
    svgEl.remove();
    return objectUrl;

}

/**
 * get black and white bitmap data
 */

function imageDataTo1Bit(imageData, dx = 0, dy = 0, w = 0, h = 0) {
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

function Bitmap(w, h) {
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
    let pt = { x: 0, y: floor(i / this.w) };
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

function Path() {
    this.area = 0;
    this.len = 0;
    this.curve = {};
    this.pt = [];
    this.minX = 100000;
    this.minY = 100000;
    this.maxX = -1;
    this.maxY = -1;
}

function Curve(n) {
    this.n = n;
    this.tag = new Array(n);
    this.c = new Array(n * 3);
    this.alphaCurve = 0;
    this.vertex = new Array(n);
    this.alpha = new Array(n);
    this.alpha0 = new Array(n);
    this.beta = new Array(n);
}

function getPotracePathData(pathList = [], scale = 1) {

    // sort pathList to top-left to bottom right
    pathList.sort((a, b) => a.minX - b.minX || a.minY - b.minY);

    let len = pathList.length;
    let pathDataArr = [];

    for (let l = 0; l < len; l++) {

        let pathData = [];

        // sub paths starting with ;M
        let path = pathList[l];
        let {curve, minX, maxX, minY, maxY, sign}  = path;

        let bb = {
            x: minX,
            y: minY,
            width: maxX-minX,
            height: maxY-minY,
        };

        let n = curve.n, coms;

        pathData.push(
            {
                type: 'M', values: [
                    curve.c[(n - 1) * 3 + 2].x * scale,
                    curve.c[(n - 1) * 3 + 2].y * scale
                ],
                // save bbbox to each M
                bb,
                cw: sign==='+' ? true : false
            },
        );

        for (let i = 0; i < n; i++) {
            let type = curve.tag[i];
            if (type === "curve") {
                coms = [{
                    type: 'C', values: [
                        curve.c[i * 3].x * scale,
                        curve.c[i * 3].y * scale,
                        curve.c[i * 3 + 1].x * scale,
                        curve.c[i * 3 + 1].y * scale,
                        curve.c[i * 3 + 2].x * scale,
                        curve.c[i * 3 + 2].y * scale
                    ]
                }];

            } else if (type === "corner") {
                coms = [

                    {
                        type: 'L', values: [
                            curve.c[i * 3 + 1].x * scale,
                            curve.c[i * 3 + 1].y * scale,
                        ]
                    },
                    {
                        type: 'L', values: [
                            curve.c[i * 3 + 2].x * scale,
                            curve.c[i * 3 + 2].y * scale,
                        ]
                    }
                ];
            }
            pathData.push(...coms);
        }

        pathData.push({ type: 'Z', values: [] });

        pathDataArr.push(pathData);

    }

    return pathDataArr

}

function potracePathToPoly(path, scale = 1) {

    // sub paths starting with ;M
    let curve = path.curve;
    let n = curve.n;
    let polygon = [];

    // M
    polygon.push({ x: curve.c[(n - 1) * 3 + 2].x * scale, y: curve.c[(n - 1) * 3 + 2].y * scale });

    for (let i = 0; i < n; i++) {
        let type = curve.tag[i];
        if (type === "curve") {
            // C
            polygon.push({
                x: curve.c[i * 3 + 2].x * scale,
                y: curve.c[i * 3 + 2].y * scale
            });

        } else if (type === "corner") {

            polygon.push(
                {
                    x: curve.c[i * 3 + 1].x * scale,
                    y: curve.c[i * 3 + 1].y * scale
                },
                {
                    x: curve.c[i * 3 + 2].x * scale,
                    y: curve.c[i * 3 + 2].y * scale
                }
            );
        }
    }

    return polygon
}

/**
 * core tracing function
 * expects a 1-bit black and white 
 * image data array
 * returns potrace internal pathList obect
 */
function potraceGetPathList(bmp, {
    turnpolicy = "majority",
    turdsize = 1,
    optcurve = true,
    alphamax = 1,
    opttolerance = 1,
    getPolygon = false
} = {}) {

    /**
     * processing
     */

    let pathList = [];
    let polygons = [];

    function bmpToPathlist() {

        let bmp1 = bmp.copy();
        let currentPoint = { x: 0, y: 0 }, path;

        function findNext(pt) {
            let i = bmp1.w * pt.y + pt.x;
            while (i < bmp1.size && bmp1.data[i] !== 1) {
                i++;
            }
            return i < bmp1.size && bmp1.index(i);
        }

        function majority(x, y) {
            for (let i = 2; i < 5; i++) {
                let ct = 0;
                for (let a = -i + 1; a <= i - 1; a++) {
                    ct += bmp1.at(x + a, y + i - 1) ? 1 : -1;
                    ct += bmp1.at(x + i - 1, y + a - 1) ? 1 : -1;
                    ct += bmp1.at(x + a - 1, y - i) ? 1 : -1;
                    ct += bmp1.at(x - i, y + a) ? 1 : -1;
                }
                if (ct > 0) {
                    return 1;
                } else if (ct < 0) {
                    return 0;
                }
            }
            return 0;
        }

        function findPath(pt) {
            let path = new Path(),
                x = pt.x, y = pt.y,
                dirx = 0, diry = 1, tmp;

            path.sign = bmp.at(pt.x, pt.y) ? "+" : "-";

            while (1) {

                path.pt.push({ x, y });

                if (x > path.maxX)
                    path.maxX = x;
                if (x < path.minX)
                    path.minX = x;
                if (y > path.maxY)
                    path.maxY = y;
                if (y < path.minY)
                    path.minY = y;
                path.len++;

                x += dirx;
                y += diry;
                path.area -= x * diry;

                if (x === pt.x && y === pt.y)
                    break;

                let l = bmp1.at(x + (dirx + diry - 1) / 2, y + (diry - dirx - 1) / 2);
                let r = bmp1.at(x + (dirx - diry - 1) / 2, y + (diry + dirx - 1) / 2);

                if (r && !l) {
                    if (turnpolicy === "right" ||
                        (turnpolicy === "black" && path.sign === '+') ||
                        (turnpolicy === "white" && path.sign === '-') ||
                        (turnpolicy === "majority" && majority(x, y)) ||
                        (turnpolicy === "minority" && !majority(x, y))) {
                        tmp = dirx;
                        dirx = -diry;
                        diry = tmp;
                    } else {
                        tmp = dirx;
                        dirx = diry;
                        diry = -tmp;
                    }
                } else if (r) {
                    tmp = dirx;
                    dirx = -diry;
                    diry = tmp;
                } else if (!l) {
                    tmp = dirx;
                    dirx = diry;
                    diry = -tmp;
                }
            }

            return path;
        }

        function xorPath(path) {
            let y1 = path.pt[0].y,
                len = path.len,
                maxX, minY;
            for (let i = 1; i < len; i++) {
                let x = path.pt[i].x;
                let y = path.pt[i].y;

                if (y !== y1) {
                    minY = y1 < y ? y1 : y;
                    maxX = path.maxX;
                    for (let j = x; j < maxX; j++) {
                        bmp1.flip(j, minY);
                    }
                    y1 = y;
                }
            }
        }

        while (currentPoint = findNext(currentPoint)) {

            path = findPath(currentPoint);
            xorPath(path);

            if (path.area > turdsize) {
                pathList.push(path);
            }
        }

        return pathList;
    }

    function processPath() {

        function Quad() {
            this.data = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        }

        Quad.prototype.at = function (x, y) {
            return this.data[x * 3 + y];
        };

        function Sum(x, y, xy, x2, y2) {
            this.x = x;
            this.y = y;
            this.xy = xy;
            this.x2 = x2;
            this.y2 = y2;
        }

        function mod(a, n) {
            return a >= n ? a % n : a >= 0 ? a : n - 1 - (-1 - a) % n;
        }

        function xprod(p1, p2) {
            return p1.x * p2.y - p1.y * p2.x;
        }

        function cyclic(a, b, c) {
            if (a <= c) {
                return (a <= b && b < c);
            } else {
                return (a <= b || b < c);
            }
        }

        function sign(i) {
            return i > 0 ? 1 : i < 0 ? -1 : 0;
        }

        function quadform(Q, w) {
            let v = new Array(3), sum = 0;

            v[0] = w.x;
            v[1] = w.y;
            v[2] = 1;

            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    sum += v[i] * Q.at(i, j) * v[j];
                }
            }
            return sum;
        }

        function interval(lambda, a, b) {
            return { x: a.x + lambda * (b.x - a.x), y: a.y + lambda * (b.y - a.y) }
        }

        function dorth_infty(p0, p2) {
            return { x: -sign(p2.y - p0.y), y: sign(p2.x - p0.x) }
        }

        function ddenom(p0, p2) {
            let r = dorth_infty(p0, p2);

            return r.y * (p2.x - p0.x) - r.x * (p2.y - p0.y);
        }

        function getProd(type = '', p0 = {}, p1 = {}, p2 = {}, p3 = {},) {
            let x1, x2, y1, y2;
            if (type === 'cprod' || type === 'iprod1') {
                x1 = p1.x - p0.x;
                y1 = p1.y - p0.y;
                x2 = p3.x - p2.x;
                y2 = p3.y - p2.y;
            } else {
                x1 = p1.x - p0.x;
                y1 = p1.y - p0.y;
                x2 = p2.x - p0.x;
                y2 = p2.y - p0.y;
            }
            return type === 'cprod' || type === 'dpara' ? x1 * y2 - x2 * y1 : x1 * x2 + y1 * y2;
        }

        function ddist(p, q) {
            return sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);

        }

        function bezier(t, p0, p1, p2, p3) {
            let s = 1 - t;
            return { x: s * s * s * p0.x + 3 * (s * s * t) * p1.x + 3 * (t * t * s) * p2.x + t * t * t * p3.x, y: s * s * s * p0.y + 3 * (s * s * t) * p1.y + 3 * (t * t * s) * p2.y + t * t * t * p3.y };
        }

        function tangent(p0, p1, p2, p3, q0, q1) {

            let A = getProd('cprod', p0, p1, q0, q1);
            let B = getProd('cprod', p1, p2, q0, q1);
            let C = getProd('cprod', p2, p3, q0, q1);

            let a = A - 2 * B + C;
            let b = -2 * A + 2 * B;
            let c = A;
            let d = b * b - 4 * a * c;

            if (a === 0 || d < 0) {
                return -1;
            }

            let s = sqrt(d);
            let r1 = (-b + s) / (2 * a);
            let r2 = (-b - s) / (2 * a);

            if (r1 >= 0 && r1 <= 1) {
                return r1;
            } else if (r2 >= 0 && r2 <= 1) {
                return r2;
            } else {
                return -1;
            }
        }

        function calcSums(path) {

            path.x0 = path.pt[0].x;
            path.y0 = path.pt[0].y;

            path.sums = [];
            let s = path.sums;
            s.push(new Sum(0, 0, 0, 0, 0));
            for (let i = 0; i < path.len; i++) {
                let x = path.pt[i].x - path.x0;
                let y = path.pt[i].y - path.y0;
                s.push(new Sum(s[i].x + x, s[i].y + y, s[i].xy + x * y,
                    s[i].x2 + x * x, s[i].y2 + y * y));
            }
        }

        function calcLon(path) {

            let n = path.len, pt = path.pt, dir,
                pivk = new Array(n),
                nc = new Array(n),
                ct = new Array(4);
            path.lon = new Array(n);

            let constraint = [{ x: 0, y: 0 }, { x: 0, y: 0 }],
                cur = { x: 0, y: 0 },
                off = { x: 0, y: 0 },
                dk = { x: 0, y: 0 },
                foundk;

            let i, j, k1, a, b, c, d, k = 0;
            for (i = n - 1; i >= 0; i--) {
                if (pt[i].x != pt[k].x && pt[i].y != pt[k].y) {
                    k = i + 1;
                }
                nc[i] = k;
            }

            for (i = n - 1; i >= 0; i--) {
                ct[0] = ct[1] = ct[2] = ct[3] = 0;
                dir = (3 + 3 * (pt[mod(i + 1, n)].x - pt[i].x) +
                    (pt[mod(i + 1, n)].y - pt[i].y)) / 2;
                ct[dir]++;

                constraint[0].x = 0;
                constraint[0].y = 0;
                constraint[1].x = 0;
                constraint[1].y = 0;

                k = nc[i];
                k1 = i;
                while (1) {
                    foundk = 0;
                    dir = (3 + 3 * sign(pt[k].x - pt[k1].x) +
                        sign(pt[k].y - pt[k1].y)) / 2;
                    ct[dir]++;

                    if (ct[0] && ct[1] && ct[2] && ct[3]) {
                        pivk[i] = k1;
                        foundk = 1;
                        break;
                    }

                    cur.x = pt[k].x - pt[i].x;
                    cur.y = pt[k].y - pt[i].y;

                    if (xprod(constraint[0], cur) < 0 || xprod(constraint[1], cur) > 0) {
                        break;
                    }

                    if (abs(cur.x) <= 1 && abs(cur.y) <= 1) ; else {
                        off.x = cur.x + ((cur.y >= 0 && (cur.y > 0 || cur.x < 0)) ? 1 : -1);
                        off.y = cur.y + ((cur.x <= 0 && (cur.x < 0 || cur.y < 0)) ? 1 : -1);
                        if (xprod(constraint[0], off) >= 0) {
                            constraint[0].x = off.x;
                            constraint[0].y = off.y;
                        }
                        off.x = cur.x + ((cur.y <= 0 && (cur.y < 0 || cur.x < 0)) ? 1 : -1);
                        off.y = cur.y + ((cur.x >= 0 && (cur.x > 0 || cur.y < 0)) ? 1 : -1);
                        if (xprod(constraint[1], off) <= 0) {
                            constraint[1].x = off.x;
                            constraint[1].y = off.y;
                        }
                    }
                    k1 = k;
                    k = nc[k1];
                    if (!cyclic(k, i, k1)) {
                        break;
                    }
                }
                if (foundk === 0) {
                    dk.x = sign(pt[k].x - pt[k1].x);
                    dk.y = sign(pt[k].y - pt[k1].y);
                    cur.x = pt[k1].x - pt[i].x;
                    cur.y = pt[k1].y - pt[i].y;

                    a = xprod(constraint[0], cur);
                    b = xprod(constraint[0], dk);
                    c = xprod(constraint[1], cur);
                    d = xprod(constraint[1], dk);

                    j = 10000000;
                    if (b < 0) {
                        j = floor(a / -b);
                    }
                    if (d > 0) {
                        j = min(j, floor(-c / d));
                    }
                    pivk[i] = mod(k1 + j, n);
                }
            }

            j = pivk[n - 1];
            path.lon[n - 1] = j;
            for (i = n - 2; i >= 0; i--) {
                if (cyclic(i + 1, pivk[i], j)) {
                    j = pivk[i];
                }
                path.lon[i] = j;
            }

            for (i = n - 1; cyclic(mod(i + 1, n), j, path.lon[i]); i--) {
                path.lon[i] = j;
            }
        }

        function bestPolygon(path) {

            function penalty3(path, i, j) {

                let n = path.len, pt = path.pt, sums = path.sums;
                let x, y, xy, x2, y2,
                    k, a, b, c, s,
                    px, py, ex, ey,
                    r = 0;
                if (j >= n) {
                    j -= n;
                    r = 1;
                }

                if (r === 0) {
                    x = sums[j + 1].x - sums[i].x;
                    y = sums[j + 1].y - sums[i].y;
                    x2 = sums[j + 1].x2 - sums[i].x2;
                    xy = sums[j + 1].xy - sums[i].xy;
                    y2 = sums[j + 1].y2 - sums[i].y2;
                    k = j + 1 - i;
                } else {
                    x = sums[j + 1].x - sums[i].x + sums[n].x;
                    y = sums[j + 1].y - sums[i].y + sums[n].y;
                    x2 = sums[j + 1].x2 - sums[i].x2 + sums[n].x2;
                    xy = sums[j + 1].xy - sums[i].xy + sums[n].xy;
                    y2 = sums[j + 1].y2 - sums[i].y2 + sums[n].y2;
                    k = j + 1 - i + n;
                }

                px = (pt[i].x + pt[j].x) / 2 - pt[0].x;
                py = (pt[i].y + pt[j].y) / 2 - pt[0].y;
                ey = (pt[j].x - pt[i].x);
                ex = -(pt[j].y - pt[i].y);

                a = ((x2 - 2 * x * px) / k + px * px);
                b = ((xy - x * py - y * px) / k + px * py);
                c = ((y2 - 2 * y * py) / k + py * py);

                s = ex * ex * a + 2 * ex * ey * b + ey * ey * c;

                return sqrt(s);
            }

            let i, j, m, k,
                n = path.len,
                pen = new Array(n + 1),
                prev = new Array(n + 1),
                clip0 = new Array(n),
                clip1 = new Array(n + 1),
                seg0 = new Array(n + 1),
                seg1 = new Array(n + 1),
                thispen, best, c;

            for (i = 0; i < n; i++) {
                c = mod(path.lon[mod(i - 1, n)] - 1, n);
                if (c == i) {
                    c = mod(i + 1, n);
                }
                if (c < i) {
                    clip0[i] = n;
                } else {
                    clip0[i] = c;
                }
            }

            j = 1;
            for (i = 0; i < n; i++) {
                while (j <= clip0[i]) {
                    clip1[j] = i;
                    j++;
                }
            }

            i = 0;
            for (j = 0; i < n; j++) {
                seg0[j] = i;
                i = clip0[i];
            }
            seg0[j] = n;
            m = j;

            i = n;
            for (j = m; j > 0; j--) {
                seg1[j] = i;
                i = clip1[i];
            }
            seg1[0] = 0;

            pen[0] = 0;
            for (j = 1; j <= m; j++) {
                for (i = seg1[j]; i <= seg0[j]; i++) {
                    best = -1;
                    for (k = seg0[j - 1]; k >= clip1[i]; k--) {
                        thispen = penalty3(path, k, i) + pen[k];
                        if (best < 0 || thispen < best) {
                            prev[i] = k;
                            best = thispen;
                        }
                    }
                    pen[i] = best;
                }
            }
            path.m = m;
            path.po = new Array(m);

            for (i = n, j = m - 1; i > 0; j--) {
                i = prev[i];
                path.po[j] = i;
            }

        }

        function adjustVertices(path) {

            function pointslope(path, i, j, ctr, dir) {

                let n = path.len, sums = path.sums,
                    x, y, x2, xy, y2,
                    k, a, b, c, lambda2, l, r = 0;

                while (j >= n) {
                    j -= n;
                    r += 1;
                }
                while (i >= n) {
                    i -= n;
                    r -= 1;
                }
                while (j < 0) {
                    j += n;
                    r -= 1;
                }
                while (i < 0) {
                    i += n;
                    r += 1;
                }

                x = sums[j + 1].x - sums[i].x + r * sums[n].x;
                y = sums[j + 1].y - sums[i].y + r * sums[n].y;
                x2 = sums[j + 1].x2 - sums[i].x2 + r * sums[n].x2;
                xy = sums[j + 1].xy - sums[i].xy + r * sums[n].xy;
                y2 = sums[j + 1].y2 - sums[i].y2 + r * sums[n].y2;
                k = j + 1 - i + r * n;

                ctr.x = x / k;
                ctr.y = y / k;

                a = (x2 - x * x / k) / k;
                b = (xy - x * y / k) / k;
                c = (y2 - y * y / k) / k;

                lambda2 = (a + c + sqrt((a - c) * (a - c) + 4 * b * b)) / 2;

                a -= lambda2;
                c -= lambda2;

                if (abs(a) >= abs(c)) {
                    l = sqrt(a * a + b * b);
                    if (l !== 0) {
                        dir.x = -b / l;
                        dir.y = a / l;
                    }
                } else {
                    l = sqrt(c * c + b * b);
                    if (l !== 0) {
                        dir.x = -c / l;
                        dir.y = b / l;
                    }
                }
                if (l === 0) {
                    dir.x = dir.y = 0;
                }
            }

            let m = path.m, po = path.po, n = path.len, pt = path.pt,
                x0 = path.x0, y0 = path.y0,
                ctr = new Array(m), dir = new Array(m),
                q = new Array(m),
                v = new Array(3), d, i, j, k, l,
                s = { x: 0, y: 0 };

            path.curve = new Curve(m);

            for (i = 0; i < m; i++) {
                j = po[mod(i + 1, m)];
                j = mod(j - po[i], n) + po[i];
                ctr[i] = { x: 0, y: 0 };
                dir[i] = { x: 0, y: 0 };
                pointslope(path, po[i], j, ctr[i], dir[i]);
            }

            for (i = 0; i < m; i++) {
                q[i] = new Quad();
                d = dir[i].x * dir[i].x + dir[i].y * dir[i].y;
                if (d === 0) {
                    for (j = 0; j < 3; j++) {
                        for (k = 0; k < 3; k++) {
                            q[i].data[j * 3 + k] = 0;
                        }
                    }
                } else {
                    v[0] = dir[i].y;
                    v[1] = -dir[i].x;
                    v[2] = - v[1] * ctr[i].y - v[0] * ctr[i].x;
                    for (l = 0; l < 3; l++) {
                        for (k = 0; k < 3; k++) {
                            q[i].data[l * 3 + k] = v[l] * v[k] / d;
                        }
                    }
                }
            }

            let Q, w, dx, dy, det, min, cand, xmin, ymin, z;
            for (i = 0; i < m; i++) {
                Q = new Quad();
                w = { x: 0, y: 0 };
                s.x = pt[po[i]].x - x0;
                s.y = pt[po[i]].y - y0;

                j = mod(i - 1, m);

                for (l = 0; l < 3; l++) {
                    for (k = 0; k < 3; k++) {
                        Q.data[l * 3 + k] = q[j].at(l, k) + q[i].at(l, k);
                    }
                }

                while (1) {

                    det = Q.at(0, 0) * Q.at(1, 1) - Q.at(0, 1) * Q.at(1, 0);
                    if (det !== 0) {
                        w.x = (-Q.at(0, 2) * Q.at(1, 1) + Q.at(1, 2) * Q.at(0, 1)) / det;
                        w.y = (Q.at(0, 2) * Q.at(1, 0) - Q.at(1, 2) * Q.at(0, 0)) / det;
                        break;
                    }

                    if (Q.at(0, 0) > Q.at(1, 1)) {
                        v[0] = -Q.at(0, 1);
                        v[1] = Q.at(0, 0);
                    } else if (Q.at(1, 1)) {
                        v[0] = -Q.at(1, 1);
                        v[1] = Q.at(1, 0);
                    } else {
                        v[0] = 1;
                        v[1] = 0;
                    }
                    d = v[0] * v[0] + v[1] * v[1];
                    v[2] = - v[1] * s.y - v[0] * s.x;
                    for (l = 0; l < 3; l++) {
                        for (k = 0; k < 3; k++) {
                            Q.data[l * 3 + k] += v[l] * v[k] / d;
                        }
                    }
                }
                dx = abs(w.x - s.x);
                dy = abs(w.y - s.y);
                if (dx <= 0.5 && dy <= 0.5) {
                    path.curve.vertex[i] = { x: w.x + x0, y: w.y + y0 };
                    continue;
                }

                min = quadform(Q, s);
                xmin = s.x;
                ymin = s.y;

                if (Q.at(0, 0) !== 0) {
                    for (z = 0; z < 2; z++) {
                        w.y = s.y - 0.5 + z;
                        w.x = - (Q.at(0, 1) * w.y + Q.at(0, 2)) / Q.at(0, 0);
                        dx = abs(w.x - s.x);
                        cand = quadform(Q, w);
                        if (dx <= 0.5 && cand < min) {
                            min = cand;
                            xmin = w.x;
                            ymin = w.y;
                        }
                    }
                }

                if (Q.at(1, 1) !== 0) {
                    for (z = 0; z < 2; z++) {
                        w.x = s.x - 0.5 + z;
                        w.y = - (Q.at(1, 0) * w.x + Q.at(1, 2)) / Q.at(1, 1);
                        dy = abs(w.y - s.y);
                        cand = quadform(Q, w);
                        if (dy <= 0.5 && cand < min) {
                            min = cand;
                            xmin = w.x;
                            ymin = w.y;
                        }
                    }
                }

                for (l = 0; l < 2; l++) {
                    for (k = 0; k < 2; k++) {
                        w.x = s.x - 0.5 + l;
                        w.y = s.y - 0.5 + k;
                        cand = quadform(Q, w);
                        if (cand < min) {
                            min = cand;
                            xmin = w.x;
                            ymin = w.y;
                        }
                    }
                }
                path.curve.vertex[i] = { x: xmin + x0, y: ymin + y0 };
            }
        }

        function reverse(path) {
            let curve = path.curve, m = curve.n, v = curve.vertex, i, j, tmp;

            for (i = 0, j = m - 1; i < j; i++, j--) {
                tmp = v[i];
                v[i] = v[j];
                v[j] = tmp;
            }
        }

        function smooth(path) {
            let m = path.curve.n, curve = path.curve;

            let i, j, k, dd, denom, alpha,
                p2, p3, p4;

            for (i = 0; i < m; i++) {
                j = mod(i + 1, m);
                k = mod(i + 2, m);
                p4 = interval(1 / 2.0, curve.vertex[k], curve.vertex[j]);

                denom = ddenom(curve.vertex[i], curve.vertex[k]);
                if (denom !== 0) {
                    dd = getProd('dpara', curve.vertex[i], curve.vertex[j], curve.vertex[k]) / denom;
                    dd = abs(dd);
                    alpha = dd > 1 ? (1 - 1 / dd) : 0;
                    alpha = alpha / 0.75;
                } else {
                    alpha = 4 / 3.0;
                }
                curve.alpha0[j] = alpha;

                if (alpha >= alphamax) {
                    curve.tag[j] = "corner";
                    curve.c[3 * j + 1] = curve.vertex[j];
                    curve.c[3 * j + 2] = p4;
                } else {
                    if (alpha < 0.55) {
                        alpha = 0.55;
                    } else if (alpha > 1) {
                        alpha = 1;
                    }
                    p2 = interval(0.5 + 0.5 * alpha, curve.vertex[i], curve.vertex[j]);
                    p3 = interval(0.5 + 0.5 * alpha, curve.vertex[k], curve.vertex[j]);
                    curve.tag[j] = "curve";
                    curve.c[3 * j + 0] = p2;
                    curve.c[3 * j + 1] = p3;
                    curve.c[3 * j + 2] = p4;
                }
                curve.alpha[j] = alpha;
                curve.beta[j] = 0.5;
            }
            curve.alphacurve = 1;
        }

        // start opt
        function optiCurve(path) {

            function Opti() {
                this.pen = 0;
                this.c = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
                this.t = 0;
                this.s = 0;
                this.alpha = 0;
            }

            function opti_penalty(path, i, j, res, opttolerance, convc, areac) {
                let m = path.curve.n, curve = path.curve, vertex = curve.vertex,
                    k, k1, k2, conv, i1,
                    area, alpha, d, d1, d2,
                    p0, p1, p2, p3, pt,
                    A, R, A1, A2, A3, A4,
                    s, t;

                if (i == j) {
                    return 1;
                }

                k = i;
                i1 = mod(i + 1, m);
                k1 = mod(k + 1, m);
                conv = convc[k1];
                if (conv === 0) {
                    return 1;
                }
                d = ddist(vertex[i], vertex[i1]);
                for (k = k1; k != j; k = k1) {
                    k1 = mod(k + 1, m);
                    k2 = mod(k + 2, m);
                    if (convc[k1] != conv) {
                        return 1;
                    }

                    if (sign(getProd('cprod', vertex[i], vertex[i1], vertex[k1], vertex[k2])) !=
                        conv) {
                        return 1;
                    }
                    if (getProd('iprod1', vertex[i], vertex[i1], vertex[k1], vertex[k2]) <
                        d * ddist(vertex[k1], vertex[k2]) * -0.999847695156) {
                        return 1;
                    }
                }

                p0 = curve.c[mod(i, m) * 3 + 2];
                p1 = vertex[mod(i + 1, m)];
                p2 = vertex[mod(j, m)];
                p3 = curve.c[mod(j, m) * 3 + 2];

                area = areac[j] - areac[i];
                area -= getProd('dpara', vertex[0], curve.c[i * 3 + 2], curve.c[j * 3 + 2]) / 2;
                if (i >= j) {
                    area += areac[m];
                }

                A1 = getProd('dpara', p0, p1, p2);
                A2 = getProd('dpara', p0, p1, p3);
                A3 = getProd('dpara', p0, p2, p3);

                A4 = A1 + A3 - A2;

                if (A2 == A1) {
                    return 1;
                }

                t = A3 / (A3 - A4);
                s = A2 / (A2 - A1);
                A = A2 * t / 2.0;

                if (A === 0) {
                    return 1;
                }

                R = area / A;
                alpha = 2 - sqrt(4 - R / 0.3);

                res.c[0] = interval(t * alpha, p0, p1);
                res.c[1] = interval(s * alpha, p3, p2);
                res.alpha = alpha;
                res.t = t;
                res.s = s;

                p1 = { x: res.c[0].x, y: res.c[0].y };
                p2 = { x: res.c[1].x, y: res.c[1].y };

                res.pen = 0;

                for (k = mod(i + 1, m); k != j; k = k1) {
                    k1 = mod(k + 1, m);
                    t = tangent(p0, p1, p2, p3, vertex[k], vertex[k1]);
                    if (t < -0.5) {
                        return 1;
                    }
                    pt = bezier(t, p0, p1, p2, p3);
                    d = ddist(vertex[k], vertex[k1]);
                    if (d === 0) {
                        return 1;
                    }
                    d1 = getProd('dpara', vertex[k], vertex[k1], pt) / d;
                    if (abs(d1) > opttolerance) {
                        return 1;
                    }
                    if (getProd('iprod', vertex[k], vertex[k1], pt) < 0 ||
                        getProd('iprod', vertex[k1], vertex[k], pt) < 0) {
                        return 1;
                    }
                    res.pen += d1 * d1;
                }

                for (k = i; k != j; k = k1) {
                    k1 = mod(k + 1, m);
                    t = tangent(p0, p1, p2, p3, curve.c[k * 3 + 2], curve.c[k1 * 3 + 2]);
                    if (t < -0.5) {
                        return 1;
                    }
                    pt = bezier(t, p0, p1, p2, p3);
                    d = ddist(curve.c[k * 3 + 2], curve.c[k1 * 3 + 2]);
                    if (d === 0) {
                        return 1;
                    }
                    d1 = getProd('dpara', curve.c[k * 3 + 2], curve.c[k1 * 3 + 2], pt) / d;
                    d2 = getProd('dpara', curve.c[k * 3 + 2], curve.c[k1 * 3 + 2], vertex[k1]) / d;
                    d2 *= 0.75 * curve.alpha[k1];
                    if (d2 < 0) {
                        d1 = -d1;
                        d2 = -d2;
                    }
                    if (d1 < d2 - opttolerance) {
                        return 1;
                    }
                    if (d1 < d2) {
                        res.pen += (d1 - d2) * (d1 - d2);
                    }
                }

                return 0;
            }

            let curve = path.curve, m = curve.n, vert = curve.vertex,
                pt = new Array(m + 1),
                pen = new Array(m + 1),
                len = new Array(m + 1),
                opt = new Array(m + 1),
                om, i, j, r,
                o = new Opti(), p0,
                i1, area, alpha, ocurve,
                s, t;

            let convc = new Array(m), areac = new Array(m + 1);

            for (i = 0; i < m; i++) {
                if (curve.tag[i] == "curve") {
                    convc[i] = sign(getProd('dpara', vert[mod(i - 1, m)], vert[i], vert[mod(i + 1, m)]));
                } else {
                    convc[i] = 0;
                }
            }

            area = 0;
            areac[0] = 0;
            p0 = curve.vertex[0];
            for (i = 0; i < m; i++) {
                i1 = mod(i + 1, m);
                if (curve.tag[i1] == "curve") {
                    alpha = curve.alpha[i1];
                    area += 0.3 * alpha * (4 - alpha) *
                        getProd('dpara', curve.c[i * 3 + 2], vert[i1], curve.c[i1 * 3 + 2]) / 2;
                    area += getProd('dpara', p0, curve.c[i * 3 + 2], curve.c[i1 * 3 + 2]) / 2;
                }
                areac[i + 1] = area;
            }

            pt[0] = -1;
            pen[0] = 0;
            len[0] = 0;

            for (j = 1; j <= m; j++) {
                pt[j] = j - 1;
                pen[j] = pen[j - 1];
                len[j] = len[j - 1] + 1;

                for (i = j - 2; i >= 0; i--) {
                    r = opti_penalty(path, i, mod(j, m), o, opttolerance, convc,
                        areac);
                    if (r) {
                        break;
                    }
                    if (len[j] > len[i] + 1 ||
                        (len[j] == len[i] + 1 && pen[j] > pen[i] + o.pen)) {
                        pt[j] = i;
                        pen[j] = pen[i] + o.pen;
                        len[j] = len[i] + 1;
                        opt[j] = o;
                        o = new Opti();
                    }
                }
            }
            om = len[m];
            ocurve = new Curve(om);
            s = new Array(om);
            t = new Array(om);

            j = m;
            for (i = om - 1; i >= 0; i--) {
                if (pt[j] == j - 1) {
                    ocurve.tag[i] = curve.tag[mod(j, m)];
                    ocurve.c[i * 3 + 0] = curve.c[mod(j, m) * 3 + 0];
                    ocurve.c[i * 3 + 1] = curve.c[mod(j, m) * 3 + 1];
                    ocurve.c[i * 3 + 2] = curve.c[mod(j, m) * 3 + 2];
                    ocurve.vertex[i] = curve.vertex[mod(j, m)];
                    ocurve.alpha[i] = curve.alpha[mod(j, m)];
                    ocurve.alpha0[i] = curve.alpha0[mod(j, m)];
                    ocurve.beta[i] = curve.beta[mod(j, m)];
                    s[i] = t[i] = 1.0;
                } else {
                    ocurve.tag[i] = "curve";
                    ocurve.c[i * 3 + 0] = opt[j].c[0];
                    ocurve.c[i * 3 + 1] = opt[j].c[1];
                    ocurve.c[i * 3 + 2] = curve.c[mod(j, m) * 3 + 2];
                    ocurve.vertex[i] = interval(opt[j].s, curve.c[mod(j, m) * 3 + 2],
                        vert[mod(j, m)]);
                    ocurve.alpha[i] = opt[j].alpha;
                    ocurve.alpha0[i] = opt[j].alpha;
                    s[i] = opt[j].s;
                    t[i] = opt[j].t;
                }
                j = pt[j];
            }

            for (i = 0; i < om; i++) {
                i1 = mod(i + 1, om);
                ocurve.beta[i] = s[i] / (s[i] + t[i1]);
            }
            ocurve.alphacurve = 1;
            path.curve = ocurve;
        }

        // end opt

        for (let i = 0; i < pathList.length; i++) {
            let path = pathList[i];

            calcSums(path);
            calcLon(path);
            bestPolygon(path);
            adjustVertices(path);

            if (path.sign === "-") {
                reverse(path);
            }

            smooth(path);

            if (getPolygon) {
                // get polygon 
                let poly = potracePathToPoly(path);
                polygons.push(poly);
            }

            if (optcurve) { optiCurve(path); }
        }

    }

    /**
     * run tracing
     */

    bmpToPathlist();
    processPath();

    if (getPolygon) {
        let points = '';
        polygons.forEach(poly => {
            points += `M` + poly.map(pt => { return `${pt.x} ${pt.y}` }).join(' ');
        });

       // console.log(points);
    }

    return { pathList, polygons };

}

const {
    abs, acos, asin, atan, atan2, ceil, cos, exp, floor,
    log, max, min, pow, random, round, sin, sqrt, tan, PI
} = Math;

// get angle helper
function getAngle(p1, p2, normalize = false) {
    let angle = atan2(p2.y - p1.y, p2.x - p1.x);
    // normalize negative angles
    if (normalize && angle < 0) angle += PI * 2;
    return angle
}

/** Get relationship between a point and a polygon using ray-casting algorithm
* based on timepp's answer
* https://stackoverflow.com/questions/217578/how-can-i-determine-whether-a-2d-point-is-within-a-polygon#63436180
*/

function isPointInPolygon(pt, polygon, bb, skipBB = false) {
    const between = (p, a, b) => (p >= a && p <= b) || (p <= a && p >= b);
    let inside = false;

    // not in bbox - quit || no bbox defined
    if (!skipBB || !bb.bottom) {
        if (bb.left > pt.x || bb.top > pt.y || bb.bottom < pt.y || bb.right < pt.x) {
            return false;
        }
    }

    for (let i = polygon.length - 1, j = 0; j < polygon.length; i = j, j++) {
        const A = polygon[i];
        const B = polygon[j];
        // corner cases
        if ((pt.x == A.x && pt.y == A.y) || (pt.x == B.x && pt.y == B.y))
            return true;
        if (A.y == B.y && pt.y == A.y && between(pt.x, A.x, B.x)) return true;
        if (between(pt.y, A.y, B.y)) {
            // if pt inside the vertical range
            // filter out "ray pass vertex" problem by treating the line a little lower
            if ((pt.y == A.y && B.y >= A.y) || (pt.y == B.y && A.y >= B.y)) continue;
            // calc cross product `ptA X ptB`, pt lays on left side of AB if c > 0
            const c = (A.x - pt.x) * (B.y - pt.y) - (B.x - pt.x) * (A.y - pt.y);
            if (c == 0) return true;
            if (A.y < B.y == c > 0) inside = !inside;
        }
    }
    return inside ? true : false;
}

function getSquareDistance(p1, p2) {
    return (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
}

/**
* Linear  interpolation (LERP) helper
*/
function interpolate(p1, p2, t, getTangent = false) {

    let pt = {
        x: (p2.x - p1.x) * t + p1.x,
        y: (p2.y - p1.y) * t + p1.y,
    };

    if (getTangent) {
        pt.angle = getAngle(p1, p2);

        // normalize negative angles
        if (pt.angle < 0) pt.angle += PI * 2;
    }

    return pt
}

function pointAtT(pts, t = 0.5, getTangent = false, getCpts = false) {

    const getPointAtBezierT = (pts, t, getTangent = false) => {

        let isCubic = pts.length === 4;
        let p0 = pts[0];
        let cp1 = pts[1];
        let cp2 = isCubic ? pts[2] : pts[1];
        let p = pts[pts.length - 1];
        let pt = { x: 0, y: 0 };

        if (getTangent || getCpts) {
            let m0, m1, m2, m3, m4;
            let shortCp1 = p0.x === cp1.x && p0.y === cp1.y;
            let shortCp2 = p.x === cp2.x && p.y === cp2.y;

            if (t === 0 && !shortCp1) {
                pt.x = p0.x;
                pt.y = p0.y;
                pt.angle = getAngle(p0, cp1);
            }

            else if (t === 1 && !shortCp2) {
                pt.x = p.x;
                pt.y = p.y;
                pt.angle = getAngle(cp2, p);
            }

            else {
                // adjust if cps are on start or end point
                if (shortCp1) t += 0.0000001;
                if (shortCp2) t -= 0.0000001;

                m0 = interpolate(p0, cp1, t);
                if (isCubic) {
                    m1 = interpolate(cp1, cp2, t);
                    m2 = interpolate(cp2, p, t);
                    m3 = interpolate(m0, m1, t);
                    m4 = interpolate(m1, m2, t);
                    pt = interpolate(m3, m4, t);

                    // add angles
                    pt.angle = getAngle(m3, m4);

                    // add control points
                    if (getCpts) pt.cpts = [m1, m2, m3, m4];
                } else {
                    m1 = interpolate(p0, cp1, t);
                    m2 = interpolate(cp1, p, t);
                    pt = interpolate(m1, m2, t);
                    pt.angle = getAngle(m1, m2);

                    // add control points
                    if (getCpts) pt.cpts = [m1, m2];
                }
            }

        }
        // take simplified calculations without tangent angles
        else {
            let t1 = 1 - t;

            // cubic beziers
            if (isCubic) {
                pt = {
                    x:
                        t1 ** 3 * p0.x +
                        3 * t1 ** 2 * t * cp1.x +
                        3 * t1 * t ** 2 * cp2.x +
                        t ** 3 * p.x,
                    y:
                        t1 ** 3 * p0.y +
                        3 * t1 ** 2 * t * cp1.y +
                        3 * t1 * t ** 2 * cp2.y +
                        t ** 3 * p.y,
                };

            }
            // quadratic beziers
            else {
                pt = {
                    x: t1 * t1 * p0.x + 2 * t1 * t * cp1.x + t ** 2 * p.x,
                    y: t1 * t1 * p0.y + 2 * t1 * t * cp1.y + t ** 2 * p.y,
                };
            }

        }

        return pt

    };

    let pt;
    if (pts.length > 2) {
        pt = getPointAtBezierT(pts, t, getTangent);
    }

    else {
        pt = interpolate(pts[0], pts[1], t, getTangent);
    }

    // normalize negative angles
    if (getTangent && pt.angle < 0) pt.angle += PI * 2;

    return pt
}

/**
 * get vertices from path command final on-path points
 */
function getPathDataVertices(pathData, includeCpts = false) {
    let polyPoints = [];
    ({ x: pathData[0].values[0], y: pathData[0].values[1] });

    pathData.forEach((com) => {
        let { type, values } = com;

        // get final on path point from last 2 values
        if (values.length) {

            if (includeCpts) {

                for (let i = 1; i < values.length; i += 2) {
                    polyPoints.push({ x: values[i - 1], y: values[i] });
                }

            } else {
                polyPoints.push({ x: values[values.length - 2], y: values[values.length - 1] });
            }

        }
    });
    return polyPoints;
}

function getBezierExtremeT(pts) {
    let tArr = pts.length === 4 ? cubicBezierExtremeT(pts[0], pts[1], pts[2], pts[3]) : quadraticBezierExtremeT(pts[0], pts[1], pts[2]);
    return tArr;
}

// cubic bezier.
function cubicBezierExtremeT(p0, cp1, cp2, p) {
    let [x0, y0, x1, y1, x2, y2, x3, y3] = [p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y];

    /**
     * if control points are within 
     * bounding box of start and end point 
     * we cant't have extremes
     */
    let top = min(p0.y, p.y);
    let left = min(p0.x, p.x);
    let right = max(p0.x, p.x);
    let bottom = max(p0.y, p.y);

    if (
        cp1.y >= top && cp1.y <= bottom &&
        cp2.y >= top && cp2.y <= bottom &&
        cp1.x >= left && cp1.x <= right &&
        cp2.x >= left && cp2.x <= right
    ) {
        return []
    }

    var tArr = [],
        a, b, c, t, t1, t2, b2ac, sqrt_b2ac;
    for (var i = 0; i < 2; ++i) {
        if (i == 0) {
            b = 6 * x0 - 12 * x1 + 6 * x2;
            a = -3 * x0 + 9 * x1 - 9 * x2 + 3 * x3;
            c = 3 * x1 - 3 * x0;
        } else {
            b = 6 * y0 - 12 * y1 + 6 * y2;
            a = -3 * y0 + 9 * y1 - 9 * y2 + 3 * y3;
            c = 3 * y1 - 3 * y0;
        }
        if (abs(a) < 1e-12) {
            if (abs(b) < 1e-12) {
                continue;
            }
            t = -c / b;
            if (0 < t && t < 1) {
                tArr.push(t);
            }
            continue;
        }
        b2ac = b * b - 4 * c * a;
        if (b2ac < 0) {
            if (abs(b2ac) < 1e-12) {
                t = -b / (2 * a);
                if (0 < t && t < 1) {
                    tArr.push(t);
                }
            }
            continue;
        }
        sqrt_b2ac = sqrt(b2ac);
        t1 = (-b + sqrt_b2ac) / (2 * a);
        if (0 < t1 && t1 < 1) {
            tArr.push(t1);
        }
        t2 = (-b - sqrt_b2ac) / (2 * a);
        if (0 < t2 && t2 < 1) {
            tArr.push(t2);
        }
    }

    var j = tArr.length;
    while (j--) {
        t = tArr[j];
    }
    return tArr;
}

function quadraticBezierExtremeT(p0, cp1, p) {
    /**
     * if control points are within 
     * bounding box of start and end point 
     * we cant't have extremes
     */
    let top = min(p0.y, p.y);
    let left = min(p0.x, p.x);
    let right = max(p0.x, p.x);
    let bottom = max(p0.y, p.y);
    let a, b, t;

    if (
        cp1.y >= top && cp1.y <= bottom &&
        cp1.x >= left && cp1.x <= right
    ) {
        return []
    }

    let [x0, y0, x1, y1, x2, y2] = [p0.x, p0.y, cp1.x, cp1.y, p.x, p.y];
    let extemeT = [];

    for (var i = 0; i < 2; ++i) {
        a = i == 0 ? x0 - 2 * x1 + x2 : y0 - 2 * y1 + y2;
        b = i == 0 ? -2 * x0 + 2 * x1 : -2 * y0 + 2 * y1;
        if (abs(a) > 1e-12) {
            t = -b / (2 * a);
            if (t > 0 && t < 1) {
                extemeT.push(t);
            }
        }
    }
    return extemeT
}

/**
 * split compound paths into 
 * sub path data array
 */
function splitSubpaths(pathData) {

    let subPathArr = [];

    try {
        let subPathIndices = pathData.map((com, i) => (com.type.toLowerCase() === 'm' ? i : -1)).filter(i => i !== -1);

    } catch {
        console.log('catch', pathData);
    }

    let subPathIndices = pathData.map((com, i) => (com.type.toLowerCase() === 'm' ? i : -1)).filter(i => i !== -1);

    // no compound path
    if (subPathIndices.length === 1) {
        return [pathData]
    }
    subPathIndices.forEach((index, i) => {
        subPathArr.push(pathData.slice(index, subPathIndices[i + 1]));
    });

    return subPathArr;
}

/**
 * calculate split command points
 * for single t value 
 */
function splitCommand(points, t) {

    let seg1 = [];
    let seg2 = [];

    let p0 = points[0];
    let cp1 = points[1];
    let cp2 = points[points.length - 2];
    let p = points[points.length - 1];
    let m0, m1, m2, m3, m4, p2;

    // cubic
    if (points.length === 4) {
        m0 = pointAtT([p0, cp1], t);
        m1 = pointAtT([cp1, cp2], t);
        m2 = pointAtT([cp2, p], t);
        m3 = pointAtT([m0, m1], t);
        m4 = pointAtT([m1, m2], t);

        // split end point
        p2 = pointAtT([m3, m4], t);

        // 1. segment
        seg1.push(
            { x: p0.x, y: p0.y },
            { x: m0.x, y: m0.y },
            { x: m3.x, y: m3.y },
            { x: p2.x, y: p2.y },
        );
        // 2. segment
        seg2.push(
            { x: p2.x, y: p2.y },
            { x: m4.x, y: m4.y },
            { x: m2.x, y: m2.y },
            { x: p.x, y: p.y },
        );
    }

    // quadratic
    else if (points.length === 3) {
        m1 = pointAtT([p0, cp1], t);
        m2 = pointAtT([cp1, p], t);
        p2 = pointAtT([m1, m2], t);

        // 1. segment
        seg1.push(
            { x: p0.x, y: p0.y },
            { x: m1.x, y: m1.y },
            { x: p2.x, y: p2.y },
        );

        // 1. segment
        seg2.push(
            { x: p2.x, y: p2.y },
            { x: m2.x, y: m2.y },
            { x: p.x, y: p.y },
        );
    }

    // lineto
    else if (points.length === 2) {
        m1 = pointAtT([p0, p], t);

        // 1. segment
        seg1.push(
            { x: p0.x, y: p0.y },
            { x: m1.x, y: m1.y },
        );

        // 1. segment
        seg2.push(
            { x: m1.x, y: m1.y },
            { x: p.x, y: p.y },
        );
    }
    return [seg1, seg2];
}

/**
 * calculate command extremes
 */

function addExtemesToCommand(p0, values, verbose = false) {

    let pathDataNew = [];

    let type = values.length === 6 ? 'C' : 'Q';
    let cp1 = { x: values[0], y: values[1] };
    let cp2 = type === 'C' ? { x: values[2], y: values[3] } : cp1;
    let p = { x: values[4], y: values[5] };

    // get inner bbox
    let xMax = max(p.x, p0.x);
    let xMin = min(p.x, p0.x);
    let yMax = max(p.y, p0.y);
    let yMin = min(p.y, p0.y);

    let extremeCount = 0;
    let tArr = [];

    if (
        cp1.x < xMin ||
        cp1.x > xMax ||
        cp1.y < yMin ||
        cp1.y > yMax ||
        cp2.x < xMin ||
        cp2.x > xMax ||
        cp2.y < yMin ||
        cp2.y > yMax

    ) {
        let pts = type === 'C' ? [p0, cp1, cp2, p] : [p0, cp1, p];
        tArr = getBezierExtremeT(pts).sort();

        // avoid small t values
        tArr = tArr.filter(t=>t>0.05 && t<0.95);

        if (tArr.length) {
            let commandsSplit = splitCommandAtTValues(p0, values, tArr);
            pathDataNew.push(...commandsSplit);
            extremeCount += commandsSplit.length;
        } else {

            pathDataNew.push({ type: type, values: values });
        }

    }
    // no extremes
    else {
        pathDataNew.push({ type: type, values: values });
    }

    return { pathData: pathDataNew, count: extremeCount, tArr };

}

function addExtremePoints(pathData, verbose = false) {
    let pathDataNew = [pathData[0]];

    // previous on path point
    let p0 = { x: pathData[0].values[0], y: pathData[0].values[1] };
    let M = { x: pathData[0].values[0], y: pathData[0].values[1] };
    let len = pathData.length;

    for (let c = 1; len && c < len; c++) {
        let com = pathData[c];

        let { type, values } = com;
        let valsL = values.slice(-2);
        ({ x: valsL[0], y: valsL[1] });

        if (type !== 'C' && type !== 'Q') {
            pathDataNew.push(com);
        }

        else {
            // add extremes
            if (type === 'C' || type === 'Q') {

                let extremeData = addExtemesToCommand(p0, values, verbose);
                let { pathData, tArr=[]} = extremeData;

                // found extremes?
                if(pathData.length>1){

                   pathData.forEach((com,i)=>{
                       if(i<pathData.length-1){
                           let {values} = com;
                           values.slice(-2);

                       }
                   });

                    if (verbose) {
                        tArr.forEach((t, i) => {
                            pathData[i].t = t;
                        });
                    }
                }

                pathDataNew.push(...pathData);

            }
        }

        p0 = { x: valsL[0], y: valsL[1] };

        if (type.toLowerCase() === "z") {
            p0 = M;
        } else if (type === "M") {
            M = { x: valsL[0], y: valsL[1] };
        }
    }

    return pathDataNew;
}

/**
 * split commands multiple times
 * based on command points
 * and t array
 */
function splitCommandAtTValues(p0, values, tArr, returnCommand = true) {
    let segmentPoints = [];

    if (!tArr.length) {
        return false
    }

    let valuesL = values.length;
    let p = { x: values[valuesL - 2], y: values[valuesL - 1] };
    let cp1, cp2, points;

    if (values.length === 2) {
        points = [p0, p];
    }
    else if (values.length === 4) {
        cp1 = { x: values[0], y: values[1] };
        points = [p0, cp1, p];
    }
    else if (values.length === 6) {
        cp1 = { x: values[0], y: values[1] };
        cp2 = { x: values[2], y: values[3] };
        points = [p0, cp1, cp2, p];
    }

    if (tArr.length) {
        // single t
        if (tArr.length === 1) {
            let segs = splitCommand(points, tArr[0]);
            let points1 = segs[0];
            let points2 = segs[1];
            segmentPoints.push(points1, points2);

        } else {

            // 1st segment
            let t1 = tArr[0];
            let seg0 = splitCommand(points, t1);
            let points0 = seg0[0];
            segmentPoints.push(points0);
            points = seg0[1];

            for (let i = 1; i < tArr.length; i++) {
                t1 = tArr[i - 1];
                let t2 = tArr[i];

                // new t value for 2nd segment
                let t2_1 = (t2 - t1) / (1 - t1);
                let segs2 = splitCommand(points, t2_1);
                segmentPoints.push(segs2[0]);

                if (i === tArr.length - 1) {
                    segmentPoints.push(segs2[segs2.length - 1]);
                }
                // take 2nd segment for next splitting
                points = segs2[1];
            }
        }
    }

    if (returnCommand) {

        let pathData = [];
        let com, values;

        segmentPoints.forEach(seg => {
            com = { type: '', values: [] };
            seg.shift();
            values = seg.map(val => { return Object.values(val) }).flat();
            com.values = values;

            // cubic
            if (seg.length === 3) {
                com.type = 'C';
            }

            // quadratic
            else if (seg.length === 2) {
                com.type = 'Q';
            }

            // lineto
            else if (seg.length === 1) {
                com.type = 'L';
            }
            pathData.push(com);
        });
        return pathData;
    }

    return segmentPoints;
}

/**
 * calculate polygon bbox
 */
function getPolyBBox(vertices, decimals = -1) {
    let xArr = vertices.map(pt => pt.x);
    let yArr = vertices.map(pt => pt.y);
    let left = min(...xArr);
    let right = max(...xArr);
    let top = min(...yArr);
    let bottom = max(...yArr);
    let bb = {
        x: left,
        left: left,
        right: right,
        y: top,
        top: top,
        bottom: bottom,
        width: right - left,
        height: bottom - top
    };

    // round

    if (decimals > -1) {
        for (let prop in bb) {
            bb[prop] = +bb[prop].toFixed(decimals);
        }
    }

    return bb;
}

function checkBBoxIntersections(bb, bb1) {
    let [x, y, width, height, right, bottom] = [
        bb.x,
        bb.y,
        bb.width,
        bb.height,
        bb.x + bb.width,
        bb.y + bb.height
    ];
    let [x1, y1, width1, height1, right1, bottom1] = [
        bb1.x,
        bb1.y,
        bb1.width,
        bb1.height,
        bb1.x + bb1.width,
        bb1.y + bb1.height
    ];
    let intersects = false;
    if (width * height != width1 * height1) {
        if (width * height > width1 * height1) {
            if (x < x1 && right > right1 && y < y1 && bottom > bottom1) {
                intersects = true;
            }
        }
    }
    return intersects;
}

function getPolygonArea(points, tolerance = 0.001) {
    let area = 0;
    for (let i = 0, len = points.length; len && i < len; i++) {
        let addX = points[i].x;
        let addY = points[i === points.length - 1 ? 0 : i + 1].y;
        let subX = points[i === points.length - 1 ? 0 : i + 1].x;
        let subY = points[i].y;
        area += addX * addY * 0.5 - subX * subY * 0.5;
    }
    return area;
}

/**
 * shift starting point
 */
function shiftSvgStartingPoint(pathData, offset) {
    let pathDataL = pathData.length;
    let newStartIndex = 0;
    let lastCommand = pathData[pathDataL - 1]["type"];
    let isClosed = lastCommand.toLowerCase() === "z";

    if (!isClosed || offset < 1 || pathData.length < 3) {
        return pathData;
    }

    let trimRight = isClosed ? 1 : 0;

    // add explicit lineto
    addClosePathLineto(pathData);

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
    ];

    return pathData;
}

/**
 * Add closing lineto:
 * needed for path reversing or adding points
 */

function addClosePathLineto(pathData) {
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

function pathDataToTopLeft2(pathData,
    {
        removeFinalLineto = true,
        startToTop = true,
        bb={x:0,y:0,width:0,height:0}
    } = {}
) {

    let pathDataNew = [];

    let len = pathData.length;
    let M = { x: pathData[0].values[0], y: pathData[0].values[1] };
    let isClosed = pathData[len - 1].type.toLowerCase() === 'z';

    // we can't change starting point for non closed paths
    if (!isClosed) {
        return pathData
    }

    let newIndex = 0;

    // top left point

    if (startToTop) {

        let indices = [];
        for (let i = 0, len = pathData.length; i < len; i++) {
            let com = pathData[i];
            let { type, values } = com;
            if (values.length) {

                let valsL = values.slice(-2);
                let p = { x: valsL[0], y: valsL[1], dist: 0, index: 0 };

                // add square distance

                p.index = i;
                indices.push(p);

            }
        }

        // find top most
        indices = indices.sort((a, b) => a.y - b.y || a.x - b.x);
        newIndex = indices[0].index;

    }

    // reorder 
    pathData = shiftSvgStartingPoint(pathData, newIndex);
    len = pathData.length;

    // update M
    M = { x: pathData[0].values[0], y: pathData[0].values[1] };

    // remove last lineto
    let penultimateCom = pathData[len - 2];
    let penultimateType = penultimateCom.type;
    let penultimateComCoords = penultimateCom.values.slice(-2);

    let tolerance = 0.00001;
    let diffX= abs(penultimateComCoords[0] - M.x);
    let diffY= abs(penultimateComCoords[1] - M.y);

    let isClosingCommand = penultimateType === 'L' && 
    diffX<tolerance && 
    diffY<tolerance;

    if (removeFinalLineto && isClosingCommand) {
        pathData.splice(len - 2, 1);
    }
    pathDataNew.push(...pathData);

    console.log('pathDataToTopLeft2', pathDataNew );

    return pathDataNew
}

/**
 * avoids starting points in the middle of 2 smooth curves
 * can replace linetos with closepaths
 */

function pathDataToTopLeft(pathData, removeFinalLineto = false, startToTop = true) {

    let pathDataNew = [];

    // move starting point to first lineto

    new Set([...pathData.map(com => com.type)]);

    let len = pathData.length;

    let M = { x: pathData[0].values[0], y: pathData[0].values[1] };
    let isClosed = pathData[len - 1].type.toLowerCase() === 'z';

    // we can't change starting point for non closed paths
    if (!isClosed) {
        return pathData
    }
    let newIndex = 0;

    let p0 = { x: 0, y: 0 };

    if (startToTop) {

        let indices = [];
        for (let i = 0, len = pathData.length; i < len; i++) {
            let com = pathData[i];
            let { type, values } = com;
            if (values.length) {

                let valsL = values.slice(-2);
                let p = { x: valsL[0], y: valsL[1], dist: 0, index: 0 };

                // add square distance
                p.dist = getSquareDistance(p0, p);
                p.index = i;

                indices.push(p);

            }
        }

        // find top most
        indices = indices.sort((a, b) => a.dist - b.dist || a.y - b.y);
        newIndex = indices[0].index;

    }

    // reorder 
    pathData = shiftSvgStartingPoint(pathData, newIndex);
    len = pathData.length;

    // remove last lineto
    let penultimateCom = pathData[len - 2];
    let penultimateType = penultimateCom.type;
    let penultimateComCoords = penultimateCom.values.slice(-2);

    let isClosingCommand = penultimateType === 'L' && penultimateComCoords[0] === M.x && penultimateComCoords[1] === M.y;

    if (removeFinalLineto && isClosingCommand) {
        pathData.splice(len - 2, 1);
    }
    pathDataNew.push(...pathData);

    return pathDataNew
}

/**
 * round path data
 * either by explicit decimal value or
 * based on suggested accuracy in path data
 */
function roundPathData(pathData, decimals = -1) {
    // has recommended decimals
    let hasDecimal = decimals == 'auto' && pathData[0].hasOwnProperty('decimals') ? true : false;

    for(let c=0, len=pathData.length; c<len; c++){
        let com=pathData[c];

        if (decimals >-1 || hasDecimal) {
            decimals = hasDecimal ? com.decimals : decimals;

            pathData[c].values = com.values.map(val=>{return val ? +val.toFixed(decimals) : val });

        }
    }    return pathData;
}

function convertPathData(pathData, {
    toShorthands = true,
    toRelative = true,
    decimals = 3
} = {}) {

    if(decimals>-1 && decimals<2) pathData = roundPathData(pathData, decimals);
    if(toShorthands) pathData = pathDataToShorthands(pathData);
    if (toRelative) pathData = pathDataToRelative(pathData);
    if(decimals>-1) pathData = roundPathData(pathData, decimals);
    return pathData
}

/**
 * convert pathData to 
 * This is just a port of Dmitry Baranovskiy's 
 * pathToRelative/Absolute methods used in snap.svg
 * https://github.com/adobe-webplatform/Snap.svg/
 */

function pathDataToAbsoluteOrRelative(pathData, toRelative = false, decimals = -1) {
    if (decimals >= 0) {
        pathData[0].values = pathData[0].values.map(val => +val.toFixed(decimals));
    }

    let M = pathData[0].values;
    let x = M[0],
        y = M[1],
        mx = x,
        my = y;

    for (let i = 1, len = pathData.length; i < len; i++) {
        let com = pathData[i];
        let { type, values } = com;
        let newType = toRelative ? type.toLowerCase() : type.toUpperCase();

        if (type !== newType) {
            type = newType;
            com.type = type;

            switch (type) {
                case "a":
                case "A":
                    values[5] = toRelative ? values[5] - x : values[5] + x;
                    values[6] = toRelative ? values[6] - y : values[6] + y;
                    break;
                case "v":
                case "V":
                    values[0] = toRelative ? values[0] - y : values[0] + y;
                    break;
                case "h":
                case "H":
                    values[0] = toRelative ? values[0] - x : values[0] + x;
                    break;
                case "m":
                case "M":
                    if (toRelative) {
                        values[0] -= x;
                        values[1] -= y;
                    } else {
                        values[0] += x;
                        values[1] += y;
                    }
                    mx = toRelative ? values[0] + x : values[0];
                    my = toRelative ? values[1] + y : values[1];
                    break;
                default:
                    if (values.length) {
                        for (let v = 0; v < values.length; v++) {
                            values[v] = toRelative
                                ? values[v] - (v % 2 ? y : x)
                                : values[v] + (v % 2 ? y : x);
                        }
                    }
            }
        }

        let vLen = values.length;
        switch (type) {
            case "z":
            case "Z":
                x = mx;
                y = my;
                break;
            case "h":
            case "H":
                x = toRelative ? x + values[0] : values[0];
                break;
            case "v":
            case "V":
                y = toRelative ? y + values[0] : values[0];
                break;
            case "m":
            case "M":
                mx = values[vLen - 2] + (toRelative ? x : 0);
                my = values[vLen - 1] + (toRelative ? y : 0);
            default:
                x = values[vLen - 2] + (toRelative ? x : 0);
                y = values[vLen - 1] + (toRelative ? y : 0);
        }

        if (decimals >= 0) {
            com.values = com.values.map(val => +val.toFixed(decimals));
        }
    }
    return pathData;
}

function pathDataToRelative(pathData, decimals = -1) {
    return pathDataToAbsoluteOrRelative(pathData, true, decimals)
}

function pathDataToAbsolute(pathData, decimals = -1) {
    return pathDataToAbsoluteOrRelative(pathData, false, decimals)
}

/**
 * apply shorthand commands if possible
 * L, L, C, Q => H, V, S, T
 * reversed method: pathDataToLonghands()
 */
function pathDataToShorthands(pathData, decimals = -1, test = true) {

    /** 
    * analyze pathdata – if you're sure your data is already absolute skip it via test=false
    */
    let hasRel;
    if (test) {
        let commandTokens = pathData.map(com => { return com.type }).join('');
        hasRel = /[astvqmhlc]/g.test(commandTokens);
    }

    pathData = test && hasRel ? pathDataToAbsolute(pathData, decimals) : pathData;

    let comShort = {
        type: "M",
        values: pathData[0].values
    };

    if (pathData[0].decimals) {

        comShort.decimals = pathData[0].decimals;
    }

    let pathDataShorts = [comShort];

    let p0 = { x: pathData[0].values[0], y: pathData[0].values[1] };
    let p;
    let tolerance = 0.01;

    for (let i = 1, len = pathData.length; i < len; i++) {

        let com = pathData[i];
        let { type, values } = com;
        let valuesLast = values.slice(-2);

        // previoius command
        let comPrev = pathData[i - 1];
        let typePrev = comPrev.type;

        p = { x: valuesLast[0], y: valuesLast[1] };

        // first bezier control point for S/T shorthand tests
        let cp1 = { x: values[0], y: values[1] };

        let w = abs(p.x - p0.x);
        let h = abs(p.y - p0.y);
        let thresh = (w + h) / 2 * tolerance;

        let diffX, diffY, diff, cp1_reflected;

        switch (type) {
            case "L":

                if (h === 0 || (h < thresh && w > thresh)) {

                    comShort = {
                        type: "H",
                        values: [values[0]]
                    };
                }

                // V
                else if (w === 0 || (h > thresh && w < thresh)) {

                    comShort = {
                        type: "V",
                        values: [values[1]]
                    };
                } else {

                    comShort = com;
                }

                break;

            case "Q":

                // skip test
                if (typePrev !== 'Q') {

                    p0 = { x: valuesLast[0], y: valuesLast[1] };
                    pathDataShorts.push(com);
                    continue;
                }

                let cp1_prev = { x: comPrev.values[0], y: comPrev.values[1] };
                // reflected Q control points
                cp1_reflected = { x: (2 * p0.x - cp1_prev.x), y: (2 * p0.y - cp1_prev.y) };

                diffX = abs(cp1.x - cp1_reflected.x);
                diffY = abs(cp1.y - cp1_reflected.y);
                diff = (diffX + diffY) / 2;

                if (diff < thresh) {

                    comShort = {
                        type: "T",
                        values: [p.x, p.y]
                    };
                } else {
                    comShort = com;
                }

                break;
            case "C":

                let cp2 = { x: values[2], y: values[3] };

                if (typePrev !== 'C') {

                    pathDataShorts.push(com);
                    p0 = { x: valuesLast[0], y: valuesLast[1] };
                    continue;
                }

                let cp2_prev = { x: comPrev.values[2], y: comPrev.values[3] };

                // reflected C control points
                cp1_reflected = { x: (2 * p0.x - cp2_prev.x), y: (2 * p0.y - cp2_prev.y) };

                diffX = abs(cp1.x - cp1_reflected.x);
                diffY = abs(cp1.y - cp1_reflected.y);
                diff = (diffX + diffY) / 2;

                if (diff < thresh) {

                    comShort = {
                        type: "S",
                        values: [cp2.x, cp2.y, p.x, p.y]
                    };
                } else {
                    comShort = com;
                }
                break;
            default:
                comShort = {
                    type: type,
                    values: values
                };
        }

        // add decimal info
        if (com.decimals || com.decimals === 0) {
            comShort.decimals = com.decimals;
        }

        // round final values
        if (decimals > -1) {
            comShort.values = comShort.values.map(val => { return +val.toFixed(decimals) });
        }

        p0 = { x: valuesLast[0], y: valuesLast[1] };
        pathDataShorts.push(comShort);
    }
    return pathDataShorts;
}

function pathDataRemoveColinear(pathData, tolerance = 0.00001) {

    let pathDataN = [pathData[0]];
    let M = { x: pathData[0].values[0], y: pathData[0].values[1] };
    let p0 = M;
    let p = M;

    for (let c = 1, l = pathData.length; c < l; c++) {

        let com = pathData[c];
        let comN = pathData[c + 1] || pathData[l - 1];
        let p1 = comN.type === 'Z' ? M : { x: comN.values[comN.values.length - 2], y: comN.values[comN.values.length - 1] };

        let { type, values } = com;
        let valsL = values.slice(-2);

        p = type !== 'Z' ? { x: valsL[0], y: valsL[1] } : M;

        let cpts = type === 'C' ?
            [{ x: values[0], y: values[1] }, { x: values[2], y: values[3] }] :
            (type === 'Q' ? [{ x: values[0], y: values[1] }] : []);

        let area = abs(getPolygonArea([p0, ...cpts, p, p1]));

        /**
         * Check for perfectly flat
         */

        // update end point
        p0 = p;

        if (area < tolerance) {

            continue;
        }

        if (type === 'M') {
            M = p;
            p0 = M;
        }

        else if (type === 'Z') {
            p0 = M;
        }

        // proceed and add command
        pathDataN.push(com);

    }

    // add close path
    pathDataN.push({ type: 'Z', values: [] });

    return pathDataN;

}

function fixPathData(pathData, {
    addExtremes = false,
    sortSubPaths = true,
    sortCommands = true,
    fixFlatCubics = true,
    removeCollinear = true
} = {}) {

    let pathDataN = [];

    // find subpaths
    let subPathArr = splitSubpaths(pathData);

    // add more data for bbox
    let subPathData = subPathArr.map(pathData => {
        return { pathData, bb: {}, tolerance: 0 }
    });

    let len = subPathData.length;

    for (let i = 0; i < len; i++) {

        let { pathData } = subPathData[i];

        // add extremes - better bbox
        if (addExtremes) {
            let verbose = true;
            pathData = addExtremePoints(pathData, verbose);
            subPathData[i].pathData = pathData;
        }

        /**
         * get bbox
         */
        let pathPoly = getPathDataVertices(pathData);
        let bb = getPolyBBox(pathPoly);
        let { width, height } = bb;

        // path global tolerance
        subPathData[i].tolerance = (width + height) / 2 * 0.001;

        // subpath bbox
        subPathData[i].bb = bb;

    }

    /**
     * get total bounding box of compound path
     */
    let xArr = subPathData.map(sub => [sub.bb.x, sub.bb.right]).flat();
    let yArr = subPathData.map(sub => [sub.bb.y, sub.bb.bottom]).flat();

    let left = min(...xArr);
    let right = max(...xArr);

    let top = min(...yArr);
    let bottom = max(...yArr);

    let width = right - left;
    let height = bottom - top;

    let bb = {
        x: left,
        y: top,
        left,
        top,
        right,
        bottom,
        width,
        height
    };

    /**
     * sort subpaths
     * to top-left
     * potrace messes this up
     */
    let pt0 = { x: bb.x, y: bb.y };
    subPathData.forEach((sub, s) => {
        // distance to top left
        let pt = { x: sub.bb.x, y: sub.bb.y };
        let dist = getSquareDistance(pt0, pt);
        sub.dist = dist;

    });

    subPathData.sort((a, b) => a.dist - b.dist || a.bb.y - b.bb.y);

    /**
     * remove zero length linetos
     * fix extremes close 
     * to adjacent beziers
     */

    for (let i = 0; i < len; i++) {

        let { pathData, tolerance, bb } = subPathData[i];

        // remove zero linetos
        pathData = removeZeroLengthLinetos(pathData);

        // sort to top left
        pathData = pathDataToTopLeft2(pathData, { bb });

        pathData = pathDataRemoveColinear(pathData);

        pathDataN.push(...pathData);

    }

    pathDataN = convertPathData(pathDataN);

    return pathDataN;

}

function removeZeroLengthLinetos(pathData) {

    let M = { x: pathData[0].values[0], y: pathData[0].values[1] };
    let p0 = M;
    let p = p0;

    let pathDataN = [pathData[0]];

    for (let c = 1, l = pathData.length; c < l; c++) {
        let com = pathData[c];
        let { type, values, t = 0 } = com;

        let valsL = values.slice(-2);
        p = { x: valsL[0], y: valsL[1] };

        if (type === 'L' && p.x === p0.x && p.y === p0.y) {

            continue
        }

        pathDataN.push(com);
        p0 = p;
    }

    return pathDataN

}

/**
* serialize pathData array to 
* d attribute string 
*/
function pathDataToD(pathData, decimals = -1, minify = false) {
    // implicit l command
    if (pathData[1].type === "l" && minify) {
        pathData[0].type = "m";
    }
    let d = `${pathData[0].type}${pathData[0].values.join(" ")}`;

    for (let i = 1; i < pathData.length; i++) {
        let com0 = pathData[i - 1];
        let com = pathData[i];

        let type = (com0.type === com.type && minify) ?
            " " : (
                (com0.type === "m" && com.type === "l") ||
                (com0.type === "M" && com.type === "l") ||
                (com0.type === "M" && com.type === "L")
            ) && minify ?
                " " : com.type;

        // round
        if (com.values.length && decimals > -1) {
            com.values = com.values.map(val => { return +val.toFixed(decimals) });
        }
        d += `${type}${com.values.join(" ")}`;
    }

    if (minify) {
        d = d
            .replaceAll(" 0.", " .")
            .replaceAll(" -", "-")
            .replaceAll("-0.", "-.")
            .replace(/\s+([mlcsqtahvz])/gi, "$1")
            .replaceAll("Z", "z");
    }

    return d;
}

function getSVG(pathDataArray, width, height, {
    toRelative = true,
    toShorthands = true,
    decimals = 3,
    addDimensions = false,
    optimize = false
} = {}) {

    width = ceil(width);
    height = ceil(height);

    /**
     * analyze subpaths
     * and poly approximation for 
     * overlap checking
     */

    let subPathArr = [];
    let l = pathDataArray.length;
    let includeCpts = true;

    for (let i = 0; i < l; i++) {
        let pathData = pathDataArray[i];

        // we already know the bbox from Potrace
        let bb = pathData[0].bb;

        // include control points for better overlapping approximation
        let poly = getPathDataVertices(pathData, includeCpts);
        subPathArr.push({ pathData, bb, poly, includes: [] });
    }

    /**
     * optimize:
     * starting point
     * remove colinear/flat segments
     */

    if (optimize) {
        for (let i = 0, l = subPathArr.length; i < l; i++) {

            let { pathData, bb } = subPathArr[i];

            // remove zero length linetos
            pathData = removeZeroLengthLinetos(pathData);

            // sort to top left
            pathData = pathDataToTopLeft(pathData);

            // remove colinear/flat
            pathData = pathDataRemoveColinear(pathData);

            // update
            subPathArr[i].pathData = pathData;
        }
    }

    /**
     * check overlapping 
     * sub paths
     */
    for (let i = 0, l = subPathArr.length; i < l; i++) {
        let sub1 = subPathArr[i];
        let { bb, poly } = sub1;

        for (let j = 0; j < l; j++) {

            let sub1 = subPathArr[j];
            if (i === j) continue;

            let [bb1, poly1] = [sub1.bb, sub1.poly];

            // sloppy bbox intersection test
            let intersects = checkBBoxIntersections(bb, bb1);
            if (!intersects) continue;

            // test sample on-path points
            let ptM = { x: bb1.x + bb1.width * 0.5, y: bb1.y + bb1.height * 0.5 };
            let pt2 = poly1[0];
            let pt3 = poly1[floor(poly1.length / 2)];
            let pt4 = poly1[poly1.length - 1];

            let pts = [ptM, pt2, pt3, pt4];
            let inPoly = false;

            for (let i = 0; i < pts.length; i++) {
                let pt = pts[i];
                if (isPointInPolygon(pt, poly, bb, true)) {
                    inPoly = true;
                    break
                }
            }

            if (inPoly) {
                subPathArr[i].includes.push(j);
            }
        }
    }

    /**
     * combine overlapping 
     * compound paths
     */
    for (let i = 0, l = subPathArr.length; i < l; i++) {
        let sub = subPathArr[i];
        let { includes } = sub;

        includes.forEach(s => {
            let pathData = subPathArr[s].pathData;
            if (pathData.length) {
                subPathArr[i].pathData.push(...pathData);
                subPathArr[s].pathData = [];
            }
        });
    }

    // remove empty els due to grouping
    subPathArr = subPathArr.filter(sub => sub.pathData.length);

    // clone sub pathdata array
    let pathDataArr = JSON.parse(JSON.stringify(subPathArr)).map(pd => pd.pathData);

    // flat path data 
    let pathData = JSON.parse(JSON.stringify(pathDataArr)).flat();

    // Add explicit dimension attributes sometimes reasonable for graphic editors
    let dimAtts = addDimensions ? `width="${width}" height="${height}" ` : '';

    let svgSplit = `<svg viewBox="0 0 ${width} ${height}" ${dimAtts}xmlns="http://www.w3.org/2000/svg">`;
    let dArr = [];
    subPathArr.forEach(sub => {
        let { pathData } = sub;

        try {
            if (toRelative || toShorthands || decimals != -1) {
                pathData = convertPathData(pathData, { toRelative, toShorthands, decimals });
            }
            let d = pathDataToD(pathData, decimals);

            dArr.push(d);
            svgSplit += `<path d="${d}"/>`;

        } catch {
            console.warn('catch pathdata could not be parsed', pathData);
        }
    });

    svgSplit += '</svg>';

    /**
     * combined pathData-  single path
     * optimize pathData
     * apply shorthands where possible
     * convert to relative commnds
     * round
     */

    if (toRelative || toShorthands || decimals != -1) pathData = convertPathData(pathData, { toRelative, toShorthands, decimals });
    let d = pathDataToD(pathData, decimals);
    let svg = `<svg viewBox="0 0 ${width} ${height}" ${dimAtts}xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`;

    return { width, height, commands: pathData.length, svg, d, svgSplit, dArr, pathData, pathDataArr }

}

function PotraceObj(data = {}) {
    Object.assign(this, data);
}

PotraceObj.prototype.getSVG = function (split=false) {
    return !split ? this.svg : this.svgSplit;
};

PotraceObj.prototype.getPathData = function () {
    return this.pathDataNorm
};

PotraceObj.prototype.getPathDataNorm = function () {
    return this.pathDataNorm
};

PotraceObj.prototype.getD = function () {
    return this.d
};

async function PotracePlus(input, {

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
    scale = 1 / scaleAdjust;

    // get SVG data
    let pathDataArray= getPotracePathData(pathList, scale);
    let pathData = pathDataArray.flat();

    if (!pathData.length) {
        throw new Error("Couldn't trace image")

    }

    let data = getSVG(pathDataArray, width, height, { addDimensions, toRelative, toShorthands, optimize, decimals });

    data.scaleAdjust = scaleAdjust;

    // return object
    return new PotraceObj(data);

}

if (typeof window !== 'undefined') {

    window.pathDataToD = pathDataToD;

    window.PotracePlus = PotracePlus;
    window.svg2Canvas = svg2Canvas;
}

export { PI$1 as PI, PotraceObj, PotracePlus, abs$1 as abs, acos$1 as acos, asin$1 as asin, atan$1 as atan, atan2$1 as atan2, ceil$1 as ceil, cos$1 as cos, exp$1 as exp, fixPathData, floor$1 as floor, hypot, log$1 as log, max$1 as max, min$1 as min, pow$1 as pow, random$1 as random, round$1 as round, sin$1 as sin, sqrt$1 as sqrt, svg2Canvas, tan$1 as tan };
