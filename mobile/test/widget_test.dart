// Smoke test: the app builds and mounts its shell without throwing.
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/main.dart';
import 'package:mobile/features/shell/main_shell.dart';

void main() {
  testWidgets('App boots into the navigation shell', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: PureVerseApp()));
    // Single frame only — Home fires network providers we don't await here.
    await tester.pump();

    expect(find.byType(PureVerseApp), findsOneWidget);
    expect(find.byType(MainShell), findsOneWidget);
  });
}
