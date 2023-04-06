## Source code for the backend of the Journey Map application
### Senior Design, Fall 2022-Spring 2023

<b>Team:</b> <br>
<i>Lead Backend Engineer:</i> [Emin Mammadzada](https://github.com/EminMammadzada) <br>
<i>DevOps Engineer:</i> [Rafael Suarez](https://github.com/rasuar42) <br>
<i>Project Manager:</i> [Dylan Piper](https://github.com/piper-d) <br>

<b><i>Setup Prerequisites:</i></b> 

1. You need certain API keys and environment variables to be able to run the application on your device. Those include:<br>
  1.1. Firebase Service Account.<br>
  1.2. Account with valid username and password to run the Unit Test Suite.<br>
  1.3. Google Maps API key.<br>
  1.4. Shotstack API key.<br>
  1.5. Sendgrid API key.<br>

2. All the endpoints are protected from unauthorized access and require the user to include Bearer authentication token to execute the commands. To generate the Bearer token: <br>
  STEP 1: download the [frontend repository](https://github.com/piper-d/Journey-Map-Frontend).<br>
  STEP 2: download the necessary packages via ```npm i``` <br>
  STEP 3: run the command ```npm start```<br>
  STEP 4: After browser loads up, open the developer window and navigate to session storage in application tab.<br>
  STEP 5: Log into existing account or create new one.<br>
  STEP 6: Upon successful completion, you should be able to see a bearer token.<br>
  STEP 7: Use that token in authorization header in Postman, Arc, or whatever API testing solution you use with every request you send.<br><br>

***

<b>Commands:</b>

1. Download the required packages via ```npm i```</b>

2. Run the backend from /functions folder by executing the command ```npm run startdev```</b>
    
   Make sure that in index.js file, you comment out ```exports.app = functions.region("us-east1").https.onRequest(app);``` and uncomment ```app.listen()``` to run the localhost on port 8080.

3. To deploy the source code to Google Cloud Functions, uncomment ```exports.app = functions.region("us-east1").https.onRequest(app);```, then comment out ```app.listen()```. Afterwards, run ```npm run lint -- --fix```. Once eslint completes execution, run ```npm run deploy```

4. To run the test suite, execute ```npm run test```<br><br>

***

<b>Block Diagram</b>
![SD1](https://user-images.githubusercontent.com/74462948/228599131-4b1fd25f-da02-4d62-94e7-702723c38a1a.png)

***

<b>Firestore UML</b>

![Blank diagram-2](https://user-images.githubusercontent.com/74462948/228599975-9be9e848-983c-4f2a-94c5-9c49141fed95.png)

***

<b>Unit Testing Results at 81% Backend code coverage</b>
![Screenshot 2023-03-29 at 12 47 07 PM](https://user-images.githubusercontent.com/74462948/228610682-0f3467d1-6a0f-4e09-9147-7a401996c6c8.png)

