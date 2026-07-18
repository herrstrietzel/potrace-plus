
import { PotracePlus, getSVG, imgDataFromSrc } from '../../dist/potrace-plus.esm.js'

// potrace object
let traced = {}
let lastFile = '';
let lastFileSize = 0;
let lastSettings = '';
let lastSrc='';
let isLarge = false;

window.addEventListener('DOMContentLoaded', (e) => {

    const imgPreview = document.getElementById('imgPreview')


    let settings = enhanceInputsSettings;

    // init
    updateSVG(imgPreview, settings)

    // show markers
    showMarkersInPreview(previewTraced, settings)

    // clip
    clipPreview(previewWrp, settings)


    /**
     * update image
     */

    inputFile.addEventListener('input', async (e) => {
        let file = inputFile.files[0];
        let { size, name } = file;
        let sizeKB = +(size / 1024).toFixed(1)

        //console.log(size, name );

        isLarge=sizeKB > 500;

        if (isLarge) {
            //alert('too large ' + sizeKB + ' KB')

            if (!window.confirm(`This image is quite large ${sizeKB} KB – processing may take a while.\n Wanna proceed?`)) {
                inputFile.value = '';
                return
            }

            document.body.classList.add('processing')

            // reduce max bmp size
            //settings.minSize = 500;
            //settings.maxSize = 1500;

            // prefer worker to prevent UI freezing
            //settings.split = true;
            settings.useWorker = true;

        }

        //console.log(file, sizeKB);

        let sameSrc = name === lastFile && size === lastFileSize;
        console.log('sameSrc', sameSrc, 'lastFile', lastFile, 'lastFileSize', lastFileSize);

        let src = await URL.createObjectURL(file);
        imgPreview.src = src;

        //let imgData = await imgDataFromSrc(src, settings);
        //console.log(imgData);


        lastFile = name;
        lastFileSize = size;

        //updateSVG(imgPreview, settings)
        //document.dispatchEvent(new Event('settingsChange'))

    }, true)



    async function updateSVG(imgPreview, settings) {

        
        if(isLarge) {
            console.log('isLarge', isLarge);
            document.body.classList.add('processing')
        }

        //if(settings.split) settings.optimize = true
        //if(settings.optimize) settings.split = true


        let { minSize, maxSize, crop, scale, brightness, contrast, invert, blur, optimize, clip, minifyD, split } = settings

        let newSettings = JSON.stringify({ minSize, maxSize, crop, scale, brightness, contrast, optimize, split, invert, blur })

        //console.log('newSettings', newSettings);

        let newSrc= imgPreview.src !== lastSrc;
        let needsRetrace = newSrc  ||  lastSettings !== newSettings;

        //console.log('needsRetrace', needsRetrace, newSettings, lastSrc);

        let t0 = 0, t1 = 0;

        // retrace
        t0 = performance.now()

        if (needsRetrace) {

            //document.body.classList.add('processing')
            settings.recode=false;

            try {
                traced = await PotracePlus(imgPreview, settings);
            }

            catch {
                console.warn("Could't trace image – please try another filter setting or reset settings")
            }
        }

        // just change SVG output e.g relative or shorthand optimization
        else {
            
            //settings.optimize = false;
            //settings.reorder = false;
            //console.log('no retracing');
            
            settings.recode=true

            let svgN = getSVG(traced.pathDataArr, traced.width, traced.height, settings)


            //console.log(svgN);
            traced.d = svgN.d
            traced.dArr = svgN.dArr
            traced.pathData = svgN.pathData
            traced.svg = svgN.svg
            traced.svgSplit = svgN.svgSplit
        }

        t1 = performance.now() - t0;

        let { svg, svgSplit, d, width, height, commands, pathData, bb, w, h, scaleAdjust } = traced

        console.log(traced);

        let blobSvg = new Blob([svg]);
        let size = +(blobSvg.size / 1024).toFixed(3)
        let sizePath = +(new Blob([d]).size / 1024).toFixed(3)

        // return splited or combined svg
        let traced_svg = !split ? svg : svgSplit;

        // downloadLink
        btnSvg.href = URL.createObjectURL(blobSvg);

        // filters
        invert = !invert ? '0' : '1';
        let filter = `filter:grayscale(1) invert(${invert}) blur(${blur}px) brightness(${brightness}) contrast(${contrast});`;

        imgPreview.style.cssText = filter;

        // save last src
        lastSrc = imgPreview.src;
        lastSettings = newSettings;


        // summary
        info.textContent =
            `commands: ${commands} \nwidth: ${width}\nheight: ${height} \nsize (svg): ${size} KB \nsize (path): ${sizePath} KB \ntime: ${+t1.toFixed(3)} ms`

        // show markup
        svgOut.value = traced_svg;
        svgOutPath.value = d;

        //render
        previewTraced.innerHTML = '';
        previewTraced.insertAdjacentHTML('beforeend', traced_svg)



        /**
         * adjust SVG preview viewBox for cropping
         */

        let previewSVG = previewTraced.querySelector('svg');
        previewSVG.setAttribute('viewBox', [-bb.x / scaleAdjust, -bb.y / scaleAdjust, w, h].join(' '))
        previewSVG.setAttribute('width', w)
        previewSVG.setAttribute('height', h)


        // update PDF download 
        btnDownload.href = '';

        // create pdf on btn hover
        btnDownload.addEventListener('mouseover', (e) => {
            if (!btnDownload.getAttribute('href')) {
                let url = traced.getPdf();
                btnDownload.href = url;
            }
        })

        // hide loading indicators
        document.body.classList.remove('processing')

    }


    document.addEventListener('settingsChange', async (e) => {
        //console.log('new settings', settings);
        updateSVG(imgPreview, settings)
    })

    // show markers
    inpShowCommands.addEventListener('input', (e) => {
        showMarkersInPreview(previewTraced, settings)
    })


    // preview slider
    inpClip.addEventListener('input', (e) => {
        clipPreview(previewWrp, settings)
    })


})




function clipPreview(target, settings) {
    let clipCSS = Math.ceil(100 - settings.clip);
    target.style.cssText = `--clip:${clipCSS}%; --clipRaster:${settings.clip}%;`;
}

function showMarkersInPreview(target, settings = {}) {

    if (settings.showCommands) {
        target.classList.add('showMarkers')

    } else {
        target.classList.remove('showMarkers')
    }
}
