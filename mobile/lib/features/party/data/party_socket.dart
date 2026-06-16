import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/config/app_config.dart';

/// Singleton Socket.IO connection for Watch Party — the Flutter counterpart of
/// the web `lib/socket.ts`. One shared socket survives across the lobby and the
/// room screen so creating a party and landing in the room keeps the same
/// socket id (and therefore the same room membership).
io.Socket? _socket;

io.Socket partySocket() {
  final existing = _socket;
  if (existing != null) return existing;
  final s = io.io(
    AppConfig.socketBaseUrl,
    io.OptionBuilder()
        .setTransports(['websocket', 'polling'])
        .enableReconnection()
        .setReconnectionDelay(1000)
        .setReconnectionAttempts(20)
        .disableAutoConnect()
        .build(),
  );
  _socket = s;
  s.connect();
  return s;
}

/// Fully tear down the connection (called when leaving the party module so a
/// stale socket doesn't keep us in a room after the user backs out).
void disposePartySocket() {
  _socket?.dispose();
  _socket = null;
}
