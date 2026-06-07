import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AniVerse')),
      body: RepaintBoundary(
        child: SizedBox(
          height: 250,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: 10,
            itemBuilder: (context, index) {
              return Padding(
                padding: const EdgeInsets.all(8.0),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: CachedNetworkImage(
                    imageUrl: "https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHcjOgEE2t2.jpg",
                    memCacheWidth: 300,
                    memCacheHeight: 450,
                    placeholder: (context, url) => Container(
                      width: 150,
                      height: 225,
                      color: Colors.grey.withOpacity(0.2),
                    ),
                    errorWidget: (context, url, error) => const Icon(Icons.error),
                    fit: BoxFit.cover,
                    width: 150,
                    height: 225,
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
