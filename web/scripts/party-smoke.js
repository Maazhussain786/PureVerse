// Watch-party socket smoke test: host creates a room, a guest joins,
// both chat, host controls playback + episode, guest control is denied,
// host kicks the guest. Run: node scripts/party-smoke.js
const { io } = require("socket.io-client");

const BASE = "http://localhost:5000";
const log = (...args) => console.log("[smoke]", ...args);
const fail = (msg) => {
  console.error("[FAIL]", msg);
  process.exit(1);
};

const host = io(BASE, { transports: ["websocket"] });
const guest = io(BASE, { transports: ["websocket"] });

let roomCode = "";
let guestSawChat = false;
let guestSawPlay = false;
let guestSawMedia = false;
let guestKicked = false;

guest.on("party:chat", (m) => {
  if (m.kind === "chat" && m.text === "hello from host") guestSawChat = true;
});
guest.on("party:playback", (p) => {
  if (p.action === "play") guestSawPlay = true;
});
guest.on("party:media", (p) => {
  if (p.media.episode === 6) guestSawMedia = true;
});
guest.on("party:kicked", () => {
  guestKicked = true;
});

host.on("connect", () => {
  host.emit(
    "party:create",
    {
      name: "Smoke Room",
      isPublic: true,
      allowGuestControl: false,
      media: { type: "tv", id: "tmdb_1396", title: "Breaking Bad", season: 2, episode: 5, sourceIdx: 0 },
      profile: { name: "HostBot", avatar: "" },
    },
    (res) => {
      if (!res?.success) fail("create failed: " + res?.message);
      roomCode = res.room.code;
      log("room created:", roomCode, "host is", res.room.members[0].name);

      guest.emit(
        "party:join",
        { code: roomCode, profile: { name: "GuestBot", avatar: "" } },
        (jres) => {
          if (!jres?.success) fail("join failed: " + jres?.message);
          log("guest joined, members:", jres.room.members.length);

          // Guest tries to control playback (should be ignored)
          guest.emit("party:playback", { action: "play" });

          setTimeout(() => {
            if (guestSawPlay) fail("guest playback control was NOT blocked");
            log("guest playback control correctly blocked");

            host.emit("party:chat", { text: "hello from host" });
            host.emit("party:playback", { action: "play" });
            host.emit("party:media", { episode: 6 });

            setTimeout(() => {
              if (!guestSawChat) fail("guest did not receive chat");
              if (!guestSawPlay) fail("guest did not receive host play");
              if (!guestSawMedia) fail("guest did not receive episode change");
              log("chat + playback + media sync all received by guest");

              // Find guest socket id from host's view, then kick
              host.emit("party:sync");
              host.once("party:state", (state) => {
                const guestMember = state.members.find((m) => m.name === "GuestBot");
                if (!guestMember) fail("guest not in member list");
                host.emit("party:mod", { action: "kick", targetSocketId: guestMember.socketId });
                setTimeout(() => {
                  if (!guestKicked) fail("guest was not kicked");
                  log("moderation kick works");
                  log("ALL PARTY SMOKE TESTS PASSED ✓");
                  host.close();
                  guest.close();
                  process.exit(0);
                }, 600);
              });
            }, 700);
          }, 700);
        }
      );
    }
  );
});

setTimeout(() => fail("timeout — events never arrived"), 15000);
