// /////////////////////////////////
// Requirements and dependencies
const tripRouter = require("express").Router();
const { decodeToken } = require("../middleware");
const { findHourDifference, calculateDistance, findAverageSpeed } = require("../utils/helperFunctions");
const { firestore } = require("firebase-admin");
const { Storage } = require("@google-cloud/storage")
const AppError = require("../utils/AppError");
const admin = require("../config/firebase-config");
const multer = require("multer")


// /////////////////////////////////
// Initialization
const db = admin.firestore();
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

// const FirebaseStorage = new Storage({
//   projectId: 'journeymap-a8e65',
//   keyFilename: '../functions/config/serviceAccountKey.json'
// });

const FirebaseStorage = admin.storage()

tripRouter.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

tripRouter.get("/trips", decodeToken, async (req, res, next) => {
  try {
    const userRef = db.collection("Users").doc(req.user);
    const snap = await db.collection("Trips").where("user", "==", userRef).get();
    // const snap = await db.collection('Trips').get()
    const data = [];
    if (!snap.empty) {
      snap.forEach((doc) => {
        data.push(doc.data());
      });
      return res.status(200).json(data);
    } else {
      res.status(200).json({ trips: "you currently have no trips" });
    }
  } catch (e) {
    console.log(e);
    next(new AppError("Bad request", 400));
  }
});

tripRouter.get("/trips/:id", decodeToken, async (req, res, next) => {
  const { id } = req.params;

  try {
    const snap = await db.collection("Trips").doc(id).get();
    if (snap.exists) {
      const data = snap.data();
      if (data["user"]["_path"]["segments"][1] != req.user) {
        return next(new AppError("this trip does not belong to you", 403));
      }
      return res.status(200).json(data);
    } else {
      next(new AppError("Trip does not exist"), 404);
    }
  } catch (e) {
    next(new AppError("Bad request", 400));
  }
});


tripRouter.post("/trips", decodeToken, async (req, res, next) => {
  const { media = {}, point_coords = [], details = {}, title = "" } = req.body;
  const user = await db.collection("Users").doc(req.user);

  details["end_time"] = new Date(details["end_time"]);
  details["start_time"] = new Date(details["start_time"]);
  const distance_traveled = calculateDistance(point_coords);
  const timeElapsed = findHourDifference(details["end_time"], details["start_time"]);
  details["average_speed_mph"] = findAverageSpeed(timeElapsed, distance_traveled).toString();
  details["distance_traveled_miles"] = distance_traveled.toString();

  const coords = [];
  for (const point of point_coords) {
    coords.push(new admin.firestore.GeoPoint(point[0], point[1]));
  }

  const data = { user, media, details, point_coords: coords, title };

  try {
    const result = await db.collection("Trips").add(data);
    const trip_ref = await db.collection("Trips").doc(result.id);
    await user.update({ Trips: firestore.FieldValue.arrayUnion(trip_ref) });
    return res.status(200).json({ error: "", tripId: result.id });
  } catch (e) {
    next(new AppError("Bad request. Could not create a trip", 400));
  }
});

tripRouter.delete("/trips/:id", decodeToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    const user = await db.collection("Users").doc(req.user);
    const trip_ref = await db.collection("Trips").doc(id);
    const snap = await trip_ref.get();
    if (snap.exists) {
      const data = snap.data();
      if (data["user"]["_path"]["segments"][1] != req.user) {
        return next(new AppError("this trip does not belong to you", 403));
      } else {
        // DELETE ACTION
        await user.update({ Trips: firestore.FieldValue.arrayRemove(trip_ref) });
        await trip_ref.delete();
        return res.status(200).json({ error: "" });
      }
    } else {
      return next(new AppError("Trip does not exist"), 404);
    }
  } catch (e) {
    return next(new AppError("Bad request", 400));
  }
});


tripRouter.put("/trips/:id", decodeToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    const trip_ref = await db.collection("Trips").doc(id);
    const snap = await trip_ref.get();
    if (snap.exists) {
      const data = snap.data();
      if (data["user"]["_path"]["segments"][1] != req.user) {
        return next(new AppError("this trip does not belong to you", 403));
      } else {
        // UPDATE ACTION
        const { media = {}, title = "" } = req.body;
        await trip_ref.update({ media: media, title: title });
        return res.status(200).json({ error: "" });
      }
    } else {
      return next(new AppError("Trip does not exist"), 404);
    }
  } catch (e) {
    return next(new AppError("Bad request", 400));
  }
});

tripRouter.post("/trips/:id/media", decodeToken, upload.single('image'), async (req, res, next) => {
  const { id } = req.params
  try {
    const trip_ref = await db.collection("Trips").doc(id);
    const snap = await trip_ref.get();
    if (snap.exists) {
      const data = snap.data();
      if (data["user"]["_path"]["segments"][1] != req.user) {
        return next(new AppError("this trip does not belong to you", 403));
      } else {
        // UPLOAD ACTION

        if (!req.file) {
          return next(new AppError("No image file provided"), 400);
        }

        let originalName = req.file.originalname
        let buffer = req.file.buffer

        const bucketName = "journeymap-a8e65.appspot.com";
        const file = FirebaseStorage.bucket(bucketName).file(originalName);
        file.createWriteStream()
          .on('error', function (err) {
            console.log(err);
          })
          .on('finish', function () {
            console.log(`File ${originalName} uploaded to ${bucketName}.`);
          })
          .end(buffer);

        return res.status(200).json({ error: "" })

      }
    } else {
      return next(new AppError("Trip does not exist"), 404);
    }
  } catch (e) {
    console.log(e)
    return next(new AppError("Bad request", 400));
  }
})

module.exports = tripRouter;
