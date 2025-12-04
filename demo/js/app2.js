// potrace object
let traced = {}


window.addEventListener('DOMContentLoaded', (e) => {

    const imgPreview = document.getElementById('imgPreview')

    let settings = enhanceInputsSettings;
    //console.log(settings);


    // init
    updateSVG(imgPreview, settings)


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

        let t0=0, t1=0;
        try{
            t0=performance.now()
            traced = await PotracePlus(imgPreview, settings);
            t1=performance.now() -t0;
            //console.log(traced);
        }catch{
            alert("Could't trace image – please try another filter setting or reset settings")
        }


        let { brightness, contrast, invert, blur, split } = settings;
        let { svg, svgSplit, d, width, height, commands, pathData } = traced


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

    }



    document.addEventListener('settingsChange', async (e) => {

        //console.log('new settings');
        updateSVG(imgPreview, settings)

        if (settings.showCommands) {
            previewTraced.classList.add('showMarkers')

        } else {
            previewTraced.classList.remove('showMarkers')
        }
    })

})

/**
 * PDF download
 */
btnPDF.addEventListener('click', async (e) => {
    let { d, svg, pathData, width, height } = traced;
    Svg2Pdf(d, width, height)
})


async function Svg2Pdf(d, width, height) {

    const doc = new PDFDocument({
        size: [width, height],
        margins: {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
        }
    });

    // pipe the document to a blob
    const stream = doc.pipe(blobStream());

    doc.lineWidth(0);
    doc.path(d)
    doc.fill()


    // get a blob when you're done
    doc.end();

    // get objectURL for display or download
    stream.on("finish", async function () {
        let blob = stream.toBlob("application/pdf");
        let objectURL = await URL.createObjectURL(blob);

        // set download link
        btnDownload.href = objectURL
        btnDownload.click();
        // render via pdf.js
        //renderPDF(objectURL);
    });

}