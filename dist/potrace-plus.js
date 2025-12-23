(function (exports) {
    'use strict';

    var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
    const {
        abs, acos, asin, atan, atan2, ceil, cos, exp, floor,
        log, hypot, max, min, pow, random, round, sin, sqrt, tan, PI
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
     * Bitmap constructor class
     */
    class Bitmap {
        constructor(w, h, data = null, buffer = null) {
            this.w = w;
            this.h = h;
            this.size = w * h;
            this.arraybuffer = buffer ?? new ArrayBuffer(this.size);

            this.data = data ? data : new Int8Array(this.arraybuffer);
        }

        at(x, y) {
            return (
                x >= 0 && x < this.w &&
                y >= 0 && y < this.h &&
                this.data[this.w * y + x] === 1
            );
        }

        index(i) {
            const y = floor(i / this.w);
            return { x: i - y * this.w, y };
        }

        flip(x, y) {
            const idx = this.w * y + x;
            this.data[idx] ^= 1; 

        }

        copy() {
            const bmp = new Bitmap(this.w, this.h);
            bmp.data.set(this.data);
            return bmp;
        }

        /** Rehydrate from postMessage() data */
        static from(obj) {

            return new Bitmap(obj.w, obj.h, obj.data, obj.arraybuffer);
        }
    }

    /**
     * convert inputs to digestable
     * 1-bit (black and white) image data
     */

    async function getBmp(input, {
        minSize = 1000,
        maxSize = 2500,
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

        let w = width;
        let h = height;

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

        return { bmp, scaleAdjust, width, height, bb, w, h }
    }

    /**
     * render src to
     * canvas to retrieve
     * image data
     */

    async function imgDataFromSrc(src = '',
        { minSize = 1000,
            maxSize = 2500,
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

        if (res.ok) {
            let blob = await res.blob();

            let { type } = blob;

            // is raster image
            if (type !== 'image/svg+xml') {
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
            scaleAdjust = ((dimMin < minSize || dimMin > maxSize)) ? minSize / dimMin : 1;

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

    async function svg2Canvas(el, { minSize = 1000, maxSize = 2500, filter = '', scale = 1, canvas = null } = {}) {

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
        getPolygon = true
    } = {}) {

        /**
         * processing
         */
        let pathList = [];
        let polygons = [];

        const bmpToPathlist = () => {

            let bmp1 = bmp.copy();
            let currentPoint = { x: 0, y: 0 }, path;

            const findNext = (pt) => {
                let i = bmp1.w * pt.y + pt.x;
                while (i < bmp1.size && bmp1.data[i] !== 1) {
                    i++;
                }
                return i < bmp1.size && bmp1.index(i);
            };

            const majority = (x, y) => {
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
            };

            const findPath = (pt) => {
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
            };

            const xorPath = (path) => {
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
            };

            while (currentPoint = findNext(currentPoint)) {

                path = findPath(currentPoint);
                xorPath(path);

                if (path.area > turdsize) {
                    pathList.push(path);
                }
            }

            return pathList;
        };

        const processPath = () => {

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

            const mod = (a, n) => {
                return a >= n ? a % n : a >= 0 ? a : n - 1 - (-1 - a) % n;
            };

            const xprod = (p1, p2) => {
                return p1.x * p2.y - p1.y * p2.x;
            };

            const cyclic = (a, b, c) => {
                if (a <= c) {
                    return (a <= b && b < c);
                } else {
                    return (a <= b || b < c);
                }
            };

            const sign = (i) => {
                return i > 0 ? 1 : i < 0 ? -1 : 0;
            };

            const quadform = (Q, w) => {
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
            };

            const interval = (lambda, a, b) => {
                return { x: a.x + lambda * (b.x - a.x), y: a.y + lambda * (b.y - a.y) }
            };

            const dorth_infty = (p0, p2) => {
                return { x: -sign(p2.y - p0.y), y: sign(p2.x - p0.x) }
            };

            const ddenom = (p0, p2) => {
                let r = dorth_infty(p0, p2);
                return r.y * (p2.x - p0.x) - r.x * (p2.y - p0.y);
            };

            const getProd = (type = '', p0 = {}, p1 = {}, p2 = {}, p3 = {}) => {
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
            };

            const ddist = (p, q) => {
                return sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);

            };

            const bezier = (t, p0, p1, p2, p3) => {
                let s = 1 - t;
                return { x: s * s * s * p0.x + 3 * (s * s * t) * p1.x + 3 * (t * t * s) * p2.x + t * t * t * p3.x, y: s * s * s * p0.y + 3 * (s * s * t) * p1.y + 3 * (t * t * s) * p2.y + t * t * t * p3.y };
            };

            const tangent = (p0, p1, p2, p3, q0, q1) => {

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
            };

            const calcSums = (path) => {

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
            };

            const calcLon = (path) => {

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
            };

            const bestPolygon = (path) => {

                const penalty3 = (path, i, j) => {

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
                };

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

            };

            const adjustVertices = (path) => {

                const pointslope = (path, i, j, ctr, dir) => {

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
                };

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
            };

            const reverse = (path) => {
                let curve = path.curve, m = curve.n, v = curve.vertex, i, j, tmp;

                for (i = 0, j = m - 1; i < j; i++, j--) {
                    tmp = v[i];
                    v[i] = v[j];
                    v[j] = tmp;
                }
            };

            const smooth = (path) => {
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
            };

            // start opt
            const optiCurve = (path) => {

                function Opti() {
                    this.pen = 0;
                    this.c = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
                    this.t = 0;
                    this.s = 0;
                    this.alpha = 0;
                }

                const opti_penalty = (path, i, j, res, opttolerance, convc, areac) => {
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

                    if (A2 === A1) return 1;

                    t = A3 / (A3 - A4);
                    s = A2 / (A2 - A1);
                    A = A2 * t / 2.0;

                    if (A === 0) return 1;

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
                };

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
            };

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

        };

        /**
         * run tracing
         */

        bmpToPathlist();
        processPath();

        return { pathList, polygons };

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

    function pathDataToTopLeft(pathData, removeFinalLineto = false, startToTop = true) {

        let pathDataNew = [];
        let len = pathData.length;
        let M = { x: pathData[0].values[0], y: pathData[0].values[1] };
        let isClosed = pathData[len - 1].type.toLowerCase() === 'z';

        // we can't change starting point for non closed paths
        if (!isClosed) {
            return pathData
        }

        let newIndex = 0;

        if (startToTop) {

            let indices = [];
            for (let i = 0, len = pathData.length; i < len; i++) {
                let com = pathData[i];
                let { type, values } = com;
                if (values.length) {

                    let valsL = values.slice(-2);
                    let p = { x: valsL[0], y: valsL[1], dist: 0, index: 0 };
                    p.index = i;
                    indices.push(p);
                }
            }

            // find top most
            indices = indices.sort((a, b) => a.x - b.x || a.y - b.y);
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

    /**
    * serialize pathData array to 
    * d attribute string 
    */

    function pathDataToD(pathData, optimize = 0) {

        optimize = parseFloat(optimize);

        let beautify = optimize > 1;
        let minify = beautify || optimize ? false : true;

        // Convert first "M" to "m" if followed by "l" (when minified)
        if (pathData[1].type === "l" && minify) {
            pathData[0].type = "m";
        }

        let d = '';
        let suff = beautify ? `\n` : ' ';

        if (minify) {
            d = `${pathData[0].type} ${pathData[0].values.join(" ")}`;
        } else {
            d = `${pathData[0].type} ${pathData[0].values.join(" ")}${suff}`;
        }

        for (let i = 1, len = pathData.length; i < len; i++) {
            let com0 = pathData[i - 1];
            let com = pathData[i];
            let { type, values } = com;

            // Minify Arc commands (A/a) – actually sucks!
            if (minify && (type === 'A' || type === 'a')) {
                values = [
                    values[0], values[1], values[2],
                    `${values[3]}${values[4]}${values[5]}`,
                    values[6]
                ];
            }

            // Omit type for repeated commands
            type = (com0.type === com.type && com.type.toLowerCase() !== 'm' && minify)
                ? " "
                : (
                    (com0.type === "m" && com.type === "l") ||
                    (com0.type === "M" && com.type === "l") ||
                    (com0.type === "M" && com.type === "L")
                ) && minify
                    ? " "
                    : com.type;

            // concatenate subsequent floating point values
            if (minify) {

                let valsString = '';
                let prevWasFloat = false;

                for (let v = 0, l = values.length; v < l; v++) {
                    let val = values[v];
                    let valStr = val.toString();
                    let isFloat = valStr.includes('.');
                    let isSmallFloat = isFloat && abs(val) < 1;

                    // Remove leading zero from small floats *only* if the previous was also a float
                    if (isSmallFloat && prevWasFloat) {
                        valStr = valStr.replace(/^0\./, '.');
                    }

                    // Add space unless this is the first value OR previous was a small float
                    if (v > 0 && !(prevWasFloat && isSmallFloat)) {
                        valsString += ' ';
                    }

                    valsString += valStr;

                    prevWasFloat = isSmallFloat;
                }

                d += `${type}${valsString}`;

            }
            // regular non-minified output
            else {
                d += `${type} ${values.join(' ')}${suff}`;
            }
        }

        if (minify) {
            d = d
                .replace(/ 0\./g, " .") // Space before small decimals
                .replace(/ -/g, "-")     // Remove space before negatives
                .replace(/-0\./g, "-.")  // Remove leading zero from negative decimals
                .replace(/Z/g, "z");     // Convert uppercase 'Z' to lowercase
        }

        return d;
    }

    function pathDataArrayToPDF(pathDataArray = [], { width = 0, height = 0 } = {}) {

        let content = '';
        pathDataArray.forEach(pathData => {
            content += pathDataToPDF(pathData, { height })+`\n`;
        });

        let contentLength = new TextEncoder().encode(content).length;

        let pdf = `%PDF-1.4\n`;
        let objects = [
            '<<\n/Type /Catalog\n/Pages 2 0 R\n>>',
            `<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>`,
            `<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 ${width} ${height}]\n/Contents 4 0 R\n>>`,
            `<<\n/Length ${contentLength}\n>>\nstream\n${content}endstream`,
        ];

        let xref = [];
        for (let i = 0; i < objects.length; i++) {
            xref.push(pdf.length);
            pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
        }

        let xrefPos = new TextEncoder().encode(pdf).length;

        pdf += `xref\n0 ${objects.length + 1}\n`;
        pdf += '0000000000 65535 f \n';
        for (let pos of xref) {
            pdf += `${String(pos).padStart(10, '0')} 00000 n \n`;
        }

        pdf += `trailer\n<<\n/Size ${objects.length + 1}\n/Root 1 0 R\n>>\n`;
        pdf += `startxref\n${xrefPos}\n%%EOF`;

        return pdf;
    }

    function pathDataToPDF(pathData, { height = 0, decimals=3 } = {}) {

        let pdf = [
                `q`,
                `0 0 0 1 k`,        
        ];

        pathData.forEach(com => {
            let { type, values } = com;
            if (values.length) {

                // apply offset
                let yOff = height;

                for (let i = 1, l = values.length; i < l; i += 2) {
                    values[i - 1] = (values[i - 1]).toFixed(decimals);
                    values[i] = +(yOff - values[i]).toFixed(decimals);
                }
            }
            let comPdf =  values.length ? `${values.join(' ')} ${type.toLowerCase()}` : 'h';
            pdf.push(
                comPdf,
            );
        });

        pdf.push(`f`,`Q`);
        
        let res =  pdf.join('\n');

        return res
    }

    function getSVG(pathDataArray, width, height, {
        toRelative = true,
        toShorthands = true,
        decimals = 3,
        addDimensions = false,
        optimize = true,
        getPDF= true,
        minifyD = true,
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
                let d = pathDataToD(pathData, minifyD);

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
        let d = pathDataToD(pathData, minifyD);
        let svg = `<svg viewBox="0 0 ${width} ${height}" ${dimAtts}xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`;

        // generate PDF output
        let pdf = '';
        if(getPDF){
            try {
                pdf = pathDataArrayToPDF(pathDataArr, { width, height });
            } catch {
                console.warn('pdf generation failed');
            }
        }

        return { width, height, commands: pathData.length, svg, d, svgSplit, dArr, pathData, pathDataArr, pdf }

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

    async function getExistingPath(url=''){
        if(!url) return false;

        // check relative paths
        let paths = url.split('/').filter(Boolean);
        let isRel = paths[0]==='.';

        if(isRel) url = url.slice(1);

        if(paths.length===1 || isRel){
            let scriptUrl = getCurrentScriptUrl();
            url = `${scriptUrl}/${url}`;
        }

        let exists = false;
        try{
            let res = await fetch(url, { method: "HEAD" });
            exists = res.ok ? url : false;
        }catch{
            console.warn('file does not exist');
        }
        return exists;
    }

    function getCurrentScriptUrl() {
        try {
            /** 2. try error API */
            let stackLines = new Error().stack.split('\n');
            let relevantLine = stackLines[1] || stackLines[2];
            if (!relevantLine) return null;

            // Extract URL using a more comprehensive regex
            let urlError = relevantLine.match(/(https?:\/\/[^\s]+)/)[1]
                .split('/')
                .slice(0, -1)
                .join('/');

            return urlError;

        } catch (e) {
            console.warn("Could not retrieve script path", e);
            return null;
        }
    }

    function PotraceObj(data = {}) {
        Object.assign(this, data);
    }

    // get PDF Object URL
    PotraceObj.prototype.getPdf = function () {
        const objectURL = URL.createObjectURL(new Blob([this.pdf], { type: 'application/pdf' }));
        return objectURL;
    };

    PotraceObj.prototype.getSVG = function (split = false) {
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

    const PotracePlusWorkerUrl = './potrace-plus.workers.js';

    async function PotracePlus(input, {

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

        let workerExists = await getExistingPath(PotracePlusWorkerUrl);
        if (!workerExists) {
            console.warn(`Worker JS file does not exist.\nYou can download it from the github repo:\nhttps://raw.githubusercontent.com/herrstrietzel/potrace-plus/refs/heads/main/dist/potrace-plus.workers.js`);
        }

        useWorker = useWorker && typeof Worker === 'undefined' || !workerExists ? false : useWorker;

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
        };

        // get potrace pathlist 
        let type = 'pathlist';

        let pathListData = (!useWorker ? potraceGetPathList(bmp, settings) : await potrace_worker(type, { bmp, options: settings }));
        let { pathList, polygons } = pathListData;

        /**
         * get pathData (and stringified "d")
         * and svg markup
         */

        scale = 1 / scaleAdjust; // scale back resized

        let svgData = {};
        type = 'svgData';
        let paramsSvg = {
            pathList,
            polygons,
            scale,
            scaleAdjust,
            ...settings
        };

        svgData = !useWorker ? getSVGData(paramsSvg) : await potrace_worker(type, paramsSvg);

        return new PotraceObj(svgData);

    }

    function getSVGData({
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
        let pathDataArray = getPotracePathData(pathList, scale);
        let pathData = pathDataArray.flat();

        if (!pathData.length) {
            throw new Error("Couldn't trace image")
        }

        let data = getSVG(pathDataArray, width, height, { addDimensions, toRelative, toShorthands, optimize, minifyD, decimals, getPDF });

        data.scaleAdjust = scaleAdjust;
        data.bb = bb;
        data.w = w;
        data.h = h;
        data.polygons = getPolygon ? polygons : [];
        return data;
    }

    function potrace_worker(type = "pathlist", data = {}) {

        return new Promise((resolve, reject) => {

            let worker = new Worker(
                new URL(PotracePlusWorkerUrl, (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('potrace-plus.js', document.baseURI).href)),
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

    if (typeof window !== 'undefined') {
        window.pathDataToD = pathDataToD;
        window.PotracePlus = PotracePlus;
        window.imgDataFromSrc = imgDataFromSrc;

        window.potraceGetPathList = potraceGetPathList;
        window.svg2Canvas = svg2Canvas;
    }

    exports.Bitmap = Bitmap;
    exports.PI = PI;
    exports.PotraceObj = PotraceObj;
    exports.PotracePlus = PotracePlus;
    exports.abs = abs;
    exports.acos = acos;
    exports.asin = asin;
    exports.atan = atan;
    exports.atan2 = atan2;
    exports.ceil = ceil;
    exports.cos = cos;
    exports.exp = exp;
    exports.floor = floor;
    exports.getSVGData = getSVGData;
    exports.hypot = hypot;
    exports.imgDataFromSrc = imgDataFromSrc;
    exports.log = log;
    exports.max = max;
    exports.min = min;
    exports.potraceGetPathList = potraceGetPathList;
    exports.potrace_worker = potrace_worker;
    exports.pow = pow;
    exports.random = random;
    exports.round = round;
    exports.sin = sin;
    exports.sqrt = sqrt;
    exports.svg2Canvas = svg2Canvas;
    exports.tan = tan;

})(this["potrace-plus"] = this["potrace-plus"] || {});
