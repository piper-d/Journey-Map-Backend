// /////////////////////////////////
// Requirements and dependencies
const tripRouter = require("express").Router();
const { decodeToken } = require("../middleware");
const { makeRandomName, convertToPNGBuffer, waitForFieldChange, prepareGoogleMaps } = require("../utils/helperFunctions");
const { firestore } = require("firebase-admin");
const AppError = require("../utils/AppError");
const admin = require("../config/firebase-config");
const multer = require("multer");
const Shotstack = require('shotstack-sdk');
require('dotenv').config();

// /////////////////////////////////
// Initialization
const db = admin.firestore();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const FirebaseStorage = admin.storage();

tripRouter.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

tripRouter.get("/trips", decodeToken, async (req, res, next) => {
  try {
    const userRef = db.collection("Users").doc(req.user);
    const snap = await db.collection("Trips").where("user", "==", userRef).get();
    const data = [];
    if (!snap.empty) {
      snap.forEach((doc) => {
        let pushData = doc.data()
        pushData.id = doc.id
        data.push(pushData);
      });
      return res.status(200).json(data);
    } else {
      res.status(200).json({ trips: "you currently have no trips" });
    }
  } catch (e) {
    return next(new AppError(e, 400));
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
      return res.status(200).json({ data, error: "" });
    } else {
      return next(new AppError("Trip does not exist", 404));
    }
  } catch (e) {
    return next(new AppError(e, 400));
  }
});


tripRouter.post("/trips", decodeToken, async (req, res, next) => {
  const { point_coords = [], details = {}, title = "" } = req.body;
  const user = await db.collection("Users").doc(req.user);

  const coords = [];
  for (const point of point_coords) {
    coords.push(new admin.firestore.GeoPoint(point[0], point[1]));
  }

  const data = { user, details, point_coords: coords, title };

  try {
    const result = await db.collection("Trips").add(data);
    const trip_ref = await db.collection("Trips").doc(result.id);
    await user.update({ Trips: firestore.FieldValue.arrayUnion(trip_ref) });
    return res.status(200).json({ error: "", tripId: result.id });
  } catch (e) {
    console.log(e)
    return next(new AppError("Bad request. Could not create a trip", 400));
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

        // remove from user's trips
        await user.update({ Trips: firestore.FieldValue.arrayRemove(trip_ref) });

        //delete the media files from object storage associated with that trip before deleting the trip
        if (data["media"]) {
          iterableData = data["media"]
          for (let [coords, urls] of Object.entries(iterableData)) {
            for (let url of urls) {
              const fileName = url.split("appspot.com/")[1];
              const bucketName = "journeymap-a8e65.appspot.com";
              const file = FirebaseStorage.bucket(bucketName).file(fileName);
              file.delete()
                .then(() => {
                  console.log("Successfully deleted image from Object Store");
                }).catch((err) => {
                  return next(new AppError("could not delete image from object storage", 400));
                });
            }
          }
        }
        //delete the trip itself
        await trip_ref.delete();
        return res.status(200).json({ error: "" });
      }
    } else {
      return next(new AppError("Trip does not exist", 404));
    }
  } catch (e) {
    return next(new AppError(e, 400));
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
        const { title = data["title"] } = req.body;
        await trip_ref.update({ title: title });
        return res.status(200).json({ error: "" });
      }
    } else {
      return next(new AppError("Trip does not exist", 404));
    }
  } catch (e) {
    return next(new AppError(e, 400));
  }
});

tripRouter.post("/trips/:id/media", decodeToken, upload.single("image"), async (req, res, next) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body;
  try {
    const trip_ref = await db.collection("Trips").doc(id);
    const snap = await trip_ref.get();
    if (snap.exists) {
      const data = snap.data();
      if (data["user"]["_path"]["segments"][1] != req.user) {
        return next(new AppError("this trip does not belong to you", 403));
      } else {
        // check if file is provided
        if (!req.file) {
          return next(new AppError("No image file provided", 400));
        }

        if (!latitude || !longitude) {
          return next(new AppError("No coordinates provided", 400));
        }

        // extract original name and original extension
        const originalname = req.file.originalname.split(".")[0];
        const extension = req.file.originalname.split(".")[1];
        let buffer;
        let fileName = "";

        // convert HEIC to PNG for optimum storage in object store
        if (extension == "HEIC" || extension == "heic" || extension == "heif" || extension == "HEIF") {
          buffer = await convertToPNGBuffer(req.file.buffer);
          fileName = originalname + makeRandomName(10) + ".png";
        } else {
          fileName = originalname + makeRandomName(10) + "." + extension;
          buffer = req.file.buffer;
        }

        // upload file to firebase storage
        const bucketName = "journeymap-a8e65.appspot.com";
        const file = FirebaseStorage.bucket(bucketName).file(fileName);
        file.createWriteStream()
          .on("error", function (err) {
            return next(new AppError(err, 400));
          })
          .on("finish", function () {
            console.log(`File ${fileName} uploaded to ${bucketName}.`);
          })
          .end(buffer);

        // fetch the url of the newly generated 400x400 image
        const compressedFileName = fileName.split(".")[0] + "_400x400." + "jpeg";
        const publicURL = await FirebaseStorage.bucket(bucketName).file(compressedFileName).publicUrl();

        // store it in firestore inside of corresponding trip at certain location
        trip_ref.update({
          [`media.(${latitude},${longitude})`]: firestore.FieldValue.arrayUnion(publicURL),
        })
          .then(() => {
            console.log("Document successfully updated!");
          })
          .catch((error) => {
            return next(new AppError(error, 400));
          });

        return res.status(200).json({ error: "" });
      }
    } else {
      return next(new AppError("Trip does not exist", 404));
    }
  } catch (e) {
    return next(new AppError(e, 400));
  }
});


tripRouter.delete("/trips/:id/media", decodeToken, upload.single("image"), async (req, res, next) => {
  const { id } = req.params;
  const { latitude, longitude, url } = req.body;
  const fileName = url.split("appspot.com/")[1];
  try {
    const trip_ref = await db.collection("Trips").doc(id);
    const snap = await trip_ref.get();
    if (snap.exists) {
      const data = snap.data();
      if (data["user"]["_path"]["segments"][1] != req.user) {
        return next(new AppError("this trip does not belong to you", 403));
      } else {
        if (!latitude || !longitude) {
          return next(new AppError("No coordinates provided", 400));
        }

        if (!url) {
          return next(new AppError("No url provided", 400));
        }

        // DELETE FROM FIRESTORE
        trip_ref.update({
          [`media.(${latitude},${longitude})`]: firestore.FieldValue.arrayRemove(url),
        })
          .then(() => {
            console.log("Document successfully deleted from FIRESTORE!");
          })
          .catch((error) => {
            return next(new AppError(error, 400));
          });

        // DELETE FROM OBJECT STORE
        const bucketName = "journeymap-a8e65.appspot.com";
        const file = FirebaseStorage.bucket(bucketName).file(fileName);
        file.delete()
          .then(() => {
            console.log("Successfully deleted image from Object Store");
          }).catch((err) => {
            return next(new AppError("could not delete image from object storage", 400));
          });

        return res.status(200).json({ error: "" });
      }
    } else {
      return next(new AppError("Trip does not exist", 404));
    }
  } catch (e) {
    return next(new AppError(e, 400));
  }
});



tripRouter.get('/trips/:id/export', decodeToken, async (req, res, next) => {
  const { id } = req.params;
  try {
    const snap = await db.collection("Trips").doc(id).get();
    if (snap.exists) {
      const data = snap.data();
      if (data["user"]["_path"]["segments"][1] != req.user) {
        return next(new AppError("this trip does not belong to you", 403));
      } else {
        //EXPORT ACTION

        // get all coordinates of the trip
        const points_array = []
        data['point_coords'].forEach((doc) => {
          const { latitude, longitude } = doc
          points_array.push([latitude, longitude])
        });

        // get the map url
        let mapURL = prepareGoogleMaps(points_array)

        //get all media files of the trip
        let media_urls = []
        media_urls.push(mapURL)
        if (data["media"]) {
          iterableData = data["media"]
          for (let [coords, urls] of Object.entries(iterableData)) {
            for (let url of urls) {
              media_urls.push(url)
            }
          }

          //initialize the shostack client
          const defaultClient = Shotstack.ApiClient.instance;
          defaultClient.basePath = 'https://api.shotstack.io/stage';
          const DeveloperKey = defaultClient.authentications['DeveloperKey'];
          DeveloperKey.apiKey = process.env.SHOTSTACK_API_KEY;


          // create the template
          let start = 0
          let length = 3
          let imageClips = []

          for (let url of media_urls) {
            let imageAsset = new Shotstack.ImageAsset;
            imageAsset.setSrc(url)
            let imageClip = new Shotstack.Clip;
            imageClip
              .setAsset(imageAsset)
              .setStart(start)
              .setLength(length)
              .setScale(0.5)

            imageClips.push(imageClip)
            start += length
          }

          let track = new Shotstack.Track;
          track.setClips(imageClips);

          let timeline = new Shotstack.Timeline;
          timeline.setTracks([track]);

          let output = new Shotstack.Output;
          output
            .setFormat('mp4')
            .setResolution('sd');

          let edit = new Shotstack.Edit;
          edit
            .setTimeline(timeline)
            .setOutput(output);

          // render the template
          const api = new Shotstack.EditApi();
          const render = await api.postRender(edit)

          async function getRenderStatus() {
            const response = await api.getRender(render.response.id);
            return response.response;
          }

          const result = await waitForFieldChange(getRenderStatus, 'status', 'done');
          return res.status(200).json({ error: "", downloadLink: result.url });

        } else {
          return next(new AppError("No media files found", 400));
        }
      }
    } else {
      next(new AppError("Trip does not exist", 404));
    }
  } catch (e) {
    console.log(e)
    return next(new AppError(e, 400));
  }
})
module.exports = tripRouter;
