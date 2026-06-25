import { Helmet } from "react-helmet-async";
import { useMatches } from "react-router-dom";
import { at } from "@/utils";

export function AppHelmet() {
  const matches = useMatches();
  const currRouter = at(matches, -1);
  const routeTitle = (currRouter?.handle as any)?.title || "React";
  const titleSuffix = import.meta.env.VITE_APP_TITLE_SUFFIX || "AI Interviewer";
  const pageTitle = `${routeTitle} | ${titleSuffix}`;
  
  return (
    <Helmet>
      <title>{pageTitle}</title>
    </Helmet>
  );
}
