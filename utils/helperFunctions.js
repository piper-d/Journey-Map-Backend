let distanceBetween2Points = (lat1, lon1, lat2, lon2) => {
    if ((lat1 == lat2) && (lon1 == lon2)) {
        return 0;
    }
    else {
        var radlat1 = Math.PI * lat1 / 180;
        var radlat2 = Math.PI * lat2 / 180;
        var theta = lon1 - lon2;
        var radtheta = Math.PI * theta / 180;
        var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) {
            dist = 1;
        }
        dist = Math.acos(dist);
        dist = dist * 180 / Math.PI;
        dist = dist * 60 * 1.1515;
        return dist;
    }
}


module.exports.calculateDistance = (points) => {
    total = 0
    for (let i = 1; i < points.length; i++) {
        let first = points[i - 1]
        let second = points[i]
        let distance = distanceBetween2Points(second[0], second[1], first[0], first[1])
        total += distance
    }
    return total
}

module.exports.findHourDifference = (date1, date2) => {
    return (date1.getTime() - date2.getTime()) / 3600000
}

module.exports.findAverageSpeed = (hours, distance) => {
    return distance / hours
}
