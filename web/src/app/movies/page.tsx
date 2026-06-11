import React from "react";
import CategoryBrowser from "../components/CategoryBrowser";

export const metadata = {
  title: "Movies — PureVerse",
  description:
    "Browse trending, top rated and new release movies by genre on PureVerse — action, comedy, sci-fi, horror and more.",
};

export default function MoviesPage() {
  return <CategoryBrowser category="movies" />;
}
