# ADR 0001 — Host signaling in a Cloudflare Worker

Accepted for T04.

Use a Cloudflare Worker for the public WebSocket endpoint and a Durable Object per room. A single object coordinates roles, alarms, and relay ordering for that room. Use the WebSocket Hibernation API where it fits the room lifecycle, storing only the metadata needed to recover connection roles and expiry. The room alarm handles unjoined expiry. Closing either peer closes the room. [Durable Object WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) · [Durable Object alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)

If Cloudflare becomes unavailable for deployment, the fallback is a Node process with `ws` and the same wire contract. A single Node process can manage rooms in memory, but a multi-instance deployment would need room affinity or equivalent coordination. Adopting that fallback would explicitly authorize its additional dependency and hosting change.

Both choices relay SDP and ICE only and keep user content in WebRTC. See the [architecture](../architecture.md) and [threat model](../threat-model.md).
