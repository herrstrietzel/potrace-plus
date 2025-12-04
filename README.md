# potrace-plus

A javascript port of [Potrace](http://potrace.sourceforge.net).  
Based on [kilobtye's JS port](https://github.com/kilobtye/potrace)


## Features
* **SVG optimization** for smaller file sizes
* convenient API accepting **multiple input formats**  
  * DOM elements: `<img>`, `<canvas>` or `<svg>`
  * `blob` or file objects  
  * URLs/dataURLs
* **filter** options for preprocessing
* **cropping** to actual image boundaries 
* **splitting** into separate paths – retaining compound shapes like "o"


## Usage

Load script locally or via cdn

```html
<script src="https://cdn.jsdelivr.net/npm/potrace-plus@latest/dist/potrace-plus.min.js"></script>
```

Call potrace in asynchronous function.

```js
(async()=>{
    let traced = await PotracePlus(imgPreview);

    // retrieve data
    let { svg, svgSplit, d, width, height, commands, pathData } = traced;

})();
```

#### ESM 

```js

import {PotracePlus} from './dist/potrace-plus.esm.min.js

(async()=>{
    let traced = await PotracePlus(imgPreview);
})();
```


The potrace object contains all relevant data:
* SVG markup for self-contained file – split and single compound path
* SVG path markup
* SVG 2 pathData array – optimized and normalized (all absolute)
* width and height
* command count

You can also use these methods 

```js  

// Get the SVG markup for compound or split paths
traced.getSVG(split=false)

// Get stringified path data - as `d` attribute
traced.getD()

// Get path data array
traced.getPathData()
traced.getPathDataNorm()
```


## Options

```js

let options = {
    /**
     * Potrace options
     * See: https://pythonhosted.org/pypotrace/ref.html
     */
    turnpolicy : "majority",
    turdsize : 1,
    optcurve : true,
    alphamax : 1,
    opttolerance : 1,

    // size adjustments
    minSize : 1000,
    maxSize : 5000,
    scale : 1,

    //filters
    brightness : 1,
    contrast : 1,
    invert : 0,
    blur=0,

    // svg processing
    crop : true,
    split : false,

    // add width and height attribute to SVG
    addDimensions : true,

    // SVG optimization
    toRelative : true,
    toShorthands : true,
    decimals : 3
}

let traced = await PotracePlus(imgPreview, options);

```

### Demo
Check the [webapp](https://herrstrietzel.github.io/potrace-plus) to test different settings – or just to vectorize images.  

This demo app also provides a simple **PDF** download option – powered by [pdfkit](https://github.com/foliojs/pdfkit)

... to be continued