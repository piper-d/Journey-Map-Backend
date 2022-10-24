///////////////////////////////////
// Requirements and dependencies
const cookieParser = require("cookie-parser")
const express = require("express")
const csrf = require("csurf")
const cors = require("cors")
const middleware = require("./middleware")
const admin = require("./config/firebase-config")

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
app.use(middleware.decodeToken)


///////////////////////////////////
// Set a token on any request to protect against CSRF attacks
app.all('*', (req, res, next) => {
    res.cookie('XSRF-TOKEN', req.csrfToken())
    next()
})


app.get("/", (_, res) => {
    res.send("Backend home page")
})

app.get("/dummy", async (_, res) => {
    return res.json({
        tasks: [
            { title: 'Task1', },
            { title: 'Task2', },
        ],
    });
})

app.get("/trips", async (req, res) => {
    console.log("in trips")

})

app.get("/trips/:id", (req, res) => {
    const { id } = req.params

    db.collection('Trips').doc(id).get().then((snap) => {
        if (snap.exists) {
            const data = snap.data();
            return res.json(data)
        } else {
            console.log("Document does not exist");
        }
    })
})

app.get("/profile", (req, res) => {
    console.log("This is profile route")
})

app.listen(8080, () => {
    console.log(`Listening on ${PORT}`)
})


