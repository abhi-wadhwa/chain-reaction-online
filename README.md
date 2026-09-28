# Chain Reaction

[Play online](https://chain-reaction-online.vercel.app/)

Two players on separate devices. Create a room, copy its invite link, and send
it to a friend. Your friend opens the link and presses Join. Coral goes first.

Place an orb in an empty cell or one you own. Corners burst at 2 orbs, edges
at 3, and interior cells at 4. Bursts spread to adjacent cells and capture
their contents. After both players have moved, eliminating the opponent wins.
Both players must agree to a rematch.

Rooms use HTTPS requests to a Vercel function, with state in private Vercel
Blob storage. The server validates turns and uses conditional writes to avoid
conflicting updates. No direct browser connection is required. The browser
polls roughly every two seconds. Refreshing the same tab restores your seat;
rooms expire after two hours. Expiration blocks access but does not delete the
stored room object. This is a small casual prototype with no accounts.

## Development

Install Node.js and Vercel CLI, then run `npm ci`. Link the Vercel project with
`vercel link`, connect a private Blob store, and run `vercel dev`.
The store uses Vercel OIDC authentication and the connected BLOB_STORE_ID.
Keep local environment files and credentials out of Git.

Run `npm test` for room concurrency, authorization, replay, rematch, and game
rules tests. Deploy with `vercel deploy --prod`. Static files live in `public/`
and the room function in `api/room.js`. The root GitHub Pages page redirects
to the Vercel game.
