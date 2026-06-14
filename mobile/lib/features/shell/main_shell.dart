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

class MainShell extends ConsumerWidget {
  const MainShell({super.key});

  static const _screens = [
    HomeScreen(),
    BrowseScreen(category: 'movies'),
    BrowseScreen(category: 'series'),
    BrowseScreen(category: 'anime'),
    SearchScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final index = ref.watch(shellTabProvider);

    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      body: IndexedStack(index: index, children: _screens),
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
