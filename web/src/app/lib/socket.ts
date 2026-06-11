"use client";

import { io, Socket } from "socket.io-client";
import { SOCKET_BASE } from "./api";

// Singleton socket.io connection — survives route changes so creating a
// party on the watch page and landing in /party/[code] keeps the same
// socket (and therefore the same room membership).
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_BASE, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 20,
    });
  }
  return socket;
}
