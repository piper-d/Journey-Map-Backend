const userRouter = require('express').Router();
const { decodeToken } = require("../middleware")
const AppError = require("../utils/AppError")
const admin = require("../config/firebase-config")
const db = admin.firestore()

userRouter.use((req, res, next) => {
    res.locals.currentUser = req.user;
    next();
})

userRouter.get("/user", decodeToken, async (req, res, next) => {
    try {
        const snap = await db.collection("Users").doc(req.user).get()
        const data = snap.data();
        return res.status(200).json(data)
    } catch (e) {
        return next(new AppError("Bad request", 400))
    }
})

userRouter.put("/user", decodeToken, async (req, res, next) => {
    try {
        const user = await db.collection("Users").doc(req.user)
        const snap = await db.collection("Users").doc(req.user).get()
        const data = snap.data()
        const { username = data.username } = req.body
        await user.update({ username: username })
        const updatedData = await (await db.collection("Users").doc(req.user).get()).data()
        return res.status(200).json(updatedData)
    } catch (e) {
        console.log(e.toString())
        return next(new AppError("Bad request", 400))
    }
})

userRouter.delete("/user", decodeToken, async (req, res, next) => {
    try {

        // Delete from trips collection everything that belongs to this user
        const userRef = await db.collection("Users").doc(req.user)
        const snap = await db.collection('Trips').where("user", "==", userRef).get()

        if (!snap.empty) {
            for (let doc of snap.docs) {
                let tripRef = await db.collection("Trips").doc(doc.id)
                await tripRef.delete()
            }
        }

        // remove user from the users collection
        await userRef.delete()

        //remove the user from authentication of firebase
        await admin.auth().deleteUser(req.user)

        return res.status(200).json({ "error": "" })

    } catch (e) {
        console.log(e.toString())
        return next(new AppError("Bad request", 400))
    }
})

module.exports = userRouter