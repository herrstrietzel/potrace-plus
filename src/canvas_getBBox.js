
/**
 * Based on @Blindman67's answer
 * https://stackoverflow.com/questions/45866873/cropping-an-html-canvas-to-the-width-height-of-its-visible-pixels-content/78393275#78393275
 */

export function getBBox_fromCtx(ctx, stripWhite = true, cornerCheck = true, debug = false, target = null) {

    let [w, h] = [ctx.canvas.width, ctx.canvas.height];

    let imgData = ctx.getImageData(0, 0, w, h);
    return getBBox_fromImageData(imgData, stripWhite, cornerCheck, debug, target);
}



export function getBBox_fromImageData(imgData, stripWhite = true, cornerCheck = true, debug = false, target = null) {


    let [w, h] = [imgData.width, imgData.height];


    // no width or height - exit
    if (!w && !h) {
        throw new Error('No width or height specified')
    }


    // collect top and bottom results
    let xArr = []
    let pt;

    let bb = {
        x: 0,
        y: 0,
        width: w,
        height: h
    }


    /**
     * get image data and
     * convert to 32bit pixel color array
     * 255 x 255 x 255 x 0 = 0 => transparent
    */
    let data = new Uint32Array(imgData.data.buffer);


    // find alpha or white
    const tolerance = 100000
    const white = 4294967295 - tolerance


    // debugging: count pixel checks
    let checks = 0
    let svg = '';

    // helper to translate pixel indices to x/y 
    const pixelIndexToXY = (w, h, i) => {
        let y = Math.floor((i) / (w));
        let x = i - y * w;
        return { x, y }
    }


    const isNot = (color = 0, stripWhite = false, px = null) => {
        if (debug && px) {
            checks++
            let pt = pixelIndexToXY(w, h, px)
            svg += `<rect x="${pt.x}" y="${pt.y}" transform="scale(1)" transform-origin="center" width="1" height="1" fill="rgba(0,255,255,0.25)" stroke="none" />`
        }

        return stripWhite ? color < white : color > 0;
    }


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
    let [cropTop, cropLeft, cropRight, cropBottom] = [1, 1, 1, 1]
    let foundCorners = 0;


    if (cornerCheck) {
        let xMid = Math.floor(w / 2);
        let yMid = Math.floor(h / 2);

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

            //let pos = pixelIndexToXY(w,h, idx)
            //console.log(pos);

            // can't be cropped if 4 criteria are fulfilled
            if (!cropTop && !cropBottom && !cropLeft && !cropRight) break;

            if (isNot(data[idx], stripWhite, idx)) {

                if (i === 0) {
                    cropTop = 0
                    cropLeft = 0
                }

                else if (i === 1) {
                    cropBottom = 0
                    cropRight = 0
                }

                else if (i === 2) {
                    cropBottom = 0
                    cropLeft = 0
                }

                else if (i === 3) {
                    cropTop = 0
                    cropLeft = 0
                }

                // mid points
                else if (i === 4) {
                    cropTop = 0
                }

                else if (i === 5) {
                    cropBottom = 0
                }

                else if (i === 6) {
                    cropRight = 0
                }

                else if (i === 7) {
                    cropLeft = 0
                }

                foundCorners++
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
                cropTop = 0

                // top may also be horizontal/left extreme
                xArr.push(x)

                // top and bottom found then stop the search
                if (!cropBottom) {
                    break;
                }
            }

            //checks++
            if (cropBottom && isNot(data[idx2], stripWhite, idx2)) {
                bottom = h - y;
                cropBottom = 0

                // bottom may also be horizontal/right extreme
                pt = pixelIndexToXY(w, h, idx2)
                xArr.push(pt.x)

                // top and bottom found then stop the search
                if (!cropTop) {
                    break;
                }
            }

            idx1++
            idx2--
        }


        // stop loop when both extremes are found
        if (!cropTop && !cropBottom) {
            //console.log('top and bottom', y);
            break
        }


        // nothing to find in top-to-bottom scan - exit
        if (y + 2 >= h - y && !top) {
            if (debug) {
                console.log('image is empty', y, checks, w * h);
                target.insertAdjacentHTML('beforeend', svg)
            }
            return bb
        }

    }

    //if (debug) console.log('cropTop', cropTop, 'cropBottom', cropBottom);


    /**
     * search from left and right to find 
     * first column containing a non transparent pixel.
     */

    for (x = 0; x < w; x++) {
        idx1 = (top + 1) * w + x;
        idx2 = (top) * w + (w - x - 1);

        //console.log('TB', top, bottom, 'idx', idx1, idx2);

        for (y = top; y < bottom - 1; y++) {

            //cropLeft &&
            if (cropLeft && isNot(data[idx1], stripWhite, idx1)) {
                left = x;
                cropLeft = 0;

                //console.log('found left', left, checks);

                if (!cropRight) {
                    break;
                }
            }

            if (cropRight && isNot(data[idx2], stripWhite, idx2)) {
                right = w - x;
                cropRight = 0;

                //console.log('found right', right, checks);

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
    left = Math.min(...xArr, left)
    right = Math.max(...xArr, right)


    bb.x = left;
    bb.y = top;
    bb.width = right - left;
    bb.height = bottom - top;

    if (debug) {
        console.log(checks, w * h, 'skipped:', (w * h - checks), xArr);
        target.insertAdjacentHTML('beforeend', svg)
    }


    return bb;
}



/*
function pixelIndexToXY(w, h, i) {
    // get row
    let y = Math.floor((i) / (w));
    let x = i - y * w;

    return { x, y }
}

function xyToPixelIndex(w, h, x, y) {
    return (y * w + x);
}
*/
