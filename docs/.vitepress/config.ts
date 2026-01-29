import { defineConfig } from "vitepress";

export default defineConfig({
  title: "GIANO Docs",
  description: "Documentation for GIANO - Real-time Chat Platform",
  lang: "vi-VN",

  head: [["link", { rel: "icon", href: "/favicon.ico" }]],

  themeConfig: {
    logo: "/logo.svg",

    nav: [
      { text: "Trang chủ", link: "/" },
      { text: "Hướng dẫn", link: "/guide/" },
      { text: "Tính năng", link: "/features/" },
      { text: "Bot SDK", link: "/bots/" },
      { text: "API", link: "/api/" },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Bắt đầu",
          items: [
            { text: "Giới thiệu", link: "/guide/" },
            { text: "Quick Start", link: "/guide/quick-start" },
            { text: "Cài đặt IDE", link: "/guide/ide-setup" },
          ],
        },
      ],
      "/features/": [
        {
          text: "Tính năng",
          items: [
            { text: "Tổng quan", link: "/features/" },
            { text: "Ghim Chat", link: "/features/pin-chat" },
            { text: "Ghi âm", link: "/features/voice-recording" },
            { text: "Refresh Token", link: "/features/refresh-token" },
            { text: "Quản lý thiết bị", link: "/features/device-management" },
          ],
        },
      ],
      "/bots/": [
        {
          text: "Bot Development",
          items: [
            { text: "Tổng quan SDK", link: "/bots/" },
            { text: "MoltBot Integration", link: "/bots/moltbot" },
            { text: "MCP Bridge", link: "/bots/mcp-bridge" },
          ],
        },
      ],
      "/api/": [
        {
          text: "Technical",
          items: [
            { text: "API Reference", link: "/api/" },
            { text: "QUIC Protocol", link: "/api/quic" },
            { text: "WebSocket", link: "/api/websocket" },
            { text: "Transport Manager", link: "/api/transport" },
          ],
        },
      ],
      "/security/": [
        {
          text: "Bảo mật",
          items: [
            { text: "Security Audit", link: "/security/" },
            { text: "Improvements", link: "/security/improvements" },
          ],
        },
      ],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/ptn1411/giano" }],

    footer: {
      message: "Made with ❤️ by GIANO Team",
      copyright: "Copyright © 2024 GIANO",
    },

    search: {
      provider: "local",
    },

    outline: {
      level: [2, 3],
      label: "Trên trang này",
    },

    docFooter: {
      prev: "Trang trước",
      next: "Trang sau",
    },

    lastUpdated: {
      text: "Cập nhật lần cuối",
    },
  },
});
