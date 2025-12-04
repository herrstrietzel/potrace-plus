
let tracingOptions = {
    turnpolicy: "majority",
    //turnpolicy: "right",
    turdsize: 1,
    optcurve: true,
    alphamax: 1,
    opttolerance: 1,

    minSize: 1000,
    maxSize: 5000,

    scale: 1,
    addDimensions: false,
    toRelative: true,
    toShorthands: true,
    decimals: 2,

    crop:true
};

(async () => {

    let el = document.querySelector("#input svg");

    let t1, t0

    // example 1: SVG element

    t0 = performance.now()

    let traced_svgEl = await Potrace(el, tracingOptions);

    t1 = performance.now() - t0;


    // get traced svg data
    let svg_svgEl = traced_svgEl.getSVG()
    console.log('timiing:', t1, traced_svgEl.pathData.length);

    // render
    preview.insertAdjacentHTML('beforeend', svg_svgEl)



    /*
    // canvas 
    let { minSize, maxSize } = tracingOptions;
    let canvas = await svg2Canvas(el, { minSize, maxSize })
    let traced_canvasEl = await Potrace(canvas, tracingOptions);
    let svg_canvas = traced_canvasEl.getSVG()
    document.body.insertAdjacentHTML('beforeend', svg_canvas)
    */

    //blob
    // 
    let blob = new Blob([svg_svgEl], { type: 'image/svg+xml' })
    //console.log(blob);
    //let traced_blob = await Potrace(blob, tracingOptions);
    //document.body.insertAdjacentHTML('beforeend', traced_blob.getSVG())


    // array buffer
    let buffer = await blob.arrayBuffer()
    //let traced_buffer = await Potrace(buffer, tracingOptions);


    //file
    /*
    let file = new File([blob], "test.svg");
    //console.log(blob, file);
    let traced_file = await Potrace(file, tracingOptions);
    document.body.insertAdjacentHTML('beforeend', traced_file.getSVG())
    */

    inputFile.addEventListener('input', async (e) => {
        let file = inputFile.files[0]
        //let buffer = await file.arrayBuffer()
        //console.log(buffer);

        t0 = 0
        let traced_file = await Potrace(file, tracingOptions);
        //let traced_file = await Potrace(buffer, tracingOptions);

        t1 = performance.now()-t0
        console.log('timing', t1);
        document.body.insertAdjacentHTML('beforeend', traced_file.getSVG())


    })


    /*
    // example : img element
    let t0=performance.now()
    let traced_imgEl = await Potrace(imgEl, tracingOptions);
    let svg_imgEl = traced_imgEl.getSVG()
    let t1=performance.now()-t0
    console.log(t1);
    preview.insertAdjacentHTML('beforeend', svg_imgEl)
    */





})();