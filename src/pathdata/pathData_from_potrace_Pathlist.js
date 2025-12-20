//import { pathDataToD } from "../potrace_svg";

export function getPotracePathData(pathList = [], scale = 1) {

    // sort pathList to top-left to bottom right
    pathList.sort((a, b) => a.minX - b.minX || a.minY - b.minY)

    let len = pathList.length;
    let pathDataArr = []

    for (let l = 0; l < len; l++) {

        let pathData = []

        // sub paths starting with ;M
        let path = pathList[l];
        let {curve, minX, maxX, minY, maxY, sign}  = path;

        let bb = {
            x: minX,
            y: minY,
            width: maxX-minX,
            height: maxY-minY,
        }

        //let curve = path.curve;
        let n = curve.n, coms;

        pathData.push(
            {
                type: 'M', values: [
                    curve.c[(n - 1) * 3 + 2].x * scale,
                    curve.c[(n - 1) * 3 + 2].y * scale
                ],
                // save bbbox to each M
                bb,
                cw: sign==='+' ? true : false
            },
        );

        for (let i = 0; i < n; i++) {
            let type = curve.tag[i];
            if (type === "curve") {
                coms = [{
                    type: 'C', values: [
                        curve.c[i * 3].x * scale,
                        curve.c[i * 3].y * scale,
                        curve.c[i * 3 + 1].x * scale,
                        curve.c[i * 3 + 1].y * scale,
                        curve.c[i * 3 + 2].x * scale,
                        curve.c[i * 3 + 2].y * scale
                    ]
                }]

            } else if (type === "corner") {
                coms = [

                    {
                        type: 'L', values: [
                            curve.c[i * 3 + 1].x * scale,
                            curve.c[i * 3 + 1].y * scale,
                        ]
                    },
                    {
                        type: 'L', values: [
                            curve.c[i * 3 + 2].x * scale,
                            curve.c[i * 3 + 2].y * scale,
                        ]
                    }
                ]
            }
            pathData.push(...coms)
        }

        pathData.push({ type: 'Z', values: [] })
        pathDataArr.push(pathData)

    }

    return pathDataArr

}
