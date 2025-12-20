let d=path.getAttribute('d');

let pathObj = getPathLengthLookup(d);
let pathData = pathObj.pathData


let addExtremes=false,
removeClosingLines=true,
startToTop=true,
debug=true;


//console.log('pathData', pathData);

//let pathDataFixed = pathData;

let pathDataFixed = fixPathData(JSON.parse(JSON.stringify(pathData)));

//pathDataFixed = pathData;

console.log('pathDataFixed', pathDataFixed);

let dN = pathDataToD(pathDataFixed)
path.setAttribute('d', dN)



/*
let pathDataClean =  cleanUpPathData(JSON.parse(JSON.stringify(pathData)), addExtremes,
removeClosingLines,
startToTop,
debug)
let d2 = pathDataToD(pathDataClean);

path.setAttribute('d', d2)
*/


//console.log(pathData, pathDataClean);





