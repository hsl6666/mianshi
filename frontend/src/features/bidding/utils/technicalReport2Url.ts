import { ROUTE_PATHS } from "@/constants/common";
import type { TechnicalReportPage2ViewModel } from "./technicalReportPage2Adapter";
import { defaultTechnicalReportPage2ViewModel } from "./technicalReportPage2Adapter";

const defaultProjectTitle = defaultTechnicalReportPage2ViewModel.projectInfo.title;

export interface TechnicalReport2UrlParams {
  versionId: number;
  projectName?: string;
  companyName?: string;
}

export interface TechnicalReport2UrlContext {
  projectName: string;
  companyName: string;
}

export function buildTechnicalReport2Url({
  versionId,
  projectName,
  companyName,
}: TechnicalReport2UrlParams): string {
  const search = new URLSearchParams();
  search.set("version_id", String(versionId));

  const normalizedProjectName = projectName?.trim();
  const normalizedCompanyName = companyName?.trim();

  if (normalizedProjectName) {
    search.set("project_name", normalizedProjectName);
  }
  if (normalizedCompanyName) {
    search.set("company_name", normalizedCompanyName);
  }

  return `${ROUTE_PATHS.technicalReport2}?${search.toString()}`;
}

export function parseTechnicalReport2UrlContext(
  searchParams: URLSearchParams,
): TechnicalReport2UrlContext {
  return {
    projectName: searchParams.get("project_name")?.trim() ?? "",
    companyName: searchParams.get("company_name")?.trim() ?? "",
  };
}

export function mergeUrlContextIntoViewModel(
  viewModel: TechnicalReportPage2ViewModel,
  urlContext: TechnicalReport2UrlContext,
): TechnicalReportPage2ViewModel {
  const { projectName, companyName } = urlContext;
  if (!projectName && !companyName) {
    return viewModel;
  }

  const nextProjectInfo = { ...viewModel.projectInfo };

  if (companyName && (!nextProjectInfo.userOrg || nextProjectInfo.userOrg === "需补充")) {
    nextProjectInfo.userOrg = companyName;
  }

  if (projectName) {
    const currentTitle = nextProjectInfo.title;
    if (!currentTitle || currentTitle === "需补充" || currentTitle === defaultProjectTitle) {
      nextProjectInfo.title = projectName;
    }
  }

  return {
    ...viewModel,
    projectInfo: nextProjectInfo,
  };
}
