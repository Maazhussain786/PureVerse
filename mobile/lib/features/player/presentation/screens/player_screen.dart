import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';

class PlayerScreen extends StatefulWidget {
  final String streamUrl;
  
  const PlayerScreen({super.key, required this.streamUrl});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  late VideoPlayerController _videoPlayerController;
  ChewieController? _chewieController;

  @override
  void initState() {
    super.initState();
    _initializePlayer();
  }

  Future<void> _initializePlayer() async {
    // Lock to landscape & hide OS bars
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

    _videoPlayerController = VideoPlayerController.networkUrl(Uri.parse(widget.streamUrl));
    await _videoPlayerController.initialize();

    _chewieController = ChewieController(
      videoPlayerController: _videoPlayerController,
      autoPlay: true,
      looping: false,
      allowMuting: true,
      showControls: true,
      materialProgressColors: ChewieProgressColors(
        playedColor: const Color(0xFF7C4DFF), // Primary Accent
        handleColor: const Color(0xFF7C4DFF),
        backgroundColor: Colors.grey,
        bufferedColor: Colors.white,
      ),
    );

    setState(() {});

    // Periodic tracking
    _videoPlayerController.addListener(_trackingListener);
  }

  void _trackingListener() {
    final position = _videoPlayerController.value.position;
    if (position.inSeconds % 10 == 0 && _videoPlayerController.value.isPlaying) {
      // TODO: Write to Hive store
      // print('Tracked progress: ${position.inSeconds} seconds');
    }
  }

  @override
  void dispose() {
    _videoPlayerController.removeListener(_trackingListener);
    _videoPlayerController.dispose();
    _chewieController?.dispose();

    // Restore portrait mode and OS bars
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: _chewieController != null && _chewieController!.videoPlayerController.value.isInitialized
          ? Chewie(controller: _chewieController!)
          : const Center(
              child: CircularProgressIndicator(color: Color(0xFF7C4DFF)),
            ),
    );
  }
}
