// potrace object
let traced = {}


window.addEventListener('DOMContentLoaded', (e) => {

    const imgPreview = document.getElementById('imgPreview')

    let settings = enhanceInputsSettings;

    // init
    updateSVG(imgPreview, settings)

    // show markers
    showMarkersInPreview(previewTraced, settings)

    /**
     * update image
     */

    inputFile.addEventListener('input', async (e) => {
        let file = inputFile.files[0];

        let src = await URL.createObjectURL(file);
        imgPreview.src = src;

        //updateSVG(imgPreview, settings)
        document.dispatchEvent(new Event('settingsChange'))

    }, true)

    //{capture:true}


    async function updateSVG(imgPreview, settings) {

        let t0 = 0, t1 = 0;
        try {
            t0 = performance.now()
            traced = await PotracePlus(imgPreview, settings);
            t1 = performance.now() - t0;
            //console.log(traced);
        } catch {
            alert("Could't trace image – please try another filter setting or reset settings")
        }


        let { brightness, contrast, invert, blur, split, optimize } = settings;
        let { svg, svgSplit, d, width, height, commands, pathData, pdf } = traced

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

        // update PDF download 
        btnDownload.href = traced.getPdf()

    }


    document.addEventListener('settingsChange', async (e) => {
        //console.log('new settings');
        updateSVG(imgPreview, settings)
        showMarkersInPreview(previewTraced, settings)
    })

})

function showMarkersInPreview(target, settings = {}) {

    if (settings.showCommands) {
        target.classList.add('showMarkers')

    } else {
        target.classList.remove('showMarkers')
    }
}

/**
 * PDF download
 */
/*
btnPDF.addEventListener('click', async (e) => {
    let { d, svg, pathData, width, height, pdf } = traced;

    //let objectURL = URL.createObjectURL(new Blob([pdf], {type:'application/pdf'}))
    //btnDownload.href = objectURL

    btnDownload.click();
    //Svg2Pdf(d, width, height)
})
*/
