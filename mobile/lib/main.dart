import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart';

import 'core/theme/app_theme.dart';
import 'features/shell/main_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Initialise libmpv so the native player can decode HLS + switch tracks.
  MediaKit.ensureInitialized();
  runApp(const ProviderScope(child: PureVerseApp()));
}

class PureVerseApp extends StatelessWidget {
  const PureVerseApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PureVerse',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: const MainShell(),
    );
  }
}
