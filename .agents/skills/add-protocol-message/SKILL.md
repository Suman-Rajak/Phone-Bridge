---
name: add-protocol-message
description: Add or revise a PhoneBridge wire message and keep its Zod schema, tests, and protocol documentation aligned. Use for WebRTC data channels or signaling messages.
---

# Add a protocol message

1. Read the task in `docs/ROADMAP.md` and the corresponding contract in `docs/design/protocol.md`. Identify the recipient, channel, message type, and bounds before changing the schema.
2. Define the message in `packages/protocol`. The WebRTC schemas are in `src/messages.ts`. Keep the signaling contract separate from the WebRTC envelope. Validate received data with the schema before feature code handles it.
3. Add valid and invalid cases to the relevant protocol tests. Cover any role, channel, field bounds, or optional cases that the message introduces. Check that earlier messages still parse.
4. Update the wire table and any version notes in `docs/design/protocol.md`. Follow the roadmap’s version policy for breaking changes.
5. Run `pnpm test -- protocol` and `pnpm typecheck`. Record this use in the task evidence and use the `skill:add-protocol-message` capability trailer.
