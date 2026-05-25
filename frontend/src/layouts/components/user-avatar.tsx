import { Avatar, Dropdown, type MenuProps } from "antd";
import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/store/authStore";

export default function UserAvatar() {
  const username = useAuthStore((s) => s.username);
  const logout = useAuthStore((s) => s.logout);

  const items: MenuProps["items"] = [
    {
      key: "user",
      label: (
        <span className="text-gray-500">
          <UserOutlined className="mr-1" />
          {username || "用户"}
        </span>
      ),
      disabled: true,
    },
    { type: "divider" },
    {
      key: "logout",
      label: (
        <span>
          <LogoutOutlined className="mr-1" />
          退出登录
        </span>
      ),
      onClick: () => logout(),
    },
  ];

  return (
    <Dropdown menu={{ items }} trigger={["click"]}>
      <Avatar size={36} className="cursor-pointer bg-blue-500">
        {(username || "U").charAt(0).toUpperCase()}
      </Avatar>
    </Dropdown>
  );
}
