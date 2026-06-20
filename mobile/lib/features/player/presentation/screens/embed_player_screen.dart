import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/models/stream_source.dart';
import '../../../../core/models/watch_history.dart';
import '../../../../features/user/user_state.dart';
import '../../../../shared/providers/api_providers.dart';
import '../widgets/episode_picker_sheet.dart';

/// Hybrid playback: loads the provider's embed page in a hardened WebView
/// (popups + cross-host top-frame redirects blocked) inside our own fullscreen
/// landscape chrome. Used as the fallback when an on-device direct stream can't
/// be captured; still supports in-player season + episode switching.
class EmbedPlayerScreen extends ConsumerStatefulWidget {
  final String mediaType; // movie | tv | anime
  final String mediaId;
  final String title;
  final String posterUrl;
  final double rating;
  final int releaseYear;
  final int? totalSeasons;
  final int? season;
  final int? episode;
  final String? episodeTitle;

  const EmbedPlayerScreen({
    super.key,
    required this.mediaType,
    required this.mediaId,
    required this.title,
    this.posterUrl = '',
    this.rating = 0,
    this.releaseYear = 0,
    this.totalSeasons,
    this.season,
    this.episode,
    this.episodeTitle,
  });

  @override
  ConsumerState<EmbedPlayerScreen> createState() => _EmbedPlayerScreenState();
}

class _EmbedPlayerScreenState extends ConsumerState<EmbedPlayerScreen> {
  StreamPayload? _payload;
  Object? _error;
  int _selected = 0;
  bool _tipShown = false; // one-time "switch server" hint
  final Set<int> _failed = {}; // server indices that errored — skip on auto-failover

  late int? _season = widget.season;
  late int? _episode = widget.episode;
  bool get _isSeries =>
      widget.mediaType == 'tv' || widget.mediaType == 'anime';

  @override
  void initState() {
    super.initState();
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    _load();
  }

  Future<void> _load() async {
    try {
      final payload = await ref.read(apiClientProvider).getStream(
            widget.mediaType,
            widget.mediaId,
            season: _season,
            episode: _episode,
          );
      if (!mounted) return;
      setState(() {
        _payload = payload;
        _selected = _defaultSourceIndex(payload.sources);
      });
      _maybeShowSwitchTip();
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  /// Which server to start on. Movies & TV default to **VidFast** (cleanest on a
  /// phone), with **VidLink** as the fallback. The website defaults to Videasy
  /// instead, but its UI reads poorly on mobile, so the app stays on VidFast.
  /// Anime keeps its own provider order (PureVerse SUB first). Falls back to the
  /// first embed if neither is present.
  int _defaultSourceIndex(List<StreamSource> sources) {
    if (sources.isEmpty) return 0;
    if (widget.mediaType == 'movie' || widget.mediaType == 'tv') {
      for (final name in const ['vidfast', 'vidlink']) {
        final i =
            sources.indexWhere((s) => s.server.toLowerCase().contains(name));
        if (i >= 0) return i;
      }
    }
    final embed = sources.indexWhere((s) => s.isEmbed);
    return embed >= 0 ? embed : 0;
  }

  /// One-time hint pointing at the server switcher in the top bar.
  void _maybeShowSwitchTip() {
    if (_tipShown || !mounted) return;
    if ((_payload?.sources.length ?? 0) < 2) return;
    _tipShown = true;
    final isAnime = widget.mediaType == 'anime';
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        duration: const Duration(seconds: 5),
        behavior: SnackBarBehavior.floating,
        content: Text(isAnime
            ? 'Tip: use the server menu for SUB (Japanese + subtitles) / DUB, or to switch if there are issues.'
            : 'Tip: won\'t play or subtitles off? Tap the server icon to switch.'),
      ));
  }

  void _openEpisodes() {
    showEpisodePicker(
      context,
      mediaId: widget.mediaId,
      totalSeasons: widget.totalSeasons ?? 1,
      currentSeason: _season ?? 1,
      currentEpisode: _episode ?? 1,
      onSelect: _changeEpisode,
    );
  }

  void _changeEpisode(int season, int episode, String? title) {
    if (season == _season && episode == _episode) return;
    setState(() {
      _season = season;
      _episode = episode;
      _payload = null; // show the loader while the new source resolves
      _error = null;
      _selected = 0;
      _failed.clear();
    });
    ref.read(userStateProvider.notifier).addToHistory(
          WatchHistoryItem.create(
            id: widget.mediaId,
            type: widget.mediaType,
            title: widget.title,
            posterUrl: widget.posterUrl,
            rating: widget.rating,
            releaseYear: widget.releaseYear,
            season: season,
            episode: episode,
            episodeTitle: title,
          ),
        );
    _load();
  }

  @override
  void dispose() {
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  String? get _currentUrl {
    final sources = _payload?.sources;
    if (sources == null || sources.isEmpty) return null;
    return sources[_selected.clamp(0, sources.length - 1)].url;
  }

  Uri? get _embedHost {
    final u = _currentUrl;
    if (u == null) return null;
    return Uri.tryParse(u);
  }

  String _origin(String url) {
    final u = WebUri(url);
    return '${u.scheme}://${u.host}/';
  }

  /// Anime embeds like megaplay.buzz / megacloud refuse a direct top-level open
  /// and only play when the request carries a Referer (otherwise MegaPlay shows
  /// "can't find the file… copyright"). The website gets this for free by loading
  /// them in an `iframe`; setting a Referer header on a WebView main-frame load
  /// is unreliable on Android. So we reproduce the site exactly: a tiny local
  /// page whose only content is a full-bleed `iframe` for the embed, served from
  /// the embed's OWN origin (via the WebView baseUrl) with referrerpolicy=origin.
  /// The iframe request then carries Referer of the embed origin, which the
  /// provider accepts — same as the site's iframe.
  String _wrapperHtml(String url) {
    final src = url.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    return '''
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}
iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style>
</head>
<body>
<iframe src="$src" referrerpolicy="origin" allowfullscreen
  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"></iframe>
</body>
</html>''';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(child: _body()),
            _topBar(),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _message(
        icon: Icons.error_outline_rounded,
        text: 'Could not load this title.',
        detail: '$_error',
      );
    }
    if (_payload == null) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.accent),
      );
    }
    final url = _currentUrl;
    if (url == null || url.isEmpty) {
      return _message(
        icon: Icons.tv_off_rounded,
        text: 'No playable source found.',
        detail: 'Try another server or come back later.',
      );
    }

    return InAppWebView(
      key: ValueKey(url),
      initialData: InAppWebViewInitialData(
        data: _wrapperHtml(url),
        baseUrl: WebUri(_origin(url)),
        mimeType: 'text/html',
        encoding: 'utf-8',
      ),
      initialSettings: InAppWebViewSettings(
        mediaPlaybackRequiresUserGesture: false,
        allowsInlineMediaPlayback: true,
        javaScriptCanOpenWindowsAutomatically: false,
        supportMultipleWindows: false,
        useShouldOverrideUrlLoading: true,
        transparentBackground: true,
        iframeAllowFullscreen: true,
      ),
      // Block popups / popunders entirely.
      onCreateWindow: (controller, action) async => false,
      // A dead/blocked provider fails on the top frame — auto-advance to the
      // next server so the user isn't left on a blank page.
      onReceivedError: (controller, request, error) {
        if (request.isForMainFrame == true && !_failed.contains(_selected)) {
          _failed.add(_selected);
          _tryNextServer();
        }
      },
      shouldOverrideUrlLoading: (controller, action) async {
        final target = action.request.url;
        // Allow sub-frame (the actual player iframe) loads freely.
        if (action.isForMainFrame != true) {
          return NavigationActionPolicy.ALLOW;
        }
        // On the top frame, refuse cross-host redirects (ad hijacks).
        final host = _embedHost?.host;
        if (host != null && target != null && target.host != host) {
          return NavigationActionPolicy.CANCEL;
        }
        return NavigationActionPolicy.ALLOW;
      },
    );
  }

  /// Advance to the next embed server (used by auto-failover and the manual
  /// "Try next server" button). Changing [_selected] swaps the WebView's
  /// ValueKey, which reloads it with the next provider URL.
  void _tryNextServer() {
    final sources = _payload?.sources ?? const <StreamSource>[];
    if (_selected + 1 < sources.length) {
      setState(() => _selected += 1);
    } else if (mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(
            content: Text('That was the last server — try again later')));
    }
  }

  Widget _topBar() {
    final sources = _payload?.sources ?? const <StreamSource>[];
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.black.withValues(alpha: 0.7), Colors.transparent],
          ),
        ),
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
              onPressed: () => Navigator.of(context).maybePop(),
            ),
            Expanded(
              child: Text(
                _episodeLabel(),
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (sources.length > 1)
              IconButton(
                icon: const Icon(Icons.published_with_changes_rounded,
                    color: Colors.white),
                tooltip: 'Not loading? Try next server',
                onPressed: _tryNextServer,
              ),
            if (_isSeries)
              IconButton(
                icon: const Icon(Icons.video_library_rounded,
                    color: Colors.white),
                tooltip: 'Episodes & seasons',
                onPressed: _openEpisodes,
              ),
            if (sources.length > 1) _serverMenu(sources),
          ],
        ),
      ),
    );
  }

  String _episodeLabel() {
    if (_episode != null) {
      final s = _season != null ? 'S$_season ' : '';
      return '${widget.title}  •  $s' 'E$_episode';
    }
    return widget.title;
  }

  Widget _serverMenu(List<StreamSource> sources) {
    return PopupMenuButton<int>(
      color: AppColors.bgElevated,
      icon: const Icon(Icons.dns_rounded, color: Colors.white),
      tooltip: 'Servers',
      initialValue: _selected,
      // Changing _selected swaps the WebView's ValueKey, which rebuilds it with
      // the new embed's iframe wrapper.
      onSelected: (i) => setState(() => _selected = i),
      itemBuilder: (_) => [
        for (int i = 0; i < sources.length; i++)
          PopupMenuItem<int>(
            value: i,
            child: Row(
              children: [
                Icon(
                  sources[i].isEmbed
                      ? Icons.public_rounded
                      : Icons.high_quality_rounded,
                  size: 16,
                  color: i == _selected
                      ? AppColors.accent
                      : AppColors.textSecondary,
                ),
                const SizedBox(width: 8),
                Text(
                  _sourceLabel(sources[i]),
                  style: TextStyle(
                    color: i == _selected
                        ? AppColors.accent
                        : AppColors.textPrimary,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  String _sourceLabel(StreamSource s) {
    final parts = <String>[
      if (s.server.isNotEmpty) s.server else 'Server',
      if (s.category != null) s.category!.toUpperCase(),
      if (s.quality.isNotEmpty) s.quality,
    ];
    return parts.join(' · ');
  }

  Widget _message(
      {required IconData icon, required String text, String? detail}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: AppColors.textMuted, size: 48),
            const SizedBox(height: 12),
            Text(text,
                style: const TextStyle(
                    color: AppColors.textPrimary, fontSize: 15)),
            if (detail != null) ...[
              const SizedBox(height: 6),
              Text(detail,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: AppColors.textMuted, fontSize: 12)),
            ],
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: () => Navigator.of(context).maybePop(),
              child: const Text('Go back'),
            ),
          ],
        ),
      ),
    );
  }
}
