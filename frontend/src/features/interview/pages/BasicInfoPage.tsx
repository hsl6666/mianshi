import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { Button, DatePicker, Input, Select, Space, Tag, Upload, message, type UploadProps } from "antd";
import { ArrowRightOutlined, FileTextOutlined, PrinterOutlined, ReloadOutlined, UploadOutlined } from "@ant-design/icons";
import {
  createOrUpdateSession,
  fetchSession,
  patchSession,
  resolveAssetUrl,
  uploadResumeAttachment,
} from "../api";
import { emptyProfile, getInterviewSessionId, loadProfile, saveProfile } from "../storage";
import type { CandidateProfile, EducationExperience, FamilyMember, InterviewSession, WorkExperience } from "../types";

type TextFieldKey = {
  [K in keyof CandidateProfile]: CandidateProfile[K] extends string ? K : never;
}[keyof CandidateProfile];

const textFieldKeys = Object.keys(emptyProfile).filter(
  (key) => typeof emptyProfile[key as keyof CandidateProfile] === "string",
) as TextFieldKey[];

const tableCellClass = "h-[42px] border border-[#555] p-0 align-middle";
const labelCellClass = `${tableCellClass} whitespace-nowrap bg-[#fbfbfb] text-center text-[15px] font-medium`;
const sectionTitleClass = "h-[34px] border border-[#555] bg-[#fafafa] text-center text-[17px] font-semibold tracking-[0.18em]";
const blankCellClass = "h-[38px] border border-[#555] p-0 align-middle";
const controlClass = "!h-full !w-full !rounded-none !border-0 !bg-transparent !px-2 !text-[15px] !shadow-none";
const pickerClass = `${controlClass} [&_.ant-picker-input>input]:!text-[15px]`;
const selectClass = `${controlClass} [&_.ant-select-selector]:!h-full [&_.ant-select-selector]:!bg-transparent [&_.ant-select-selection-item]:!leading-[40px]`;

export default function BasicInfoPage() {
  const navigate = useNavigate();
  const sessionId = useMemo(() => getInterviewSessionId(), []);
  const [profile, setProfile] = useState<CandidateProfile>(() => loadProfile(sessionId));
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [appliedParsedAt, setAppliedParsedAt] = useState("");
  const saveTimer = useRef<number>();
  const errors = validateProfile(profile);
  const parsedFields = session?.parsed_profile || {};
  const hasParsedFields = Object.values(parsedFields).some(Boolean) && appliedParsedAt !== session?.updated_at;

  useEffect(() => {
    createOrUpdateSession(sessionId, profile)
      .then(setSession)
      .catch(() => message.warning("后端暂未连接，本地表单仍会保存"));
  }, [profile, sessionId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchSession(sessionId)
        .then(setSession)
        .catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [sessionId]);

  function updateField(key: TextFieldKey, value: string) {
    const next = { ...profile, [key]: value };
    if (key === "role") next.role = value;
    if (key === "education_level") next.degree = value;
    setProfile(next);
    queueLocalSave(next);
  }

  function updateWorkExperience(index: number, key: keyof WorkExperience, value: string) {
    const rows = [...profile.work_experiences];
    rows[index] = { ...rows[index], [key]: value };
    const next = { ...profile, work_experiences: rows };
    setProfile(next);
    queueLocalSave(next);
  }

  function updateEducationExperience(index: number, key: keyof EducationExperience, value: string) {
    const rows = [...profile.education_experiences];
    rows[index] = { ...rows[index], [key]: value };
    const next = { ...profile, education_experiences: rows };
    setProfile(next);
    queueLocalSave(next);
  }

  function updateFamilyMember(index: number, key: keyof FamilyMember, value: string) {
    const rows = [...profile.family_members];
    rows[index] = { ...rows[index], [key]: value };
    const next = { ...profile, family_members: rows };
    setProfile(next);
    queueLocalSave(next);
  }

  function queueLocalSave(next: CandidateProfile) {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveProfile(sessionId, next), 350);
  }

  function applyParsedProfile() {
    const next = { ...profile };
    textFieldKeys.forEach((key) => {
      const value = parsedFields[key];
      if (!next[key] && value) {
        next[key] = String(value);
      }
    });
    setProfile(next);
    saveProfile(sessionId, next);
    setAppliedParsedAt(session?.updated_at || new Date().toISOString());
    message.success("已填入未手动填写的识别字段");
  }

  async function uploadResume(file: File) {
    setUploading(true);
    try {
      await createOrUpdateSession(sessionId, profile);
      const nextSession = await uploadResumeAttachment(sessionId, file);
      setSession(nextSession);
      message.success("简历上传成功，系统已开始识别并回填");
    } catch {
      message.error("简历上传失败，请确认后端服务可用");
    } finally {
      setUploading(false);
    }
  }

  const uploadProps: UploadProps = {
    accept: ".pdf,.txt,.doc,.docx,image/*",
    showUploadList: false,
    beforeUpload: (file) => {
      void uploadResume(file);
      return false;
    },
  };

  async function goNext() {
    if (Object.keys(errors).length > 0) {
      message.error("请先修正表单校验项");
      return;
    }
    setSaving(true);
    try {
      saveProfile(sessionId, profile);
      await patchSession(sessionId, profile);
      navigate("/interview/written");
    } catch {
      message.error("保存到后端失败，请确认后端已启动");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    const next = JSON.parse(JSON.stringify(emptyProfile)) as CandidateProfile;
    next.fill_date = dayjs().format("YYYY-MM-DD");
    setProfile(next);
    saveProfile(sessionId, next);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void goNext();
  }

  return (
    <main className="min-h-screen bg-[#f4f6f9] py-9 text-[#222]">
      <section className="mx-auto w-[min(960px,calc(100%-24px))] rounded-[14px] bg-white px-[38px] pb-[42px] pt-[34px] shadow-[0_18px_45px_rgba(15,23,42,0.08)] max-[760px]:my-[18px] max-[760px]:overflow-x-auto max-[760px]:px-[14px] max-[760px]:py-6">
        <h1 className="mb-[22px] mt-0 text-center text-[32px] font-medium tracking-[0.18em] max-[760px]:text-[26px]">
          面试登记表
        </h1>

        {hasParsedFields ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>识别到简历信息，可一键填入空白字段，不会覆盖已手动填写内容。</span>
              <Space>
                <Button onClick={() => setAppliedParsedAt(session?.updated_at || "")}>忽略</Button>
                <Button type="primary" onClick={applyParsedProfile}>
                  一键填入
                </Button>
              </Space>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="mb-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[15px] font-semibold text-slate-900">简历上传</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">支持 PDF、Word、图片和文本文件</p>
              </div>
              <Upload {...uploadProps}>
                <Button type="primary" icon={<UploadOutlined />} loading={uploading}>
                  上传简历
                </Button>
              </Upload>
            </div>
            {session?.attachments.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {session.attachments.map((item) => (
                  <a key={item.id} href={resolveAssetUrl(item.url)} target="_blank" rel="noreferrer">
                    <Tag icon={<FileTextOutlined />} color="green" className="m-0">
                      {item.filename}
                    </Tag>
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mb-[6px] grid grid-cols-[1fr_260px] gap-8 text-[15px] font-semibold max-[760px]:min-w-[820px]">
            <label className="grid grid-cols-[auto_1fr] items-center gap-2">
              <span>应聘职位：</span>
              <Input
                variant="borderless"
                value={profile.role}
                onChange={(event) => updateField("role", event.target.value)}
                className="!h-7 !rounded-none !border-0 !border-b !border-[#555] !bg-transparent !px-1"
              />
            </label>
            <label className="grid grid-cols-[auto_1fr] items-center gap-2">
              <span>填表日期：</span>
              <DatePicker
                variant="borderless"
                value={profile.fill_date ? dayjs(profile.fill_date) : null}
                onChange={(_, value) => updateField("fill_date", String(value || ""))}
                className="!h-7 !w-full !rounded-none !border-0 !border-b !border-[#555] !bg-transparent !px-1"
              />
            </label>
          </div>

          <table className="w-full table-fixed border-collapse border-2 border-[#444] bg-white max-[760px]:min-w-[820px]">
            <colgroup>
              <col className="w-[13%]" />
              <col className="w-[15%]" />
              <col className="w-[13%]" />
              <col className="w-[15%]" />
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[19%]" />
            </colgroup>
            <tbody>
              <tr>
                <th className={sectionTitleClass} colSpan={7}>
                  基本资料
                </th>
              </tr>
              <tr>
                <td className={labelCellClass}>姓名</td>
                <td className={tableCellClass}>{textInput("name")}</td>
                <td className={labelCellClass}>性别</td>
                <td className={tableCellClass}>{selectInput("gender", ["男", "女"])}</td>
                <td className={labelCellClass}>年龄</td>
                <td className={tableCellClass}>{textInput("age", "number")}</td>
                <td className={`${tableCellClass} bg-[#fcfcfc] text-center text-sm text-[#777]`} rowSpan={6}>
                  <div className="flex min-h-[168px] flex-col items-center justify-center gap-2">
                    <span>照片</span>
                    <span className="text-xs text-slate-400">口试摄像头抽帧自动留存</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td className={labelCellClass}>出生年月</td>
                <td className={tableCellClass}>{monthInput("birth_month")}</td>
                <td className={labelCellClass}>民族</td>
                <td className={tableCellClass}>{textInput("nation")}</td>
                <td className={labelCellClass}>籍贯</td>
                <td className={tableCellClass}>{textInput("native_place")}</td>
              </tr>
              <tr>
                <td className={labelCellClass}>身高</td>
                <td className={tableCellClass}>{textInput("height", "number", "cm")}</td>
                <td className={labelCellClass}>体重</td>
                <td className={tableCellClass}>{textInput("weight", "number", "kg")}</td>
                <td className={labelCellClass}>婚否</td>
                <td className={tableCellClass}>{selectInput("marital_status", ["未婚", "已婚", "离异", "丧偶"])}</td>
              </tr>
              <tr>
                <td className={labelCellClass}>政治面貌</td>
                <td className={tableCellClass}>{textInput("political_status")}</td>
                <td className={labelCellClass}>身份证号码</td>
                <td className={tableCellClass} colSpan={3}>
                  {textInput("id_number")}
                </td>
              </tr>
              <tr>
                <td className={labelCellClass}>文化程度</td>
                <td className={tableCellClass}>{selectInput("education_level", ["高中 / 中专", "大专", "本科", "硕士", "博士及以上"])}</td>
                <td className={labelCellClass}>联系方式</td>
                <td className={tableCellClass} colSpan={3}>
                  {textInput("phone", "tel")}
                </td>
              </tr>
              <tr>
                <td className={labelCellClass}>专业</td>
                <td className={tableCellClass}>{textInput("major")}</td>
                <td className={labelCellClass}>毕业学校</td>
                <td className={tableCellClass} colSpan={3}>
                  {textInput("school")}
                </td>
              </tr>
              <tr>
                <td className={labelCellClass}>户口所在地</td>
                <td className={tableCellClass}>{textInput("registered_address")}</td>
                <td className={labelCellClass}>联系地址</td>
                <td className={tableCellClass} colSpan={2}>
                  {textInput("current_address")}
                </td>
                <td className={labelCellClass}>期望薪资</td>
                <td className={tableCellClass}>{textInput("expected_salary")}</td>
              </tr>

              <tr>
                <th className={sectionTitleClass} colSpan={7}>
                  工作经历
                </th>
              </tr>
              <tr>
                <td className={labelCellClass}>起始时间</td>
                <td className={labelCellClass}>终止时间</td>
                <td className={labelCellClass} colSpan={2}>
                  工作单位
                </td>
                <td className={labelCellClass}>薪资</td>
                <td className={labelCellClass}>职位</td>
                <td className={labelCellClass}>离职原因</td>
              </tr>
              {profile.work_experiences.map((row, index) => (
                <tr className="h-[38px]" key={`work-${index}`}>
                  <td className={blankCellClass}>
                    {dateValue(row.start_date, (value) => updateWorkExperience(index, "start_date", value))}
                  </td>
                  <td className={blankCellClass}>
                    {dateValue(row.end_date, (value) => updateWorkExperience(index, "end_date", value))}
                  </td>
                  <td className={blankCellClass} colSpan={2}>
                    {plainValue(row.company, (value) => updateWorkExperience(index, "company", value))}
                  </td>
                  <td className={blankCellClass}>{plainValue(row.salary, (value) => updateWorkExperience(index, "salary", value))}</td>
                  <td className={blankCellClass}>{plainValue(row.position, (value) => updateWorkExperience(index, "position", value))}</td>
                  <td className={blankCellClass}>{plainValue(row.leave_reason, (value) => updateWorkExperience(index, "leave_reason", value))}</td>
                </tr>
              ))}

              <tr>
                <th className={sectionTitleClass} colSpan={7}>
                  教育背景
                </th>
              </tr>
              <tr>
                <td className={labelCellClass}>起始时间</td>
                <td className={labelCellClass}>终止时间</td>
                <td className={labelCellClass} colSpan={2}>
                  学院名称
                </td>
                <td className={labelCellClass}>专业</td>
                <td className={labelCellClass} colSpan={2}>
                  所获相关证书
                </td>
              </tr>
              {profile.education_experiences.map((row, index) => (
                <tr className="h-[38px]" key={`education-${index}`}>
                  <td className={blankCellClass}>
                    {dateValue(row.start_date, (value) => updateEducationExperience(index, "start_date", value))}
                  </td>
                  <td className={blankCellClass}>
                    {dateValue(row.end_date, (value) => updateEducationExperience(index, "end_date", value))}
                  </td>
                  <td className={blankCellClass} colSpan={2}>
                    {plainValue(row.college, (value) => updateEducationExperience(index, "college", value))}
                  </td>
                  <td className={blankCellClass}>{plainValue(row.major, (value) => updateEducationExperience(index, "major", value))}</td>
                  <td className={blankCellClass} colSpan={2}>
                    {plainValue(row.certificate, (value) => updateEducationExperience(index, "certificate", value))}
                  </td>
                </tr>
              ))}

              <tr>
                <th className={sectionTitleClass} colSpan={7}>
                  家庭成员
                </th>
              </tr>
              <tr>
                <td className={labelCellClass} colSpan={2}>
                  关系
                </td>
                <td className={labelCellClass} colSpan={3}>
                  工作单位
                </td>
                <td className={labelCellClass} colSpan={2}>
                  工作地址
                </td>
              </tr>
              {profile.family_members.map((row, index) => (
                <tr className="h-[38px]" key={`family-${index}`}>
                  <td className={blankCellClass} colSpan={2}>
                    {plainValue(row.relation, (value) => updateFamilyMember(index, "relation", value))}
                  </td>
                  <td className={blankCellClass} colSpan={3}>
                    {plainValue(row.company, (value) => updateFamilyMember(index, "company", value))}
                  </td>
                  <td className={blankCellClass} colSpan={2}>
                    {plainValue(row.address, (value) => updateFamilyMember(index, "address", value))}
                  </td>
                </tr>
              ))}

              <tr>
                <td className={`${labelCellClass} text-xl tracking-[0.2em]`} rowSpan={2}>
                  备注
                </td>
                <td className={labelCellClass}>紧急联系人</td>
                <td className={tableCellClass}>{textInput("emergency_contact")}</td>
                <td className={labelCellClass}>关系</td>
                <td className={tableCellClass}>{textInput("emergency_relation")}</td>
                <td className={labelCellClass}>联系方式</td>
                <td className={tableCellClass}>{textInput("emergency_phone", "tel")}</td>
              </tr>
              <tr>
                <td className="h-[126px] border border-[#555] p-0 align-top" colSpan={6}>
                  <Input.TextArea
                    variant="borderless"
                    value={profile.self_evaluation}
                    placeholder="个人评价："
                    onChange={(event) => updateField("self_evaluation", event.target.value)}
                    className="!min-h-[112px] !w-full !resize-y !rounded-none !border-0 !bg-transparent !px-2 !py-2 !leading-7 !shadow-none"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-6 flex justify-center gap-3">
            <Button htmlType="submit" type="primary" loading={saving} icon={<ArrowRightOutlined />} className="min-w-[108px] !rounded-full">
              提交登记
            </Button>
            <Button icon={<ReloadOutlined />} onClick={resetForm} className="min-w-[108px] !rounded-full">
              重置表单
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()} className="min-w-[108px] !rounded-full">
              打印表单
            </Button>
          </div>
        </form>
      </section>
    </main>
  );

  function textInput(field: TextFieldKey, type = "text", placeholder = "") {
    return (
      <Input
        variant="borderless"
        type={type}
        placeholder={placeholder}
        value={profile[field]}
        status={errors[field] ? "error" : undefined}
        onChange={(event) => updateField(field, event.target.value)}
        className={controlClass}
      />
    );
  }

  function selectInput(field: TextFieldKey, options: string[]) {
    return (
      <Select
        variant="borderless"
        allowClear
        value={profile[field] || undefined}
        options={options.map((item) => ({ label: item, value: item }))}
        onChange={(value) => updateField(field, value || "")}
        className={selectClass}
      />
    );
  }

  function monthInput(field: TextFieldKey) {
    return monthValue(profile[field], (value) => updateField(field, value));
  }

  function monthValue(value: string, onChange: (value: string) => void) {
    return (
      <DatePicker
        variant="borderless"
        picker="month"
        placeholder="请选择"
        value={value ? dayjs(value) : null}
        onChange={(_, dateString) => onChange(String(dateString || ""))}
        className={pickerClass}
      />
    );
  }

  function dateValue(value: string, onChange: (value: string) => void) {
    return (
      <DatePicker
        variant="borderless"
        placeholder="请选择"
        value={value ? dayjs(value) : null}
        onChange={(_, dateString) => onChange(String(dateString || ""))}
        className={pickerClass}
      />
    );
  }

  function plainValue(value: string, onChange: (value: string) => void) {
    return <Input variant="borderless" value={value} onChange={(event) => onChange(event.target.value)} className={controlClass} />;
  }
}

function validateProfile(profile: CandidateProfile) {
  const errors: Partial<Record<TextFieldKey, string>> = {};
  if (profile.id_number && !/(^\d{15}$)|(^\d{17}[\dXx]$)/.test(profile.id_number)) errors.id_number = "身份证号格式不正确";
  if (profile.phone && !/^1[3-9]\d{9}$/.test(profile.phone)) errors.phone = "手机号格式不正确";
  if (profile.emergency_phone && !/^1[3-9]\d{9}$/.test(profile.emergency_phone)) errors.emergency_phone = "手机号格式不正确";
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) errors.email = "邮箱格式不正确";
  return errors;
}
