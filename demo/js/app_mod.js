 
import {PotracePlus, imgDataFromSrc} from '../../dist/potrace-plus.esm.js'

// potrace object
let traced = {}
let lastFile ='';
let lastFileSize =0;

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

        if (sizeKB > 500) {
            //alert('too large ' + sizeKB + ' KB')

            if (!window.confirm(`This image is quite large ${sizeKB} KB – processing may take a while.\n Wanna proceed?`)) {
                inputFile.value = '';
                return
            }

            document.body.classList.add('processing')

            // reduce max bmp size
            settings.minSize = 500;
            //settings.maxSize = 1500;

            // prefer worker to prevent UI freezing
            settings.useWorker = true;

        }

        //console.log(file, sizeKB);

        let sameSrc= name === lastFile && size===lastFileSize;
        console.log('sameSrc', sameSrc, 'lastFile', lastFile, 'lastFileSize', lastFileSize);

        let src = await URL.createObjectURL(file);
        imgPreview.src = src;

        //let imgData = await imgDataFromSrc(src, settings);
        //console.log(imgData);


        lastFile= name;
        lastFileSize= size;

        //updateSVG(imgPreview, settings)
        //document.dispatchEvent(new Event('settingsChange'))

    }, true)



    async function updateSVG(imgPreview, settings) {

        /*
        if(isLarge) {
            //traced =  PotracePlus(imgPreview, settings);
            return
        }
            */

        let t0 = 0, t1 = 0;
        try {
            t0 = performance.now()
            traced = await PotracePlus(imgPreview, settings);
            t1 = performance.now() - t0;
            //console.log(traced);
        } catch {
            alert("Could't trace image – please try another filter setting or reset settings")
        }


        let { brightness, contrast, invert, blur, split, optimize, clip, minifyD } = settings;
        let { svg, svgSplit, d, width, height, commands, pathData, pdf, bb, w, h, scaleAdjust } = traced

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
        btnDownload.href = traced.getPdf()


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
