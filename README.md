## Source code for the backend of the Journey Map application
### Senior Design, Fall 2022-Spring 2023

<b><i>Disclaimer:</i></b> 

You need certain API keys and environment variables to be able to run the application on your device. Those include:
  1. Firebase Service Account.
  2. Account with valid username and password to run the Unit Test Suite.
  3. Google Maps API key.
  4. Shotstack API key.
  5. Sendgrid API key.

<b>Commands:</b>

1. Download the required packages via <b>"npm i".</b>

2. Run the backend from /functions folder by executing the command <b>"npm run startdev".</b>
    
   Make sure that in index.js file, you comment out "exports.app = functions.region("us-east1").https.onRequest(app);" and uncomment app.listen() to run         the localhost on port 8080.

3. To deploy the source code to Google Cloud Functions, uncomment "exports.app = functions.region("us-east1").https.onRequest(app);", then comment out app.listen(). Afterwards, run <b>"npm run lint -- --fix".</b> Once eslint completes execution, run <b>"npm run deploy".</b>

4. To run the test suite, execute <b>"npm run test".</b>

