// /////////////////////////////////
// Requirements and dependencies
const functions = require("firebase-functions");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const express = require("express");
const sgMail = require("@sendgrid/mail");

// Security
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");

// Routes and Error handling
const AppError = require("./utils/AppError");
const tripRoutes = require("./routes/tripRoutes");
const userRoutes = require("./routes/userRoutes");

// /////////////////////////////////
// Initializing the app
const app = express();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// /////////////////////////////////
// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "https://journeymap-a8e65.web.app", "https://journeymap-a8e65.firebaseapp.com", "https://journeymap.dev", "https://www.journeymap.dev"],
  credentials: true, // access-control-allow-credentials:true
  optionSuccessStatus: 200,
}));
app.use(limiter);
app.use(mongoSanitize());
app.use(helmet());
app.use(hpp());
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(cookieParser());

// /////////////////////////////////
// Routes

app.get("/", (req, res) => {
  return res.status(200).json({message: "connected to the backend"});
});

app.get("/dummy", async (req, res) => {
  return res.json({
    tasks: [
      {title: "Task1"},
      {title: "Task2"},
    ],
  });
});

app.post("/contact", async (req, res) => {
  const {email, name, message} = req.body;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const msg = {
    to: "journeymapteam@gmail.com",
    from: "journeymapteam@gmail.com",
    subject: `${name} sent you a message from the contact form`,
    html: `
      <h4>From: ${name}</h4>
      <h4>Email: ${email}</h4> <br>
      <p>Message:${message}</p>
    `,
  };

  // send email
  (async () => {
    try {
      await sgMail.send(msg);
      return res.status(200).json({error: ""});
    } catch (error) {
      return res.status(400).json({error: "Could not send an email"});
    }
  })();
});

app.use(tripRoutes);
app.use(userRoutes);

// /////////////////////////////////
// Error routes

app.all("*", (req, res, next) => {
  next(new AppError("API endpoint is non-existent", 404));
});

app.use((err, req, res, next) => {
  const {statusCode = 500} = err;
  if (!err.message) err.message = "Oh No, Something Went Wrong!";
  res.status(statusCode).json({"error": err});
});

// /////////////////////////////////
// Starting the server

// Use for Local Testing
// app.listen(8080, () => {
//   console.log(`Listening on ${8080}`);
// });


// Exporting for unit testing purposesS
exports.testApi = app;

// Uncomment for deployment
exports.app = functions.region("us-east1").https.onRequest(app);

