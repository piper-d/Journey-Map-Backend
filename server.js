///////////////////////////////////
// Requirements and dependencies
const cookieParser = require("cookie-parser")
const express = require("express")
const csrf = require("csurf")
const cors = require("cors")
const middleware = require("./middleware")

///////////////////////////////////
// Initializing the app
const PORT = process.env.PORT || 8080
const app = express()
const csrfMiddleware = csrf({ cookie: true })

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


app.get("/", (req, res) => {
    res.send("Backend home page")
})

app.get("/dummy", async (req, res) => {
    return res.json({
        tasks: [
            { title: 'Task1', },
            { title: 'Task2', },
        ],
    });
})

app.get("/login", (req, res) => {
    console.log("This is login route")
})

app.get("/signup", (req, res) => {
    console.log("This is signup route")
})

app.get("/logout", (req, res) => {
    console.log("This is log out page")
})

app.get("/profile", (req, res) => {
    console.log("This is profile route")
})

app.listen(8080, () => {
    console.log(`Listening on ${PORT}`)
})


