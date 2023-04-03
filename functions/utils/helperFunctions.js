const convert = require("heic-convert");
const polyline = require("@mapbox/polyline");
const Busboy = require("busboy");
const os = require("os");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const distanceBetween2Points = (lat1, lon1, lat2, lon2) => {
  if ((lat1 == lat2) && (lon1 == lon2)) {
    return 0;
  } else {
    const radlat1 = Math.PI * lat1 / 180;
    const radlat2 = Math.PI * lat2 / 180;
    const theta = lon1 - lon2;
    const radtheta = Math.PI * theta / 180;
    let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    if (dist > 1) {
      dist = 1;
    }
    dist = Math.acos(dist);
    dist = dist * 180 / Math.PI;
    dist = dist * 60 * 1.1515;
    return dist;
  }
};

//convert seconds into a string that would display hours minutes second
module.exports.parseSeconds = (seconds) => {
  d = Number(seconds);
  var h = Math.floor(d / 3600);
  var m = Math.floor(d % 3600 / 60);
  var s = Math.floor(d % 3600 % 60);

  var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
  var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
  var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
  return hDisplay + mDisplay + sDisplay;
}

module.exports.parseDateTime = (value) => {
  const date = new Date(value)
  return date.toLocaleString()
}


module.exports.calculateDistance = (points) => {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const first = points[i - 1];
    const second = points[i];
    const distance = distanceBetween2Points(second[0], second[1], first[0], first[1]);
    total += distance;
  }
  return total;
};

module.exports.findHourDifference = (date1, date2) => {
  return (date1.getTime() - date2.getTime()) / 3600000;
};

module.exports.findAverageSpeed = (hours, distance) => {
  return distance / hours;
};


module.exports.makeRandomName = (length) => {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};


module.exports.convertToJPEGBuffer = async (buffer) => {
  const outputBuffer = await convert({
    buffer: buffer, // the HEIC file buffer
    format: "JPEG", // output format
    quality: 1, // the compression quality, between 0 and 1
  });
  return outputBuffer;
};

module.exports.dms2dd = (degrees, minutes, seconds, direction) => {
  let dd = degrees + minutes / 60 + seconds / (60 * 60);

  if (direction == "S" || direction == "W") {
    dd = dd * -1;
  } // Don't do anything for N or E
  return dd;
};


module.exports.waitForFieldChange = async (asyncFunction, field, expectedValue) => {
  let result = await asyncFunction();
  while (result[field] !== expectedValue) {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
    result = await asyncFunction();
  }
  return result;
};

module.exports.prepareGoogleMaps = (geopoints) => {
  const polylineData = polyline.encode(geopoints);
  return `https://maps.googleapis.com/maps/api/staticmap?size=600x400&maptype=satellite&path=weight:5%7Ccolor:white%7Cenc:${polylineData}&path=weight:12%7Ccolor:blue%7Cenc:${polylineData}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
};

module.exports.extractMultipartFormData = (req) => {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const tmpdir = os.tmpdir();
    const fields = {};
    const fileWrites = [];
    const uploads = {};

    busboy.on("field", (fieldname, val) => (fields[fieldname] = val));

    busboy.on("file", (fieldname, file, filename) => {
      const filepath = path.join(tmpdir, filename.filename);
      const writeStream = fs.createWriteStream(filepath);

      uploads[fieldname] = filepath;

      file.pipe(writeStream);

      const promise = new Promise((resolve, reject) => {
        file.on("end", () => {
          writeStream.end();
        });
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      fileWrites.push(promise);
    });

    busboy.on("finish", async () => {
      const result = { fields, uploads: {} };

      await Promise.all(fileWrites);

      for (const file in uploads) {
        if (file) {
          const filename = uploads[file];

          result.uploads[file] = fs.readFileSync(filename);
          fs.unlinkSync(filename);
        }
      }

      resolve(result);
    });

    busboy.on("error", reject);

    if (req.rawBody) {
      busboy.end(req.rawBody);
    } else {
      req.pipe(busboy);
    }
  });
};
