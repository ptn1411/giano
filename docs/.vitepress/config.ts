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
      { text: "QUIC", link: "/quic/" },
      { text: "API", link: "/api/" },
      { text: "Bảo mật", link: "/security/" },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Bắt đầu",
          items: [
            { text: "Giới thiệu", link: "/guide/" },
            { text: "Quick Start", link: "/guide/quick-start" },
            { text: "Cài đặt IDE", link: "/guide/ide-setup" },
            { text: "Refresh Token Guide", link: "/guide/REFRESH_TOKEN_GUIDE" },
            { text: "Test Refresh Token", link: "/guide/TEST_REFRESH_TOKEN" },
            {
              text: "Refresh Token Complete",
              link: "/guide/REFRESH_TOKEN_COMPLETE",
            },
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
            { text: "PIN Chat Feature", link: "/features/PIN_CHAT_FEATURE" },
            {
              text: "Voice Recording Upload",
              link: "/features/VOICE_RECORDING_UPLOAD_FEATURE",
            },
            {
              text: "Invite Link Fix",
              link: "/features/INVITE_LINK_DUPLICATE_KEY_FIX",
            },
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
            { text: "Giano Channel", link: "/bots/giano-channel" },
            { text: "MCP IDE Controller", link: "/bots/mcp-ide-controller" },
            { text: "Antigravity Adapter", link: "/bots/antigravity-adapter" },
          ],
        },
        {
          text: "Bot SDK",
          items: [
            { text: "SDK Readme", link: "/bots/sdk/readme" },
            { text: "SDK Setup", link: "/bots/sdk/setup" },
            { text: "SDK Examples", link: "/bots/sdk/examples" },
          ],
        },
      ],
      "/quic/": [
        {
          text: "QUIC Protocol",
          items: [
            { text: "API Documentation", link: "/quic/QUIC_API_DOCUMENTATION" },
            {
              text: "Checkpoint Verification",
              link: "/quic/QUIC_CHECKPOINT_VERIFICATION",
            },
            {
              text: "Troubleshooting",
              link: "/quic/QUIC_TROUBLESHOOTING_GUIDE",
            },
            { text: "Auth Integration", link: "/quic/AUTH_INTEGRATION" },
            { text: "Migration Support", link: "/quic/MIGRATION_SUPPORT" },
            {
              text: "Transport Implementation",
              link: "/quic/QUIC_TRANSPORT_IMPLEMENTATION",
            },
            {
              text: "Final Checkpoint",
              link: "/quic/QUIC_FINAL_CHECKPOINT_VERIFICATION",
            },
          ],
        },
      ],
      "/deployment/": [
        {
          text: "Triển khai",
          items: [
            { text: "Deploy Guide", link: "/deployment/DEPLOY" },
            {
              text: "QUIC Deployment",
              link: "/deployment/QUIC_DEPLOYMENT_GUIDE",
            },
          ],
        },
      ],
      "/integration/": [
        {
          text: "Tích hợp",
          items: [
            {
              text: "Implementation Complete",
              link: "/integration/IMPLEMENTATION_COMPLETE",
            },
            {
              text: "Integration Tests",
              link: "/integration/INTEGRATION_TESTS_COMPLETE",
            },
            {
              text: "Frontend Refresh Token",
              link: "/integration/FRONTEND_REFRESH_TOKEN_INTEGRATION",
            },
            {
              text: "Settings Store",
              link: "/integration/SETTINGS_STORE_INTEGRATION_COMPLETE",
            },
            {
              text: "Failure Detection",
              link: "/integration/FAILURE_DETECTION_IMPLEMENTATION",
            },
            {
              text: "Transport Manager",
              link: "/integration/TRANSPORT_MANAGER_IMPLEMENTATION",
            },
            {
              text: "WebSocket Transport",
              link: "/integration/WEBSOCKET_TRANSPORT_IMPLEMENTATION",
            },
            {
              text: "Metrics Implementation",
              link: "/integration/METRICS_IMPLEMENTATION",
            },
          ],
        },
      ],
      "/verification/": [
        {
          text: "Xác minh",
          items: [
            {
              text: "Device Management",
              link: "/verification/DEVICE_MANAGEMENT_VERIFICATION",
            },
            {
              text: "Frontend Checkpoint",
              link: "/verification/FRONTEND_CHECKPOINT_VERIFICATION",
            },
            {
              text: "Transport Manager",
              link: "/verification/transport-manager-verification",
            },
            {
              text: "Settings Store",
              link: "/verification/settingsStore.verification",
            },
            { text: "Test Settings", link: "/verification/test-settings" },
          ],
        },
      ],
      "/security/": [
        {
          text: "Bảo mật",
          items: [
            { text: "Security Audit", link: "/security/SECURITY_AUDIT" },
            {
              text: "Security Improvements",
              link: "/security/SECURITY_IMPROVEMENTS",
            },
          ],
        },
      ],
      "/powers/": [
        {
          text: "Powers",
          items: [
            { text: "Giano Bridge", link: "/powers/giano-bridge" },
            { text: "Workflow", link: "/powers/workflow" },
          ],
        },
      ],
      "/api/": [
        {
          text: "Technical",
          items: [{ text: "API Reference", link: "/api/" }],
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
