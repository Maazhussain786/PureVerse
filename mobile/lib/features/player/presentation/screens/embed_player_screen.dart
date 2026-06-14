import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/models/stream_source.dart';
import '../../../../shared/providers/api_providers.dart';

/// Hybrid playback: loads the provider's embed page in a hardened WebView
/// (popups + cross-host top-frame redirects blocked) inside our own fullscreen
/// landscape chrome. The native custom player is a later phase.
class EmbedPlayerScreen extends ConsumerStatefulWidget {
  final String mediaType; // movie | tv | anime
  final String mediaId;
  final String title;
  final int? season;
  final int? episode;

  const EmbedPlayerScreen({
    super.key,
    required this.mediaType,
    required this.mediaId,
    required this.title,
    this.season,
    this.episode,
  });

  @override
  ConsumerState<EmbedPlayerScreen> createState() => _EmbedPlayerScreenState();
}

class _EmbedPlayerScreenState extends ConsumerState<EmbedPlayerScreen> {
  StreamPayload? _payload;
  Object? _error;
  int _selected = 0;
  InAppWebViewController? _webController;

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
            season: widget.season,
            episode: widget.episode,
          );
      if (!mounted) return;
      setState(() {
        _payload = payload;
        // Prefer an embed source (hybrid phase plays embeds, not direct yet).
        final i = payload.sources.indexWhere((s) => s.isEmbed);
        _selected = i >= 0 ? i : 0;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
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
      initialUrlRequest: URLRequest(url: WebUri(url)),
      initialSettings: InAppWebViewSettings(
        mediaPlaybackRequiresUserGesture: false,
        allowsInlineMediaPlayback: true,
        javaScriptCanOpenWindowsAutomatically: false,
        supportMultipleWindows: false,
        useShouldOverrideUrlLoading: true,
        transparentBackground: true,
        iframeAllowFullscreen: true,
      ),
      onWebViewCreated: (c) => _webController = c,
      // Block popups / popunders entirely.
      onCreateWindow: (controller, action) async => false,
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
            if (sources.length > 1) _serverMenu(sources),
          ],
        ),
      ),
    );
  }

  String _episodeLabel() {
    if (widget.episode != null) {
      final s = widget.season != null ? 'S${widget.season} ' : '';
      return '${widget.title}  •  ${s}E${widget.episode}';
    }
    return widget.title;
  }

  Widget _serverMenu(List<StreamSource> sources) {
    return PopupMenuButton<int>(
      color: AppColors.bgElevated,
      icon: const Icon(Icons.dns_rounded, color: Colors.white),
      tooltip: 'Servers',
      initialValue: _selected,
      onSelected: (i) {
        setState(() => _selected = i);
        final url = _currentUrl;
        if (url != null) {
          _webController?.loadUrl(urlRequest: URLRequest(url: WebUri(url)));
        }
      },
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
