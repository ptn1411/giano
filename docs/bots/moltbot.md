---
title: MoltBot Integration
---

# MoltBot Integration

MoltBot là bot AI assistant tích hợp sẵn trong GIANO.

## Tính năng

- **AI Chat**: Trò chuyện với AI
- **Code Assistance**: Hỗ trợ lập trình
- **Task Delegation**: Giao việc cho IDE

## Cách sử dụng

Trong chat, mention `@moltbot` với yêu cầu:

````
@moltbot giải thích đoạn code này

```javascript
function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
}
```​
````

## Delegate to IDE

MoltBot có thể giao task cho IDE để thực thi code:

```
@moltbot refactor file utils.ts giúp tôi
```

MoltBot sẽ:

1. Phân tích yêu cầu
2. Gọi `delegate_to_ide` tool
3. IDE Agent nhận task và thực hiện
4. Báo cáo kết quả về chat

## Cấu hình

Xem [Cài đặt IDE](/guide/ide-setup) để setup MoltBot với IDE.
