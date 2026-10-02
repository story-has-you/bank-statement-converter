import messages from "../messages/zh-CN.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: "zh-CN";
    Messages: typeof messages;
  }
}
