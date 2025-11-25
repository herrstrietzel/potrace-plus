(function (exports) {
    'use strict';

    const {
        abs, acos, asin, atan, atan2, ceil, cos, exp, floor,
        log, hypot, max, min, pow, random, round, sin, sqrt, tan, PI
    } = Math;

    /**
     * constructors
     */

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

    /**
     * convert inputs to digestable
     * 1-bit (black and white) image data
     */

    function detectInputType(input) {
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

    async function getBmp(input, {
        minSize = 1000,
        maxSize = 5000,
        filter = '',
        scale = 1,
        canvas = null
    } = {}) {
        let type = detectInputType(input);

        let settings = { minSize, maxSize, filter, scale, canvas };

        let canvasImgData;

        if (type === 'img') {

            let src = input.src;
            canvasImgData = await canvasFromSrc(src, settings);

        }

        // convert to 1-bit
        let { imgData, scaleAdjust, width, height } = canvasImgData;
        let bmp = imageDataTo1Bit(imgData);

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
        minSize *= scale;
        maxSize *= scale;

        // create new canvas
        if (!canvas) canvas = new OffscreenCanvas(300, 150);

        let ctx = canvas.getContext('2d');

        let res = await fetch(src);

        if (res.ok) {
            let blob = await res.blob();

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

                img = new Image();
                img.src = src;
                img.crossOrigin = "anonymous";

                // wait for image
                await img.decode();

                w = img.naturalWidth;
                h = img.naturalHeight;

                dimMin = min(w, h);

                // scale up or down
                scaleAdjust = dimMin < minSize || dimMin > maxSize ? minSize / dimMin : 1;

                wS = w * scaleAdjust;
                hS = h * scaleAdjust;

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
        width = ceil(width / scaleAdjust);
        height = ceil(height / scaleAdjust);

        return { imgData, scaleAdjust, width, height }

    }

    /**
     * get black and white bitmap data
     */

    function imageDataTo1Bit(imageData) {
        let { data, width, height } = imageData;
        let bmp = new Bitmap(width, height);
        let l = data.length, color;

        for (let i = 0, j = 0; i < l; i += 4, j++) {

            color = data[i];
            bmp.data[j] = (color < 128 ? 1 : 0);
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

    function getPotracePathData(pathList = [], scale = 1) {

        let len = pathList.length;
        let pathData = [];

        for (let l = 0; l < len; l++) {

            // sub paths starting with ;M
            let curve = pathList[l].curve;
            let n = curve.n, coms;
            pathData.push(
                {
                    type: 'M', values: [
                        curve.c[(n - 1) * 3 + 2].x * scale,
                        curve.c[(n - 1) * 3 + 2].y * scale
                    ]
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

        }

        return pathData

    }

    function getSVG(pathData, w, h, {
        toRelative = true,
        toShorthands = true,
        decimals = 3,
        addDimensions = false,
    } = {}) {

        w = ceil(w);
        h = ceil(h);

        // simplify/cleanup

        /**
         * optimize pathData
         * apply shorthands where possible
         * convert to relative commnds
         * round
         */
        if (toRelative || toShorthands || decimals != -1) pathData = convertPathData(pathData, { toRelative, toShorthands, decimals });

        let d = pathDataToD(pathData, decimals);

        // Add explicit dimension attributes sometimes reasonable for graphic editors
        let dimAtts = addDimensions ? `width="${w}" height="${h}" ` : '';

        let svg = `<svg viewBox="0 0 ${w} ${h}" ${dimAtts}xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`;

        return { svg, d }

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
        opttolerance = 1
    } = {}) {

        /**
         * processing
         */

        let pathlist = [];

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
                    pathlist.push(path);
                }
            }

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

                    px = (pt[i].x + pt[j].x) / 2.0 - pt[0].x;
                    py = (pt[i].y + pt[j].y) / 2.0 - pt[0].y;
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
                    if (d === 0.0) {
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
                        if (det !== 0.0) {
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

                    if (Q.at(0, 0) !== 0.0) {
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

                    if (Q.at(1, 1) !== 0.0) {
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
                    if (denom !== 0.0) {
                        dd = getProd('dpara', curve.vertex[i], curve.vertex[j], curve.vertex[k]) / denom;
                        dd = abs(dd);
                        alpha = dd > 1 ? (1 - 1.0 / dd) : 0;
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

                    if (A === 0.0) {
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
                        if (d === 0.0) {
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
                        if (d === 0.0) {
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

                area = 0.0;
                areac[0] = 0.0;
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

            for (let i = 0; i < pathlist.length; i++) {
                let path = pathlist[i];
                calcSums(path);
                calcLon(path);
                bestPolygon(path);
                adjustVertices(path);

                if (path.sign === "-") {
                    reverse(path);
                }

                smooth(path);

                if (optcurve) {
                    optiCurve(path);
                }
            }

        }

        /**
         * run tracing
         */

        bmpToPathlist();
        processPath();

        return pathlist;

    }

    function PotraceObj(data = {}) {
        Object.assign(this, data);
    }

    PotraceObj.prototype.getSVG = function () {
        return this.svg
    };

    PotraceObj.prototype.getPathData = function () {
        return this.pathData
    };

    PotraceObj.prototype.getD = function () {
        return this.d
    };

    async function Potrace(input, {

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
        scale = 1 / scaleAdjust;

        console.log(toRelative, toShorthands, decimals);

        // get SVG data
        let pathData = getPotracePathData(pathList, scale);
        let pathDataNorm = JSON.parse(JSON.stringify(pathData));
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

    exports.PI = PI;
    exports.Potrace = Potrace;
    exports.PotraceObj = PotraceObj;
    exports.abs = abs;
    exports.acos = acos;
    exports.asin = asin;
    exports.atan = atan;
    exports.atan2 = atan2;
    exports.ceil = ceil;
    exports.cos = cos;
    exports.exp = exp;
    exports.floor = floor;
    exports.hypot = hypot;
    exports.log = log;
    exports.max = max;
    exports.min = min;
    exports.pow = pow;
    exports.random = random;
    exports.round = round;
    exports.sin = sin;
    exports.sqrt = sqrt;
    exports.tan = tan;

})(this["potrace-plus"] = this["potrace-plus"] || {});
