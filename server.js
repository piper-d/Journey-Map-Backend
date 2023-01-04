///////////////////////////////////
// Requirements and dependencies
const cookieParser = require("cookie-parser")
const express = require("express")
const csrf = require("csurf")
const cors = require("cors")
const admin = require("./config/firebase-config")
const AppError = require("./utils/AppError")
const { decodeToken } = require("./middleware")
const { findHourDifference, calculateDistance, findAverageSpeed } = require("./utils/helperFunctions")
const { firestore } = require("firebase-admin")

///////////////////////////////////
// Initializing the app
const PORT = process.env.PORT || 8080
const app = express()
// const csrfMiddleware = csrf({ cookie: true })
const db = admin.firestore()


///////////////////////////////////
// Middleware
app.use(cors({
    origin: ['http://localhost:3000'],
    credentials: true, //access-control-allow-credentials:true
    optionSuccessStatus: 200,
}))
// app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser())
// app.use(csrfMiddleware)


///////////////////////////////////
// Set a token on any request to protect against CSRF attacks
// app.all('*', (req, res, next) => {
//     res.cookie('XSRF-TOKEN', req.csrfToken())
//     next()
// })


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


<<<<<<< HEAD
app.get("/user", async (req, res) => { 
    try {
        await db.collection('Users').doc()
        .create({                       //Creates Entry for Users
            Trips: [],                  //
            email: 'test@email.com',    //req.body.email ,
            username: 'username'        //req.body.username
        })
            return res.status(200).send()

        } catch (e) {
            next(new AppError("Bad request", 400))
        }
    
})

app.get("/user/:id", async (req, res) => { 
    const { id } = req.params

    try {
        const snap = await db.collection('Users').doc(id).get()

        if (snap.exists) {
            const data = snap.data();

            const userItems = {
                username: data.username,    //Username
                email: data.email,          //Email Data
                //Trips: data.Trips ,       //Shows Trips but its messy
            }

            return res.json(userItems)
        }else{
            res.json({ trips: "This user does not exist" })
        }
            return res.status(200).send()
        } catch (e) {
            next(new AppError("Bad request", 400))
        }
})

/*
app.get("/user/:id", decodeToken, async (req, res, next) => {
    const { id } = req.params

    try {
        const snap = await db.collection('Users').doc(id).get()
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

    }
})
*/
=======
app.post("/trips", decodeToken, async (req, res, next) => {
    const { media = {}, point_coords = [], details = {} } = req.body
    const user = await db.collection("Users").doc(req.user)

    details["end_time"] = new Date(details["end_time"])
    details["start_time"] = new Date(details["start_time"])
    const distance_traveled = calculateDistance(point_coords)
    const timeElapsed = findHourDifference(details["end_time"], details["start_time"])
    details["average_speed_mph"] = findAverageSpeed(timeElapsed, distance_traveled).toString()
    details["distance_traveled_miles"] = distance_traveled.toString()

    let coords = []
    for (let point of point_coords) {
        coords.push(new admin.firestore.GeoPoint(point[0], point[1]))
    }

    const data = { user, media, details, point_coords: coords }

    try {
        const result = await db.collection('Trips').add(data)
        const trip_ref = await db.collection("Trips").doc(result.id)
        await user.update({ Trips: firestore.FieldValue.arrayUnion(trip_ref) })
        return res.status(200).json({ error: "" })
    } catch (e) {
        console.log("ERRRRROOOOOOOOOR")
        console.log(e)
        next(new AppError("Bad request. Could not create a trip", 400))
    }
})
>>>>>>> 413ac09716290cf9ad66cc8ce0a2c29d5de2cf08

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


