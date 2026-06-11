import React from "react";
import CategoryBrowser from "../components/CategoryBrowser";

export const metadata = {
  title: "TV Series — PureVerse",
  description:
    "Browse trending and top rated TV series by genre on PureVerse — drama, crime, sci-fi & fantasy, comedy and more.",
};

export default function SeriesPage() {
  return <CategoryBrowser category="series" />;
}
