
export function pathlistToPolygon(pathList = [], scale = 1) {

    let len = pathList.length;
    let polygons = []

    for (let l = 0; l < len; l++) {

        // sub paths starting with ;M
        //let curve = pathList[l].curve;
        let polygon = potracePathToPoly(pathList[l])
        polygons.push(polygon)
    }
    return polygons
}



export function potracePathToPoly(path, scale = 1) {

    // sub paths starting with ;M
    let curve = path.curve;
    let n = curve.n;
    let polygon = []

    // M
    polygon.push({ x: curve.c[(n - 1) * 3 + 2].x * scale, y: curve.c[(n - 1) * 3 + 2].y * scale })

    for (let i = 0; i < n; i++) {
        let type = curve.tag[i];
        if (type === "curve") {
            // C
            polygon.push({
                x: curve.c[i * 3 + 2].x * scale,
                y: curve.c[i * 3 + 2].y * scale
            })

        } else if (type === "corner") {

            polygon.push(
                {
                    x: curve.c[i * 3 + 1].x * scale,
                    y: curve.c[i * 3 + 1].y * scale
                },
                {
                    x: curve.c[i * 3 + 2].x * scale,
                    y: curve.c[i * 3 + 2].y * scale
                }
            )
        }
    }

    return polygon
}
