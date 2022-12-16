///////////////////////////////////
// Requirements and dependencies
const cookieParser = require("cookie-parser")
const express = require("express")
const csrf = require("csurf")
const cors = require("cors")
const { decodeToken } = require("./middleware")
const admin = require("./config/firebase-config")
const AppError = require("./utils/AppError")


///////////////////////////////////
// Initializing the app
const PORT = process.env.PORT || 8080
const app = express()
const csrfMiddleware = csrf({ cookie: true })
const db = admin.firestore()

///////////////////////////////////
// Middleware
app.use(cors({
    origin: ['http://localhost:3000'],
    credentials: true, //access-control-allow-credentials:true
    optionSuccessStatus: 200,
}))
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser())
app.use(csrfMiddleware)


///////////////////////////////////
// Set a token on any request to protect against CSRF attacks
app.all('*', (req, res, next) => {
    res.cookie('XSRF-TOKEN', req.csrfToken())
    next()
})


app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    next();
})


app.get("/", (_, res) => {
    res.send("Backend home page")
})

app.get("/dummy", async (req, res, next) => {

    return res.json({
        tasks: [
            { title: 'Task1', },
            { title: 'Task2', },
        ]
    });
})

app.get("/trips", decodeToken, async (req, res, next) => {
    try {
        const userRef = db.collection("Users").doc(req.user)
        console.log(userRef)
        const snap = await db.collection('Trips').where("user", "==", userRef).get()
        // const snap = await db.collection('Trips').get()
        console.log(snap.size)
        const data = []
        if (!snap.empty) {
            snap.forEach(doc => {
                data.push(doc.data())
            });
            return res.json(data)
        }
        else {
            res.json({ trips: "you currently have no trips" })
        }
    } catch {
        next(new AppError("Bad request", 400))
    }
})

app.get("/trips/:id", decodeToken, async (req, res, next) => {
    const { id } = req.params

    try {
        const snap = await db.collection('Trips').doc(id).get()
        if (snap.exists) {
            const data = snap.data();
            if (data["user"]["_path"]["segments"][1] != req.user) {
                next(new AppError("this trip does not belong to you", 403))
            }
            return res.json(data)
        } else {
            next(AppError("Trip does not exist"), 403)
        }
    } catch (e) {
        next(new AppError("Bad request", 400))
    }
})


///////////////////////////////////
// Error routes

app.all('*', (req, res, next) => {
    next(new AppError('API endpoint is non-existent', 404))
})

app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!'
    res.status(statusCode).json({ 'error': err })
})

app.listen(8080, () => {
    console.log(`Listening on ${PORT}`)
})


