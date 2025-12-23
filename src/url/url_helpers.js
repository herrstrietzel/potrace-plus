
export async function getExistingPath(url=''){
    if(!url) return false;

    // check relative paths
    let paths = url.split('/').filter(Boolean);
    let isRel = paths[0]==='.';

    if(isRel) url = url.slice(1);

    if(paths.length===1 || isRel){
        let scriptUrl = getCurrentScriptUrl();
        url = `${scriptUrl}/${url}`
    }


    let exists = false;
    try{
        let res = await fetch(url, { method: "HEAD" });
        exists = res.ok ? url : false;
    }catch{
        console.warn('file does not exist');
    }
    return exists;
}


export function getCurrentScriptUrl() {
    try {
        /** 2. try error API */
        let stackLines = new Error().stack.split('\n');
        let relevantLine = stackLines[1] || stackLines[2];
        if (!relevantLine) return null;

        // Extract URL using a more comprehensive regex
        let urlError = relevantLine.match(/(https?:\/\/[^\s]+)/)[1]
            .split('/')
            .slice(0, -1)
            .join('/');

        return urlError;

    } catch (e) {
        console.warn("Could not retrieve script path", e);
        return null;
    }
}



/**
 * load fonts from google helper
 */
export async function getGoogleFontUrl(url, options = {}) {
    let src;
    let subset = options.subset ? options.subset : "latin";
    let subsetText = options.subsetText ? options.subsetText : "";

    // get subset based on used characters
    if (subsetText) {
        src = getGoogleFontSubsetFromContent(url, subsetText);
        return src;
    }
    let fetched = await fetch(url);
    let res = await fetched.text();

    // get language subsets
    let subsetObj = {};
    let subsetRules = res.split("/*").filter(Boolean);

    for (let i = 0; i < subsetRules.length; i++) {
        let subsetRule = subsetRules[i];
        let rule = subsetRule.split("*/");
        let subset = rule[0].trim();
        let src = subsetRule.match(/[^]*?url\((.*?)\)/)[1];
        subsetObj[subset] = src;
    }
    src = subsetObj[subset];

    if (src === undefined) {
        //console.log(subsetRules);
        src = subsetRules[0].match(/[^]*?url\((.*?)\)/)[1];
    }

    return src;
}


/**
 * load google font subset
 * containing all glyphs used in document
 */
async function getGoogleFontSubsetFromContent(url, documentText = "") {
    // get all characters used in body
    documentText = documentText
        ? documentText
        : document.body.innerText
            .trim()
            .replace(/[\n\r\t]/g, "")
            .replace(/\s{2,}/g, " ")
            .replaceAll(" ", "");
    url = url + "&text=" + encodeURI(documentText);

    let fetched = await fetch(url);
    let res = await fetched.text();
    let src = res.match(/[^]*?url\((.*?)\)/)[1];

    return src;
}