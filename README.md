# potrace-plus

A javascript port of Peter Selinger's [Potrace](http://potrace.sourceforge.net).  
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
* **shape sorting** shapes are sorted from top-left to bottom-right
* **SVG optimizations** colinear/flat segments are simplified
* **PDF export** minimal standalone PDF export
* **polygon export** ... erm Potrace is based on a polygon creation so why not retrieve the unoptimized polygon as a point object array as well?


## Usage

Load script locally or via cdn

```html
<script src="https://cdn.jsdelivr.net/npm/potrace-plus@latest/dist/potrace-plus.min.js"></script>
```

Call potrace in asynchronous function.

```js
(async()=>{
    let traced = await PotracePlus(imgPreview);

    // retrieve all data
    let { svg, svgSplit, d, width, height, commands, pathData, pdf } = traced;

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
    optimize = true,

    // add width and height attribute to SVG
    addDimensions : true,

    // SVG optimization
    toRelative : true,
    toShorthands : true,
    decimals : 3

    // get unoptimized polygon
    getPolygon = true,

    // get PDF data
    getPDF = true


}

let traced = await PotracePlus(imgPreview, options);

```

### Path sorting
Paths and Subpaths are sorted in a more logical order from top-left to bottom right. This is foremost handy for manual editing the output in a graphic editor.

### Path splitting/grouping
By default the tracing object contains 
* `traced.svg` a concatenated SVG file - all shapes are merged into a single path
* `traced.svgSplit` a SVG with individual `<path>` elements for each "logical" shape group

For instance a text-like object "Pot" would return a path for "P", "o" (keeping the compound inner shape intact) and "t".

Bear in mind:  
* this method is not perfect and can only group overlapping shapes – a shape like "i" will be separated to the vertical stem and the dot 
* when aiming at the most compact SVG output , you should prefer the concatenated output as it significantly reduces the document overhead

### SVG Path optimizations
Will remove colinear commands and reduce file-size.  
By default Potrace-plus return relative commands and applies shorthands where possible.
In case you encounter issues, you can disable it via option: 

```js
let traced = await PotracePlus(img, 
    {
        optimize:false,
        toRelative : false,
        toShorthands : false,
        decimals : 3
    }
);
```

If you need to process the pathdata in a normalized format you can also acces this unoptimized pathdata via the `traced.pathDataArr` containing all commands in absolute coordinates – split into sub path chunks.    



### Downgrading
In case you encounter any issues you can try to use the previous version.  
See [all version on npm](https://www.npmjs.com/package/potrace-plus?activeTab=versions).

Analogous you can switch to previous versions for cdn links like so  

```
<script src="https://cdn.jsdelivr.net/npm/potrace-plus@latest/dist/potrace-plus.min.js"></script>
```
to  

```
<script src="https://cdn.jsdelivr.net/npm/potrace-plus@0.1.1/dist/potrace-plus.min.js"></script>
```


### Demo
Check the [webapp](https://herrstrietzel.github.io/potrace-plus) to test different settings – or just to vectorize images.  

