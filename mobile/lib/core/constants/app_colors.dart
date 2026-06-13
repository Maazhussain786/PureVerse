import 'package:flutter/material.dart';

/// Design tokens ported 1:1 from the web app's globals.css so the native app
/// matches the site exactly. Brand: PureVerse Emerald (primary) + Cyber Teal
/// (secondary). Keep these in sync with web/src/app/globals.css.
class AppColors {
  AppColors._();

  // ── Surfaces (layered dark backgrounds) ──
  static const Color bgPrimary = Color(0xFF09090C); // deepest midnight
  static const Color bgSecondary = Color(0xFF0F1014);
  static const Color bgCard = Color(0xFF13151A);
  static const Color bgElevated = Color(0xFF1A1C22);

  // ── Primary accent: PureVerse Emerald ──
  static const Color accent = Color(0xFF34D399);
  static const Color accentHover = Color(0xFF6EE7B7);
  static const Color accentGlow = Color(0x5934D399); // 35% emerald
  static const Color accentSubtle = Color(0x1A34D399); // 10% emerald

  // ── Secondary accent: Cyber Teal ──
  static const Color teal = Color(0xFF00F5D4);
  static const Color tealGlow = Color(0x5200F5D4); // 32% teal
  static const Color tealSubtle = Color(0x1A00F5D4); // 10% teal

  // ── Tertiary accent: High-energy Neon Lime ──
  static const Color lime = Color(0xFFA2FF00);

  // ── Text ──
  static const Color textPrimary = Color(0xFFE8EAF0);
  static const Color textSecondary = Color(0xFF7E8290);
  static const Color textMuted = Color(0xFF484B5C);

  // ── Glass / borders ──
  static const Color glassBackground = Color(0x0DFFFFFF); // white 5%
  static const Color glassBorder = Color(0x1AFFFFFF); // white 10%

  // ── Rating colors (match .rating-* in web) ──
  static const Color ratingHigh = Color(0xFFA2FF00);
  static const Color ratingMid = Color(0xFFFACC15);
  static const Color ratingLow = Color(0xFFF87171);

  // On-accent foreground (dark text used on emerald buttons in web: #04130d)
  static const Color onAccent = Color(0xFF04130D);
}

/// Corner radii ported from the web --radius-* scale.
class AppRadii {
  AppRadii._();
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double full = 9999;
}
