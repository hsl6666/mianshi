import { useEffect } from "react";
import { Button, Checkbox, Empty, Form, Input, Modal, Select, Spin, Switch, Tag } from "antd";
import PositionSelect from "../../components/PositionSelect";
import { questionTypeOptions } from "../constants";
import { defaultQuestionForm, questionToFormValues, type QuestionFormValues } from "../utils";
import type { Question, WrittenQuestion } from "../../types";

function parseRoleTags(value?: string) {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

export function GeneratingQuestionModal({ open }: { open: boolean }) {
  return (
    <Modal open={open} footer={null} closable={false} centered destroyOnHidden>
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Spin size="large" />
        <div className="mt-4 text-base font-semibold text-stone-950">题目生成中</div>
        <p className="mt-2 text-sm text-stone-500">正在调用已配置模型生成候选题，请稍候。</p>
      </div>
    </Modal>
  );
}

export function GeneratedQuestionModal({
  open,
  questions,
  selectedIds,
  saving,
  onSelectedChange,
  onCancel,
  onAddDraft,
  onAddPublished,
}: {
  open: boolean;
  questions: Question[];
  selectedIds: string[];
  saving: boolean;
  onSelectedChange: (ids: string[]) => void;
  onCancel: () => void;
  onAddDraft: () => void;
  onAddPublished: () => void;
}) {
  const allSelected = questions.length > 0 && selectedIds.length === questions.length;
  const indeterminate = selectedIds.length > 0 && selectedIds.length < questions.length;

  function toggleQuestion(questionId: string, checked: boolean) {
    if (checked) onSelectedChange([...new Set([...selectedIds, questionId])]);
    else onSelectedChange(selectedIds.filter((id) => id !== questionId));
  }

  return (
    <Modal
      title="选择候选题入库"
      open={open}
      width={920}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="draft" loading={saving} disabled={!selectedIds.length} onClick={onAddDraft}>
          加入草稿
        </Button>,
        <Button key="publish" type="primary" loading={saving} disabled={!selectedIds.length} onClick={onAddPublished}>
          加入并发布
        </Button>,
      ]}
      destroyOnHidden
    >
      <div className="mb-4 flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <Checkbox
          checked={allSelected}
          indeterminate={indeterminate}
          onChange={(event) => onSelectedChange(event.target.checked ? questions.map((item) => item.id) : [])}
        >
          全选候选题
        </Checkbox>
        <Tag color={selectedIds.length ? "green" : "default"}>
          已选择 {selectedIds.length}/{questions.length}
        </Tag>
      </div>

      <div className="max-h-[62vh] space-y-3 overflow-y-auto pr-2">
        {questions.length ? (
          questions.map((question, index) => {
            const checked = selectedIds.includes(question.id);
            return (
              <label
                key={question.id}
                className={`block cursor-pointer rounded-lg border p-4 transition ${
                  checked ? "border-emerald-700 bg-emerald-50" : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox checked={checked} onChange={(event) => toggleQuestion(question.id, event.target.checked)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag>{index + 1}</Tag>
                      <Tag color="blue">{question.type}</Tag>
                      <h3 className="text-base font-semibold text-stone-950">{question.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-stone-700">{question.prompt}</p>
                    {question.options?.length ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {question.options.map((option) => (
                          <div key={option.value} className="rounded-md border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600">
                            {option.label}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {question.type === "code" && question.starter_code ? (
                      <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-stone-950 p-3 text-xs leading-5 text-stone-100">
                        {question.starter_code}
                      </pre>
                    ) : null}
                  </div>
                </div>
              </label>
            );
          })
        ) : (
          <Empty description="暂无生成结果" />
        )}
      </div>
    </Modal>
  );
}

export function QuestionEditorModal({
  open,
  editing,
  form,
  saving,
  onCancel,
  onSave,
}: {
  open: boolean;
  editing: WrittenQuestion | null;
  form: ReturnType<typeof Form.useForm<QuestionFormValues>>[0];
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  function fillForm() {
    form.resetFields();
    form.setFieldsValue(editing ? questionToFormValues(editing) : defaultQuestionForm());
  }

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(fillForm, 0);
    return () => window.clearTimeout(timer);
  }, [editing, form, open]);

  const type = Form.useWatch("type", form) || form.getFieldValue("type") || editing?.type || "short";
  return (
    <Modal
      title={editing ? "编辑题目" : "新建题目"}
      open={open}
      width={780}
      onCancel={onCancel}
      onOk={onSave}
      confirmLoading={saving}
      destroyOnHidden
      forceRender
      afterOpenChange={(visible) => {
        if (visible) fillForm();
      }}
    >
      <Form form={form} layout="vertical">
        <div className="grid gap-3 md:grid-cols-2">
          <Form.Item label="题目标题" name="title" rules={[{ required: true, message: "请输入题目标题" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="题型" name="type" rules={[{ required: true }]}>
            <Select options={questionTypeOptions} />
          </Form.Item>
        </div>
        <Form.Item label="题干" name="prompt" rules={[{ required: true, message: "请输入题干" }]}>
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item label="考察点（仅后台可见）" name="evaluation_points">
          <Input.TextArea rows={4} placeholder="例如：是否真正用过 Git 协作，是否理解提交历史管理。" />
        </Form.Item>
        {type === "single" || type === "multi" ? (
          <Form.List name="options">
            {(fields, { add, remove }) => (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-700">选项</span>
                  <Button size="small" onClick={() => add({ label: "", value: "" })}>
                    添加选项
                  </Button>
                </div>
                <div className="space-y-2">
                  {fields.map((field) => (
                    <div key={field.key} className="grid grid-cols-[1fr_160px_auto] gap-2">
                      <Form.Item {...field} name={[field.name, "label"]} noStyle rules={[{ required: true, message: "选项文案必填" }]}>
                        <Input placeholder="选项文案" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, "value"]} noStyle rules={[{ required: true, message: "选项值必填" }]}>
                        <Input placeholder="选项值" />
                      </Form.Item>
                      <Button danger onClick={() => remove(field.name)}>
                        删除
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Form.List>
        ) : null}
        {type === "code" ? (
          <>
            <Form.Item label="语言" name="language">
              <Input placeholder="typescript" />
            </Form.Item>
            <Form.Item label="初始代码" name="starter_code">
              <Input.TextArea rows={8} />
            </Form.Item>
          </>
        ) : null}
        <div className="grid gap-3 md:grid-cols-3">
          <Form.Item
            label="适用岗位"
            name="role_tags"
            getValueProps={(value) => ({ value: parseRoleTags(value) })}
            getValueFromEvent={(value: string | string[]) => {
              const list = Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
              return list.length ? list.join(",") : "通用";
            }}
          >
            <PositionSelect mode="multiple" placeholder="选择适用岗位，可多选" maxTagCount="responsive" />
          </Form.Item>
          <Form.Item label="难度" name="difficulty">
            <Select
              options={[
                { label: "初级", value: "easy" },
                { label: "中级", value: "medium" },
                { label: "高级", value: "hard" },
              ]}
            />
          </Form.Item>
          <Form.Item label="发布状态" name="published" valuePropName="checked">
            <Switch />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
