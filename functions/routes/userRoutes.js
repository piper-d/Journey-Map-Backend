// /////////////////////////////////
// Requirements and dependencies

const userRouter = require("express").Router();
const {decodeToken} = require("../middleware");
const AppError = require("../utils/AppError");
const admin = require("../config/firebase-config");


// /////////////////////////////////
// Initialization
const db = admin.firestore();

userRouter.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

userRouter.get("/user", decodeToken, async (req, res, next) => {
  try {
    const snap = await db.collection("Users").doc(req.user).get();
    const data = snap.data();
    const returnBody = {
      username: data.username,
      email: data.email,
    };
    return res.status(200).json(returnBody);
  } catch (e) {
    return next(new AppError(`Bad request, ${e}`, 400));
  }
});

userRouter.put("/user", decodeToken, async (req, res, next) => {
  try {
    const user = await db.collection("Users").doc(req.user);
    const snap = await db.collection("Users").doc(req.user).get();
    const data = snap.data();
    const {username = data.username} = req.body;
    await user.update({username: username});
    const updatedData = await (await db.collection("Users").doc(req.user).get()).data();
    return res.status(200).json(updatedData);
  } catch (e) {
    return next(new AppError(`Bad request, ${e}`, 400));
  }
});

userRouter.delete("/user", decodeToken, async (req, res, next) => {
  try {
    // Delete from trips collection everything that belongs to this user
    const userRef = await db.collection("Users").doc(req.user);
    const snap = await db.collection("Trips").where("user", "==", userRef).get();

    if (!snap.empty) {
      for (const doc of snap.docs) {
        const tripRef = await db.collection("Trips").doc(doc.id);

        // remove the media associated with the trip associated with the user from the object store
        const snap_media = await trip_ref.get();
        if (snap_media.exists) {
          const data = snap_media.data();
          if (data["media"]) {
            iterableData = data["media"];
            for (const [coords, urls] of Object.entries(iterableData)) {
              for (const url of urls) {
                const fileName = url.split("appspot.com/")[1];
                const bucketName = "journeymap-a8e65.appspot.com";
                const file = FirebaseStorage.bucket(bucketName).file(fileName);
                file.delete()
                    .then(() => {
                      console.log("Successfully deleted image from Object Store");
                    }).catch((err) => {
                      return next(new AppError(`could not delete image from object storage, ${err}`, 400));
                    });
              }
            }
          }
        }
        // delete the trip from the trips collection
        await tripRef.delete();
      }
    }

    // remove user from the users collection
    await userRef.delete();

    // remove the user from authentication of firebase
    await admin.auth().deleteUser(req.user);

    return res.status(200).json({"error": ""});
  } catch (e) {
    return next(new AppError(`Bad request, ${e}`, 400));
  }
});

module.exports = userRouter;
