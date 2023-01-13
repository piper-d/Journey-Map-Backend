const request = require("supertest")
const { execSync } = require("child_process");
const { testApi } = require("./index")
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
        expect(response.body.length).toEqual(1)
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
        const response = await request(testApi).get("/trips/Hwmhjp0PMg5M9CJteKag").set("Authorization", `Bearer ${id}`)
        const responseWithError = await request(testApi).get("/trips/Ce7MOaNZCWKPlb8sB8Ju").set("Authorization", `Bearer ${id}`)
        expect(response.statusCode).toBe(200)
        expect(response.body.title).toEqual("FOR TESTING PURPOSES DO NOT DELETE")
        expect(responseWithError.statusCode).toBe(403)
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
    function makeUsername(length) {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    let newUsername = makeUsername(5)
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

