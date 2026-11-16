"use client";
import { ErrorState } from "../components/ui/Surface";
export default function ErrorPage({ reset }) {
  return <main data-as-ui="error" className="as-loading-page"><ErrorState title="This page could not be loaded" message="Your work has not been submitted again. Try loading this page once more." onRetry={reset} /></main>;
}
