import assert from "node:assert/strict";
import { after, test } from "node:test";

process.env.CORS_ORIGIN = "https://client.example";
const { app } = await import("./app.js");
const server = app.listen(0);
after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
}));

test("health route responds with a healthy status", async () => {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, message: "API is healthy" });
});

test("feature routers are mounted and enforce authentication", async () => {
    const address = server.address();
    const routes = [
        "/users/current-user",
        "/videos/",
        "/comments/000000000000000000000001",
        "/likes/videos",
        "/playlist/user/000000000000000000000001",
        "/subscriptions/u/000000000000000000000001",
        "/tweets/user/000000000000000000000001",
    ];
    for (const route of routes) {
        const response = await fetch(`http://127.0.0.1:${address.port}/api/v1${route}`);
        assert.equal(response.status, 401, `${route} should reject unauthenticated requests`);
        assert.equal((await response.json()).success, false);
    }
});

test("cookie-authenticated mutations require an allowed origin", async () => {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/api/v1/tweets`;
    const sendRequest = (headers = {}) => fetch(url, {
        method: "POST",
        headers: { Cookie: "accessToken=invalid-token", ...headers },
    });

    assert.equal((await sendRequest()).status, 403);
    assert.equal((await sendRequest({ Origin: "https://attacker.example" })).status, 403);
    assert.equal((await sendRequest({ Origin: "https://client.example" })).status, 401);
});

test("a Bearer token takes priority over a cookie, so it skips the cookie origin check", async () => {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/tweets`, {
        method: "POST",
        headers: { Cookie: "accessToken=stale-cookie", Authorization: "Bearer invalid-token" },
    });
    // Rejected because the token is invalid (401), not because of the origin check (403).
    assert.equal(response.status, 401);
});

test("requests without a body get a 400 validation error instead of crashing with a 500", async () => {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/users/login`, { method: "POST" });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).success, false);
});

test("malformed JSON is a 400", async () => {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
    });
    assert.equal(response.status, 400);
});

test("the upload temp directory is never served statically", async () => {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/temp/.gitkeep`);
    assert.equal(response.status, 404);
});

test("uploads of the wrong file type are rejected before reaching Cloudinary", async () => {
    const address = server.address();
    const form = new FormData();
    form.set("avatar", new Blob(["not an image"], { type: "text/plain" }), "avatar.txt");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/users/register`, { method: "POST", body: form });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /avatar must be an image/);
});
