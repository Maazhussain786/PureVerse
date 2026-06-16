// Watch Party models — mirror the backend serializer in
// backend/src/services/partyService.ts (serializeRoom / serializeMember) and
// the socket payloads in backend/src/sockets/roomCoordinator.ts.

double _toDouble(dynamic v) => (v is num) ? v.toDouble() : 0.0;
int _toInt(dynamic v) => (v is num) ? v.toInt() : 0;

class PartyMember {
  final String socketId;
  final String name;
  final String avatar;
  final bool isHost;
  final int joinedAt;
  final bool muted;
  // Voice + sync flags (kept in sync via party:voice-state / party:members).
  final bool inVoice;
  final bool micOn;
  final bool deafened;
  final bool buffering;

  const PartyMember({
    required this.socketId,
    required this.name,
    required this.avatar,
    required this.isHost,
    this.joinedAt = 0,
    this.muted = false,
    this.inVoice = false,
    this.micOn = false,
    this.deafened = false,
    this.buffering = false,
  });

  factory PartyMember.fromJson(Map<String, dynamic> j) => PartyMember(
        socketId: (j['socketId'] ?? '').toString(),
        name: (j['name'] ?? 'Guest').toString(),
        avatar: (j['avatar'] ?? '').toString(),
        isHost: j['isHost'] == true,
        joinedAt: _toInt(j['joinedAt']),
        muted: j['muted'] == true,
        inVoice: j['inVoice'] == true,
        micOn: j['micOn'] == true,
        deafened: j['deafened'] == true,
        buffering: j['buffering'] == true,
      );

  PartyMember copyWith({
    bool? inVoice,
    bool? micOn,
    bool? deafened,
    bool? buffering,
  }) =>
      PartyMember(
        socketId: socketId,
        name: name,
        avatar: avatar,
        isHost: isHost,
        joinedAt: joinedAt,
        muted: muted,
        inVoice: inVoice ?? this.inVoice,
        micOn: micOn ?? this.micOn,
        deafened: deafened ?? this.deafened,
        buffering: buffering ?? this.buffering,
      );
}

class PartyChatMessage {
  final String id;
  final String kind; // 'chat' | 'system'
  final String? authorSocketId;
  final String authorName;
  final String? authorAvatar;
  final bool authorIsHost;
  final String text;
  final int createdAt;

  const PartyChatMessage({
    required this.id,
    required this.kind,
    this.authorSocketId,
    required this.authorName,
    this.authorAvatar,
    this.authorIsHost = false,
    required this.text,
    required this.createdAt,
  });

  bool get isSystem => kind == 'system';

  factory PartyChatMessage.fromJson(Map<String, dynamic> j) => PartyChatMessage(
        id: (j['id'] ?? '').toString(),
        kind: (j['kind'] ?? 'chat').toString(),
        authorSocketId: j['authorSocketId']?.toString(),
        authorName: (j['authorName'] ?? '').toString(),
        authorAvatar: j['authorAvatar']?.toString(),
        authorIsHost: j['authorIsHost'] == true,
        text: (j['text'] ?? '').toString(),
        createdAt: _toInt(j['createdAt']),
      );
}

class PartyMedia {
  final String type; // movie | tv | anime
  final String id;
  final String title;
  final String? posterUrl;
  final String? bannerUrl;
  final int? season;
  final int? episode;
  final int sourceIdx;
  final String? category; // 'sub' | 'dub'

  const PartyMedia({
    required this.type,
    required this.id,
    required this.title,
    this.posterUrl,
    this.bannerUrl,
    this.season,
    this.episode,
    this.sourceIdx = 0,
    this.category,
  });

  bool get isSeries => type == 'tv' || type == 'anime';

  /// Identity used to decide whether a media change requires reloading the
  /// stream (episode / source / audio category).
  String get streamKey => '$type:$id:${season ?? 0}:${episode ?? 0}:$sourceIdx:${category ?? ''}';

  factory PartyMedia.fromJson(Map<String, dynamic> j) => PartyMedia(
        type: (j['type'] ?? '').toString(),
        id: (j['id'] ?? '').toString(),
        title: (j['title'] ?? 'Untitled').toString(),
        posterUrl: j['posterUrl']?.toString(),
        bannerUrl: j['bannerUrl']?.toString(),
        season: j['season'] != null ? _toInt(j['season']) : null,
        episode: j['episode'] != null ? _toInt(j['episode']) : null,
        sourceIdx: _toInt(j['sourceIdx']),
        category: j['category']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        'type': type,
        'id': id,
        'title': title,
        if (posterUrl != null) 'posterUrl': posterUrl,
        if (bannerUrl != null) 'bannerUrl': bannerUrl,
        if (season != null) 'season': season,
        if (episode != null) 'episode': episode,
        'sourceIdx': sourceIdx,
        if (category != null) 'category': category,
      };
}

class PartyPlayback {
  final bool isPlaying;
  final double positionSec; // position at [updatedAt]
  final int updatedAt; // ms epoch (server clock)

  const PartyPlayback({
    this.isPlaying = false,
    this.positionSec = 0,
    this.updatedAt = 0,
  });

  /// Live position derived from the virtual clock — extrapolate while playing.
  double get livePosition {
    if (!isPlaying || updatedAt == 0) return positionSec;
    return positionSec + (DateTime.now().millisecondsSinceEpoch - updatedAt) / 1000.0;
  }

  factory PartyPlayback.fromJson(Map<String, dynamic> j) => PartyPlayback(
        isPlaying: j['isPlaying'] == true,
        positionSec: _toDouble(j['positionSec']),
        updatedAt: _toInt(j['updatedAt']),
      );
}

class PartyRoom {
  final String code;
  final String name;
  final bool isPublic;
  final bool hasPassword;
  final bool allowGuestControl;
  final bool autoWait;
  final bool holding;
  final String hostSocketId;
  final int createdAt;
  final PartyMedia media;
  final PartyPlayback playback;
  final List<PartyMember> members;
  final List<PartyChatMessage> chat;

  const PartyRoom({
    required this.code,
    required this.name,
    required this.isPublic,
    required this.hasPassword,
    required this.allowGuestControl,
    required this.autoWait,
    required this.holding,
    required this.hostSocketId,
    required this.createdAt,
    required this.media,
    required this.playback,
    required this.members,
    required this.chat,
  });

  factory PartyRoom.fromJson(Map<String, dynamic> j) => PartyRoom(
        code: (j['code'] ?? '').toString(),
        name: (j['name'] ?? 'Watch Party').toString(),
        isPublic: j['isPublic'] == true,
        hasPassword: j['hasPassword'] == true,
        allowGuestControl: j['allowGuestControl'] == true,
        autoWait: j['autoWait'] != false,
        holding: j['holding'] == true,
        hostSocketId: (j['hostSocketId'] ?? '').toString(),
        createdAt: _toInt(j['createdAt']),
        media: PartyMedia.fromJson(
            (j['media'] as Map?)?.cast<String, dynamic>() ?? const {}),
        playback: PartyPlayback.fromJson(
            (j['playback'] as Map?)?.cast<String, dynamic>() ?? const {}),
        members: ((j['members'] as List?) ?? const [])
            .whereType<Map>()
            .map((m) => PartyMember.fromJson(m.cast<String, dynamic>()))
            .toList(),
        chat: ((j['chat'] as List?) ?? const [])
            .whereType<Map>()
            .map((c) => PartyChatMessage.fromJson(c.cast<String, dynamic>()))
            .toList(),
      );

  PartyRoom copyWith({
    String? name,
    bool? isPublic,
    bool? hasPassword,
    bool? allowGuestControl,
    bool? autoWait,
    bool? holding,
    String? hostSocketId,
    PartyMedia? media,
    PartyPlayback? playback,
    List<PartyMember>? members,
    List<PartyChatMessage>? chat,
  }) =>
      PartyRoom(
        code: code,
        name: name ?? this.name,
        isPublic: isPublic ?? this.isPublic,
        hasPassword: hasPassword ?? this.hasPassword,
        allowGuestControl: allowGuestControl ?? this.allowGuestControl,
        autoWait: autoWait ?? this.autoWait,
        holding: holding ?? this.holding,
        hostSocketId: hostSocketId ?? this.hostSocketId,
        createdAt: createdAt,
        media: media ?? this.media,
        playback: playback ?? this.playback,
        members: members ?? this.members,
        chat: chat ?? this.chat,
      );

  PartyMember? memberById(String socketId) {
    for (final m in members) {
      if (m.socketId == socketId) return m;
    }
    return null;
  }
}

/// A row in the public-room browser (GET /party/rooms — summarizeRoom shape).
class PublicRoom {
  final String code;
  final String name;
  final bool hasPassword;
  final int memberCount;
  final String mediaTitle;
  final String? posterUrl;
  final int? season;
  final int? episode;

  const PublicRoom({
    required this.code,
    required this.name,
    required this.hasPassword,
    required this.memberCount,
    required this.mediaTitle,
    this.posterUrl,
    this.season,
    this.episode,
  });

  factory PublicRoom.fromJson(Map<String, dynamic> j) {
    final media = (j['media'] as Map?)?.cast<String, dynamic>() ?? const {};
    return PublicRoom(
      code: (j['code'] ?? '').toString(),
      name: (j['name'] ?? 'Watch Party').toString(),
      hasPassword: j['hasPassword'] == true,
      memberCount: _toInt(j['memberCount']),
      mediaTitle: (media['title'] ?? '').toString(),
      posterUrl: media['posterUrl']?.toString(),
      season: media['season'] != null ? _toInt(media['season']) : null,
      episode: media['episode'] != null ? _toInt(media['episode']) : null,
    );
  }
}
