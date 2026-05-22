import { Helmet } from "react-helmet-async";
import { useMatches } from "react-router-dom";
import { at } from "@/utils";

const DEFAULT_SUFFIX = "招投标咨询系统";

export function AppHelmet() {
  const matches = useMatches();
  const currRouter = at(matches, -1);
  const pageTitle = (currRouter?.handle as { title?: string } | undefined)?.title || "首页";
  const suffix = import.meta.env.VITE_APP_TITLE_SUFFIX || DEFAULT_SUFFIX;
  const documentTitle = `${pageTitle} | ${suffix}`;

  return (
    <Helmet>
      <title>{documentTitle}</title>
    </Helmet>
  );
}
