// netlify/functions/markers.js
// Simple shared storage for map markers using Netlify Blobs.
// GET  -> returns all markers as JSON array
// POST -> saves the full markers array (body: JSON array), returns it back

const { getStore } = require("@netlify/blobs");

const STORE_NAME = "commons-sewer-markers";
const KEY = "markers";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  const store = getStore(STORE_NAME);

  if (event.httpMethod === "GET") {
    try {
      const data = await store.get(KEY, { type: "json" });
      return { statusCode: 200, headers, body: JSON.stringify(data || []) };
    } catch (err) {
      return { statusCode: 200, headers, body: JSON.stringify([]) };
    }
  }

  if (event.httpMethod === "POST") {
    try {
      const markers = JSON.parse(event.body || "[]");
      if (!Array.isArray(markers)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Expected an array" }) };
      }
      await store.setJSON(KEY, markers);
      return { statusCode: 200, headers, body: JSON.stringify(markers) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};
