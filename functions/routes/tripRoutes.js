// /////////////////////////////////
// Requirements and dependencies
const tripRouter = require("express").Router();
const {decodeToken} = require("../middleware");
const {makeRandomName, convertToJPEGBuffer, waitForFieldChange, prepareGoogleMaps, parseDateTime, extractMultipartFormData, parseSeconds} = require("../utils/helperFunctions");
const {firestore} = require("firebase-admin");
const AppError = require("../utils/AppError");
const admin = require("../config/firebase-config");
const multer = require("multer");
const Shotstack = require("shotstack-sdk");
const sgMail = require("@sendgrid/mail");
require("dotenv").config();

// /////////////////////////////////
// Initialization
const db = admin.firestore();
const storage = multer.memoryStorage();
const upload = multer({storage: storage});
const FirebaseStorage = admin.storage();

tripRouter.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

tripRouter.put("/trips/:id/media/delete", decodeToken, async (req, res, next) => {
  try {
    const {id} = req.params;
    const {latitude, longitude, url} = req.body;
    const fileName = url.split("appspot.com/")[1];
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
          media: {
            [`(${latitude},${longitude})`]: data["media"][`(${latitude},${longitude})`].filter((item) => item != url),
            ...Object.entries(data.media)
                .filter(([key, value]) => key != `(${latitude},${longitude})` && value.length > 0)
                .reduce((acc, [key, value]) => ({...acc, [key]: firestore.FieldValue.arrayUnion(...value)}), {}),
          },
        }, {merge: true})
            .then(() => {
              console.log("delete from firestore");
            })
            .catch((error) => {
              return next(new AppError(error, 400));
            });

        // DELETE FROM OBJECT STORE
        const bucketName = "journeymap-a8e65.appspot.com";
        const file = FirebaseStorage.bucket(bucketName).file(fileName);
        file.delete()
            .then(() => {
            }).catch((err) => {
              return next(new AppError("could not delete image from object storage", 400));
            });

        return res.status(200).json({error: ""});
      }
    } else {
      return next(new AppError("Trip does not exist", 404));
    }
  } catch (e) {
    console.log(e);
    return next(new AppError(e, 400));
  }
});

tripRouter.get("/trips", decodeToken, async (req, res, next) => {
  try {
    const userRef = db.collection("Users").doc(req.user);
    const snap = await db.collection("Trips").where("user", "==", userRef).get();
    const data = [];
    if (!snap.empty) {
      snap.forEach((doc) => {
        const pushData = doc.data();
        pushData.id = doc.id;
        data.push(pushData);
      });
      return res.status(200).json(data);
    } else {
      res.status(200).json({trips: "you currently have no trips"});
    }
  } catch (e) {
    return next(new AppError(e, 400));
  }
});

tripRouter.get("/trips/:id", decodeToken, async (req, res, next) => {
  const {id} = req.params;

  try {
    const snap = await db.collection("Trips").doc(id).get();
    if (snap.exists) {
      const data = snap.data();
      if (data["user"]["_path"]["segments"][1] != req.user) {
        return next(new AppError("this trip does not belong to you", 403));
      }
      return res.status(200).json({data, error: ""});
    } else {
      return next(new AppError("Trip does not exist", 404));
    }
  } catch (e) {
    return next(new AppError(e, 400));
  }
});


tripRouter.post("/trips", decodeToken, async (req, res, next) => {
  const {point_coords = [], details = {}, title = ""} = req.body;
  const user = await db.collection("Users").doc(req.user);

  const coords = [];
  for (const point of point_coords) {
    coords.push(new admin.firestore.GeoPoint(point[0], point[1]));
  }

  const data = {user, details, point_coords: coords, title};

  try {
    const result = await db.collection("Trips").add(data);
    const trip_ref = await db.collection("Trips").doc(result.id);
    await user.update({Trips: firestore.FieldValue.arrayUnion(trip_ref)});
    return res.status(200).json({error: "", tripId: result.id});
  } catch (e) {
    return next(new AppError(`Bad request. Could not create a trip, ${e}`, 400));
  }
});

tripRouter.delete("/trips/:id", decodeToken, async (req, res, next) => {
  const {id} = req.params;
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
        await user.update({Trips: firestore.FieldValue.arrayRemove(trip_ref)});

        // delete the media files from object storage associated with that trip before deleting the trip
        if (data["media"]) {
          iterableData = data["media"];
          for (const [coords, urls] of Object.entries(iterableData)) {
            for (const url of urls) {
              const fileName = url.split("appspot.com/")[1];
              const bucketName = "journeymap-a8e65.appspot.com";
              const file = FirebaseStorage.bucket(bucketName).file(fileName);
              file.delete()
                  .then(() => {
                  }).catch((err) => {
                    return next(new AppError("could not delete image from object storage", 400));
                  });
            }
          }
        }
        // delete the trip itself
        await trip_ref.delete();
        return res.status(200).json({error: ""});
      }
    } else {
      return next(new AppError("Trip does not exist", 404));
    }
  } catch (e) {
    return next(new AppError(e, 400));
  }
});


tripRouter.put("/trips/:id", decodeToken, async (req, res, next) => {
  const {id} = req.params;
  try {
    const trip_ref = await db.collection("Trips").doc(id);
    const snap = await trip_ref.get();
    if (snap.exists) {
      const data = snap.data();
      if (data["user"]["_path"]["segments"][1] != req.user) {
        return next(new AppError("this trip does not belong to you", 403));
      } else {
        // UPDATE ACTION
        const {title = data["title"]} = req.body;
        await trip_ref.update({title: title});
        return res.status(200).json({error: ""});
      }
    } else {
      return next(new AppError("Trip does not exist", 404));
    }
  } catch (e) {
    return next(new AppError(e, 400));
  }
});

tripRouter.post("/trips/:id/media", decodeToken, async (req, res, next) => {
  const {id} = req.params;
  try {
    const trip_ref = await db.collection("Trips").doc(id);
    const snap = await trip_ref.get();
    if (snap.exists) {
      const data = snap.data();
      if (data["user"]["_path"]["segments"][1] != req.user) {
        return next(new AppError("this trip does not belong to you", 403));
      } else {
        // check if file is provided
        const extractedBody = await extractMultipartFormData(req);
        let buffer = extractedBody["uploads"]["image"];
        const {latitude, longitude, extension} = extractedBody["fields"];

        if (!buffer) {
          return next(new AppError("No image file provided", 400));
        }

        if (!latitude || !longitude) {
          return next(new AppError("No coordinates provided", 400));
        }

        if (!extension) {
          return next(new AppError("No extension provided", 400));
        }

        // extract original name and original extension
        let fileName = "";

        // convert HEIC to PNG for optimum storage in object store
        if (extension == "HEIC" || extension == "heic" || extension == "heif" || extension == "HEIF") {
          buffer = await convertToJPEGBuffer(buffer);
          fileName = makeRandomName(10) + ".jpeg";
        } else {
          fileName = makeRandomName(10) + "." + extension;
        }

        // upload file to firebase storage
        const bucketName = "journeymap-a8e65.appspot.com";
        const file = FirebaseStorage.bucket(bucketName).file(fileName);
        const write = file.createWriteStream();

        write
            .on("error", function(err) {
              return next(new AppError(err, 400));
            })
            .end(buffer, () => {
              console.log("end");
            })
            .on("finish", async function() {
              console.log("finished");
              // fetch the url of the newly generated 1200x2000 image
              const compressedFileName = fileName.split(".")[0] + "_1200x2000.jpeg";

              const publicURL = await FirebaseStorage.bucket(bucketName).file(compressedFileName).publicUrl();

              // store it in firestore inside of corresponding trip at certain location
              trip_ref.set({
                media: {
                  [`(${latitude},${longitude})`]: firestore.FieldValue.arrayUnion(publicURL),
                },
              }, {merge: true})
                  .then(() => {
                    setTimeout(() => {
                      return res.status(200).json({error: "", imageURL: publicURL});
                    }, 1000);
                  })
                  .catch((error) => {
                    return next(new AppError(error, 400));
                  });
            });
      }
    } else {
      return next(new AppError("Trip does not exist", 404));
    }
  } catch (e) {
    console.log(e);
    return next(new AppError(e, 400));
  }
});


tripRouter.get("/trips/:id/export", decodeToken, async (req, res, next) => {
  const {id} = req.params;
  try {
    const snap = await db.collection("Trips").doc(id).get();
    if (snap.exists) {
      const data = snap.data();
      if (data["user"]["_path"]["segments"][1] != req.user) {
        return next(new AppError("this trip does not belong to you", 403));
      } else {
        // EXPORT ACTION

        // find user info
        const snap_user = await db.collection("Users").doc(req.user).get();
        const data_user = snap_user.data();
        const username = data_user.username;
        const email = data_user.email;

        // get all coordinates of the trip
        const points_array = [];
        data["point_coords"].forEach((doc) => {
          const {latitude, longitude} = doc;
          points_array.push([latitude, longitude]);
        });

        // get the map url
        const mapURL = prepareGoogleMaps(points_array);

        // get all media files of the trip
        const media_urls = [];
        media_urls.push(mapURL);
        if (data["media"]) {
          iterableData = data["media"];
          for (const [coords, urls] of Object.entries(iterableData)) {
            for (const url of urls) {
              media_urls.push(url);
            }
          }
          // initialize the shostack client
          const defaultClient = Shotstack.ApiClient.instance;
          defaultClient.basePath = "https://api.shotstack.io/stage";
          const DeveloperKey = defaultClient.authentications["DeveloperKey"];
          DeveloperKey.apiKey = process.env.SHOTSTACK_API_KEY;

          // create the template
          let start = 0;
          const length = 3;

          const titleAsset = new Shotstack.TitleAsset;
          titleAsset
              .setText(data["title"])
              .setStyle("blockbuster")
              .setColor("#FFFFFF")
              .setSize("medium")
              .setPosition("top");

          const offset = new Shotstack.Offset;
          offset
              .setX(-1)
              .setY(0);

          const metadataAsset = new Shotstack.TitleAsset;
          metadataAsset
              .setText(
                  `Average Pace: ${data["details"]["average_speed"] || data["details"]["average_pace"]}\n Distance: ${data["details"]["distance"] || "NaN"} miles\n Duration: ${parseSeconds(data["details"]["duration"])}
              \t\t\t     Start Time: ${parseDateTime(data["details"]["start_time"])}
              \t\t\t   End Time: ${parseDateTime(data["details"]["end_time"])}
              `)
              .setStyle("chunk")
              .setColor("#FFFFFF")
              .setSize("x-small")
              .setPosition("bottomLeft")
              .setOffset(offset);

          const imageClips = [];
          const titleClip = new Shotstack.Clip;
          const metadataClip = new Shotstack.Clip;

          titleClip
              .setAsset(titleAsset)
              .setStart(0.1)
              .setLength(2.9);

          metadataClip
              .setAsset(metadataAsset)
              .setStart(0.1)
              .setLength(2.9);

          imageClips.push(titleClip);
          imageClips.push(metadataClip);

          for (const url of media_urls) {
            const imageAsset = new Shotstack.ImageAsset;
            imageAsset.setSrc(url);
            const imageClip = new Shotstack.Clip;
            imageClip
                .setAsset(imageAsset)
                .setStart(start)
                .setLength(length)
                .setScale(1);

            imageClips.push(imageClip);
            start += length;
          }

          const track = new Shotstack.Track;
          track.setClips(imageClips);

          const timeline = new Shotstack.Timeline;
          timeline.setTracks([track]);

          const output = new Shotstack.Output;
          output
              .setFormat("mp4")
              .setResolution("sd")
              .setFps(30);

          const edit = new Shotstack.Edit;
          edit
              .setTimeline(timeline)
              .setOutput(output);

          // render the template
          const api = new Shotstack.EditApi();
          const render = await api.postRender(edit);

          // poll shotstack for render status
          async function getRenderStatus() {
            const response = await api.getRender(render.response.id);
            return response.response;
          }
          const result = await waitForFieldChange(getRenderStatus, "status", "done");
          // return res.status(200).json({error: "", downloadLink: result.url});

          // prepare email
          sgMail.setApiKey(process.env.SENDGRID_API_KEY);
          const msg = {
            to: email,
            from: "journeymapteam@gmail.com",
            subject: `${data["title"]} download link`,
            html: `Hello, ${username}, \n\n Here is your trip download link:  \n ${result.url}`,
          };

          // send email
          (async () => {
            try {
              await sgMail.send(msg);
              return res.status(200).json({error: "", downloadLink: result.url});
            } catch (error) {
              return res.status(400).json({error: "Could not send an email"});
            }
          })();
        } else {
          return next(new AppError("No media files found", 400));
        }
      }
    } else {
      return next(new AppError("Trip does not exist", 404));
    }
  } catch (e) {
    return next(new AppError(e, 400));
  }
});

module.exports = tripRouter;
