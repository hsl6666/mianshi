import { buildWangjunUrl, wangjunClient } from "@/request/wangjunClient";
import { formatChinaTimeForApi } from "@/utils/date";
import { isWangjunLoginEnabled, type WangjunLoginResponse } from "@/utils/wangjunAuth";
import {
  THIRD_PARTY_BIDDING_FIELDS,
  type ThirdPartyProjectCreateResponse,
  type ThirdPartySubmissionAnalyzeResponse,
} from "@/features/bidding/contracts/thirdPartyBidding";

const F = THIRD_PARTY_BIDDING_FIELDS;

export async function wangjunLogin(
  localUsername: string,
  password: string,
): Promise<WangjunLoginResponse | null> {
  if (!isWangjunLoginEnabled()) {
    return null;
  }

  try {
    const { data, status } = await wangjunClient.post<WangjunLoginResponse>(
      buildWangjunUrl("/api/v1/bidding/auth/local-login"),
      {
        local_username: localUsername,
        password,
      },
      { validateStatus: (code) => code < 500, timeout: 15_000 },
    );
    if (status === 200 && data?.tokens?.access_token) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/** 第三方上传招标文件：经 /wangjun 代理访问 POST /api/v1/bidding/projects */
export async function uploadThirdPartyProjectBidFile(args: {
  bidFile: File;
  projectName: string;
  bidOpeningTime: string;
  thirdPartyFileName?: string;
}): Promise<ThirdPartyProjectCreateResponse> {
  const formData = new FormData();
  formData.append(F.bid_file, args.bidFile);
  formData.append(F.project_id, String(Date.now()));
  formData.append(F.project_name, args.projectName.trim());
  formData.append(F.third_party_file_name, args.thirdPartyFileName?.trim() || args.bidFile.name);
  formData.append(F.bid_opening_time, formatChinaTimeForApi(args.bidOpeningTime));

  const { data } = await wangjunClient.post<ThirdPartyProjectCreateResponse>(
    buildWangjunUrl("/api/v1/bidding/projects"),
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

/** 第三方上传投标文件并发起分析：token 由 wangjunClient 填入 Authorization。 */
export async function analyzeThirdPartySubmissionFile(args: {
  projectId: string;
  companyName: string;
  responseFile: File;
  projectCode?: string | null;
  thirdPartyFileName?: string;
  thirdPartyCompanyName?: string;
}): Promise<ThirdPartySubmissionAnalyzeResponse> {
  const formData = new FormData();
  formData.append("project_id", args.projectId);
  formData.append("company_name", args.companyName.trim());
  formData.append("response_file", args.responseFile);
  formData.append("enable_analysis", "true");
  if (args.projectCode) formData.append(F.project_code, args.projectCode);
  formData.append(F.third_party_file_name, args.thirdPartyFileName?.trim() || args.responseFile.name);
  formData.append("third_party_company_name", args.thirdPartyCompanyName?.trim() || args.companyName.trim());

  const { data } = await wangjunClient.post<ThirdPartySubmissionAnalyzeResponse>(
    buildWangjunUrl("/api/v1/bidding/third-party/submission-files/analyze"),
    formData,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 300_000 },
  );
  return data;
}
