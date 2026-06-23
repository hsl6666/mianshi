import { formatChinaTime } from "@/utils/date";
import { countVersionReportStats, type VersionReportStats } from "../constants";
import type {
  BidVersionListItem,
  BiddingCompanyListItem,
  BiddingProjectGroupTreeItem,
  BiddingProjectListItem,
} from "../types";

export interface HierarchyProjectItem {
  key: string;
  project: BiddingProjectListItem | null;
  dbId: number;
  projectName: string;
  bidOpeningAt: string;
  isPlaceholder: boolean;
  companies: BiddingCompanyListItem[];
}

export interface HierarchyDateNode {
  dateKey: string;
  bidOpeningAt: string;
  projects: HierarchyProjectItem[];
}

export function buildDateTree(groups: BiddingProjectGroupTreeItem[]): HierarchyDateNode[] {
  const map = new Map<string, HierarchyDateNode>();

  for (const group of groups) {
    const dateKey = formatChinaTime(group.bid_opening_time, "YYYY-MM-DD");
    let node = map.get(dateKey);
    if (!node) {
      node = {
        dateKey,
        bidOpeningAt: group.bid_opening_time,
        projects: [],
      };
      map.set(dateKey, node);
    }

    if (group.children.length === 0) {
      node.projects.push({
        key: `group-${group.db_id}`,
        project: null,
        dbId: group.db_id,
        projectName: group.project_name,
        bidOpeningAt: group.bid_opening_time,
        isPlaceholder: true,
        companies: [],
      });
      continue;
    }

    for (const project of group.children) {
      node.projects.push({
        key: `project-${project.id}`,
        project,
        dbId: group.db_id,
        projectName: group.project_name,
        bidOpeningAt: group.bid_opening_time,
        isPlaceholder: false,
        companies: project.children,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

export function countDateProjects(node: HierarchyDateNode) {
  return node.projects.length;
}

function collectVersionsFromCompanies(companies: BiddingCompanyListItem[]): BidVersionListItem[] {
  return companies.flatMap((company) => company.children);
}

export function countDateNodeVersionStats(node: HierarchyDateNode): VersionReportStats {
  const versions = node.projects.flatMap((project) => collectVersionsFromCompanies(project.companies));
  return countVersionReportStats(versions);
}

export function countProjectItemVersionStats(projectItem: HierarchyProjectItem): VersionReportStats {
  return countVersionReportStats(collectVersionsFromCompanies(projectItem.companies));
}
