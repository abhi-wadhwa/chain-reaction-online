# Chain Reaction

[Play online](https://abhi-wadhwa.github.io/chain-reaction-online/)

A basic two-player game for separate devices. One player creates a room and
sends the invite link to a friend. The friend opens it and presses **Join**.
Coral goes first. Keep both tabs open.

## Rules

Place an orb in an empty cell or one you own. Corners burst at 2 orbs, edges
at 3, and interior cells at 4. Each burst sends an orb to every adjacent cell
and captures its contents. After both players have made a move, eliminating
the other player's orbs wins. Both players must agree to a rematch.

## Run locally

No build step. With Python installed, run `python -m http.server 8000` in this
folder and open `http://localhost:8000`. Internet access is required for PeerJS.

The entire app is in `index.html`. GitHub Pages publishes the root of `main`.
PeerJS 1.5.5 provides WebRTC data connections through its public signaling
service. The host validates moves and sends board updates to the guest.

This is a casual game with no accounts, saved matches, or reconnection.
Some restrictive networks cannot establish a peer-to-peer connection. There
is no dedicated TURN relay configured; try a different network if joining
times out. The host is trusted, so this is not an anti-cheat system.

## Verification

Checked turn enforcement, ownership, corner/edge/interior thresholds,
captures, elimination, and orb conservation across 20 simulated games.
Two browser sessions also verified joining, synchronized moves, a capture
win, mutual rematch, and disconnect handling.
