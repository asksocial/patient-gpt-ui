import ThemeEvidencePage from "../../../components/ThemeEvidencePage";

export default async function Page({ searchParams }) {
  const params = await searchParams;
  const value = key => typeof params[key] === "string" ? params[key] : "";
  return <ThemeEvidencePage therapeuticArea={value("therapeuticArea")} question={value("question")} topicId={value("topicId")} theme={value("theme")} />;
}
