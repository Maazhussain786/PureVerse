import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_colors.dart';
import '../home/presentation/screens/home_screen.dart';
import '../browse/presentation/screens/browse_screen.dart';
import '../search/presentation/screens/search_screen.dart';
import '../profile/presentation/screens/profile_screen.dart';

/// Currently selected bottom-nav tab. Exposed so other screens (e.g. Home's
/// search button) can switch tabs. Tabs match the web mobile tab bar:
/// 0 Home · 1 Movies · 2 Series · 3 Anime · 4 Search · 5 Profile.
final shellTabProvider = StateProvider<int>((ref) => 0);

class MainShell extends ConsumerStatefulWidget {
  const MainShell({super.key});

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  // Tabs are built lazily the first time they're opened, then kept alive.
  // This avoids eagerly constructing the 3 Browse screens (and firing all
  // their network/image loads) on first launch — the main startup-jank source.
  final Set<int> _built = {0};

  Widget _screen(int i) {
    switch (i) {
      case 1:
        return const BrowseScreen(category: 'movies');
      case 2:
        return const BrowseScreen(category: 'series');
      case 3:
        return const BrowseScreen(category: 'anime');
      case 4:
        return const SearchScreen();
      case 5:
        return const ProfileScreen();
      case 0:
      default:
        return const HomeScreen();
    }
  }

  @override
  Widget build(BuildContext context) {
    final index = ref.watch(shellTabProvider);
    _built.add(index); // mark current (covers taps and external switches)

    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      body: IndexedStack(
        index: index,
        children: List.generate(
          6,
          (i) => _built.contains(i)
              ? _screen(i)
              : const SizedBox.shrink(),
        ),
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.glassBorder)),
        ),
        child: BottomNavigationBar(
          currentIndex: index,
          onTap: (i) => ref.read(shellTabProvider.notifier).state = i,
          type: BottomNavigationBarType.fixed,
          backgroundColor: AppColors.bgPrimary,
          selectedItemColor: AppColors.accent,
          unselectedItemColor: AppColors.textSecondary,
          showUnselectedLabels: true,
          selectedFontSize: 11,
          unselectedFontSize: 11,
          items: const [
            BottomNavigationBarItem(
                icon: Icon(Icons.home_rounded), label: 'Home'),
            BottomNavigationBarItem(
                icon: Icon(Icons.movie_rounded), label: 'Movies'),
            BottomNavigationBarItem(
                icon: Icon(Icons.live_tv_rounded), label: 'Series'),
            BottomNavigationBarItem(
                icon: Icon(Icons.auto_awesome_rounded), label: 'Anime'),
            BottomNavigationBarItem(
                icon: Icon(Icons.search_rounded), label: 'Search'),
            BottomNavigationBarItem(
                icon: Icon(Icons.person_rounded), label: 'Profile'),
          ],
        ),
      ),
    );
  }
}
