///////////////////////////////////
// Requirements and dependencies
const cookieParser = require("cookie-parser")
const express = require("express")
const cors = require("cors")

const AppError = require("./utils/AppError")
const tripRoutes = require('./routes/tripRoutes');
const userRoutes = require('./routes/userRoutes');

///////////////////////////////////
// Initializing the app
const PORT = process.env.PORT || 8080
const app = express()


///////////////////////////////////
// Middleware
app.use(cors({
    origin: ['http://localhost:3000'],
    credentials: true, //access-control-allow-credentials:true
    optionSuccessStatus: 200,
}))

app.use(express.json());
app.use(cookieParser())


///////////////////////////////////
//Routes

app.get("/dummy", async (req, res, next) => {

    return res.json({
        tasks: [
            { title: 'Task1', },
            { title: 'Task2', },
        ]
    });
})

app.use(tripRoutes)
app.use(userRoutes)

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

///////////////////////////////////
// Starting the server

app.listen(8080, () => {
    console.log(`Listening on ${PORT}`)
})

module.exports = app

