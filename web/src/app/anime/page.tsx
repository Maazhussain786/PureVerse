import React from "react";
import CategoryBrowser from "../components/CategoryBrowser";

export const metadata = {
  title: "Anime — PureVerse",
  description:
    "Browse trending and all-time popular anime by genre on PureVerse — action, comedy, sci-fi & fantasy, mystery and more.",
};

export default function AnimePage() {
  return <CategoryBrowser category="anime" />;
}
