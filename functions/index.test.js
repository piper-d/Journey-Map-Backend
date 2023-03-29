const request = require("supertest")
const { execSync } = require("child_process");
const { testApi } = require("./index");
const { makeRandomName } = require("./utils/helperFunctions");
require('dotenv').config();

describe("GET / ", () => {
    test("backend is successfully connected", async () => {
        const response = await request(testApi).get("/")
        expect(response.statusCode).toBe(200);
    })
})

describe("GET /trips", () => {
    test("Retrieve all the trips that belong to the user", async () => {
        let id = ""
        let stdout = execSync(`curl 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.API_KEY}' \
            -H 'Content-Type: application/json' \
            --data-binary '{"email":"${process.env.TEST_EMAIL}","password":"${process.env.TEST_PASSWORD}","returnSecureToken":true}'`)

        const obj = JSON.parse(stdout)
        id = obj["idToken"]
        const response = await request(testApi).get("/trips").set("Authorization", `Bearer ${id}`)
        expect(response.statusCode).toBe(200)
        expect(response.body.length).toBe(7)
    })
})


describe("GET /trips/:id", () => {
    test("Retrieve certain trip details. Also test if backend protects against non authorized access", async () => {
        let id = ""
        let stdout = execSync(`curl 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.API_KEY}' \
            -H 'Content-Type: application/json' \
            --data-binary '{"email":"${process.env.TEST_EMAIL}","password":"${process.env.TEST_PASSWORD}","returnSecureToken":true}'`)

        const obj = JSON.parse(stdout)
        id = obj["idToken"]
        const response = await request(testApi).get("/trips/PozLNi78FVfmBk3mrTfK").set("Authorization", `Bearer ${id}`)
        const responseWithError = await request(testApi).get("/trips/CHBGoZrfKFAS1W5tdvGX").set("Authorization", `Bearer ${id}`)
        expect(response.statusCode).toBe(200)
        expect(response.body.data.title).toEqual("FOR TESTING PURPOSES DO NOT DELETE")
        expect(responseWithError.statusCode).toBe(403)
    })
})


describe("POST /trips, PUT /trips/:id, GET /trips/:id/export, DELETE /trips/:id", () => {
    let createPayload = {
        "details": {
            "start_time": "Tue Mar 24 2015 20:20:00 GMT-0400 (Eastern Daylight Time)",
            "end_time": "Tue Mar 24 2015 22:20:00 GMT-0400 (Eastern Daylight Time)",
            "average_speed_mph": "",
            "distance_traveled_miles": ""
        },
        "point_coords": [
            [50, 47],
            [50, 48],
            [50, 49],
            [50, 50]
        ],
        "title": "FOR TESTING PURPOSES DO NOT DELETE"
    }

    let updatePayload = {
        "title": "trip to Maldives"
    }

    test("Create a new trip, then update it, then export it, and then delete it", async () => {
        let id = ""
        let stdout = execSync(`curl 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.API_KEY}' \
            -H 'Content-Type: application/json' \
            --data-binary '{"email":"${process.env.TEST_EMAIL}","password":"${process.env.TEST_PASSWORD}","returnSecureToken":true}'`)

        const obj = JSON.parse(stdout)
        id = obj["idToken"]
        const responseOnCreate = await request(testApi).post("/trips").set("Authorization", `Bearer ${id}`).send(createPayload)
        const tripId = responseOnCreate.body.tripId

        //Check if creation was successful
        expect(responseOnCreate.statusCode).toBe(200)
        expect(responseOnCreate.body.error).toBe("")
        expect(tripId.length).toEqual(20)

        //Check if update was successful
        const responseOnUpdate = await request(testApi).put(`/trips/${tripId}`).set("Authorization", `Bearer ${id}`).send(updatePayload)
        expect(responseOnUpdate.statusCode).toBe(200)
        expect(responseOnUpdate.body.error).toBe("")
        expect((await request(testApi).get(`/trips/${tripId}`).set("Authorization", `Bearer ${id}`)).body.data.title).toBe("trip to Maldives")


        //Export the trip
        // const responseOnExport = await request(testApi).get(`/trips/${tripId}/export`).set("Authorization", `Bearer ${id}`)
        // expect(responseOnExport.statusCode).toBe(200)
        // expect(responseOnExport.body.error).toBe("")
        // expect(responseOnExport.body.downloadLink).toBeTruthy()

        //Check if delete was successful
        const responseOnDelete = await request(testApi).delete(`/trips/${tripId}`).set("Authorization", `Bearer ${id}`)
        expect(responseOnDelete.statusCode).toBe(200)
        expect(responseOnDelete.body.error).toBe("")
    })
})



describe("GET /user", () => {
    test("Retrieve logged in user's information", async () => {
        let id = ""
        let stdout = execSync(`curl 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.API_KEY}' \
            -H 'Content-Type: application/json' \
            --data-binary '{"email":"${process.env.TEST_EMAIL}","password":"${process.env.TEST_PASSWORD}","returnSecureToken":true}'`)

        const obj = JSON.parse(stdout)
        id = obj["idToken"]
        const response = await request(testApi).get("/user").set("Authorization", `Bearer ${id}`)
        expect(response.statusCode).toBe(200)
        expect(response.body.email).toEqual(process.env.TEST_EMAIL)
    })
})


describe("PUT /user", () => {
    let newUsername = makeRandomName(5)
    test("Update logged in user's information", async () => {
        let id = ""
        let stdout = execSync(`curl 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.API_KEY}' \
            -H 'Content-Type: application/json' \
            --data-binary '{"email":"${process.env.TEST_EMAIL}","password":"${process.env.TEST_PASSWORD}","returnSecureToken":true}'`)

        const obj = JSON.parse(stdout)
        id = obj["idToken"]
        const response = await request(testApi).put("/user").set("Authorization", `Bearer ${id}`).send({ "username": newUsername })
        expect(response.statusCode).toBe(200)
        expect(response.body.email).toEqual(process.env.TEST_EMAIL)
        expect(response.body.username).toEqual(newUsername)
    })
})