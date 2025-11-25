let el = document.querySelector(".preview svg");

let tracingOptions = {
    turnpolicy: "majority",
    turdsize: 1,
    optcurve: true,
    alphamax: 1,
    opttolerance: 1,

    minSize: 1000,
    maxSize: 5000,

    scale:1,
    addDimensions:false,
    toRelative:true,
    toShorthands:true,
    decimals:2,
};

(async ()=>{

    /*
    // example 1: SVG element
    let traced_svgEl = await Potrace(el, tracingOptions);

    // get traced svg data
    let svg_svgEl = traced_svgEl.getSVG()

    // render
    document.body.insertAdjacentHTML('beforeend', svg_svgEl)
    */


    // example : img element
    let traced_imgEl = await Potrace(imgEl, tracingOptions);
    let svg_imgEl = traced_imgEl.getSVG()
    preview.insertAdjacentHTML('beforeend', svg_imgEl)





})();