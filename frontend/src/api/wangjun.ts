import { buildWangjunUrl, wangjunClient } from "@/request/wangjunClient";
import { formatChinaTimeForApi } from "@/utils/date";
import { isWangjunLoginEnabled, type WangjunLoginResponse } from "@/utils/wangjunAuth";
import {
  THIRD_PARTY_BIDDING_FIELDS,
  type ThirdPartyProjectCreateResponse,
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
