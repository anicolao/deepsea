# Manually verify a PR preview

Every PR must link its retained preview and pass `preview-smoke` on the exact head commit before it is ready. The CI report includes both phone and desktop screenshots. Local emulator results alone do not qualify.

For PR #5, the retained address is https://anicolao.github.io/deepsea/pr5/. It connects to the dedicated `deepsea-preview-anicolao` Firebase project, with anonymous sign-in and Firestore events scoped to `environments/pr5/`.

Check that `preview-smoke` passed on the current head, then:

1. Open the preview in a normal browser. Choose **Create room**, enter your name, and create it. You appear as **You · Host**. Start is disabled with an explanation.
2. Choose **Copy invite**. Open the copied address on another device or in a separate browser profile/private session. Enter a different name and choose **Join room**. Both browsers show the same crew. The guest has no Start button.
3. Ready the guest, then invite a third person. Everyone becomes not ready when that person joins. Ready all three people. As host, select a different **First diver**, then **Start dive**.
4. Both browsers show **Dive 1 is ready**, the same ordered seats, and your selected first diver. Reload the guest: their **You** label and the saved start remain. This PR implements room setup; taking turns belongs to the next step.
5. Open the invite in another fresh browser: it says the dive has already started and offers another room. It cannot join the frozen crew.
6. Create another room with two people. The guest can leave and rejoin; a roster change clears readiness. When the host leaves, explicitly confirm **Close room**. Both browsers show that the room is closed. **Stay** cancels closure.

Names may repeat; anonymous browser identities determine seats. Two tabs in the same browser profile intentionally share an identity. Invites retain the full PR path; rooms from another PR or production are separate. If clipboard access is denied, Copy invite reveals a selectable link to copy manually.

The client displays pending confirmation and connection failures. It must never claim an action succeeded solely because a write was submitted. A missing, full, closed, or already-started room explains why joining is unavailable.

## Backend maintenance

Firebase configuration in static/backend.json is public browser configuration; administrative credentials stay outside the repository. The default Firestore database uses nam5. firebase.json declares anonymous authentication and the immutable event rules. After Firebase CLI sign-in, deploy backend changes explicitly to the preview project:

```sh
nix develop -c npm exec -- firebase deploy --only auth,firestore:rules --project deepsea-preview-anicolao --non-interactive
```

Deploy compatible rules before the PR preview smoke test. Preserve support for retained preview versions when changing rules. Each PR uses its own namespace; production must use a different project. CI needs no administrative credentials: it exercises the same anonymous browser access as a reviewer, creating its own rooms through UI actions. No fixture data is inserted into the hosted backend.
