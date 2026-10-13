# Creem 以已付款事件确认订阅权益

Creem 接入现有渠道适配层，作为当前唯一支付渠道提供购买入口。使用官方 `creem` SDK 创建和查询结账、订阅及交易，Webhook 在项目统一入口验证原始请求签名；不额外引入 Next.js 路由工厂，避免将页面参数作为身份或权益证据。

Creem 的 `subscription.paid` 经远端核实付款、用户、产品、客户和账期后，才能首次创建或续期订阅。`subscription.active`、`checkout.completed` 和浏览器返回不写付费权益。周期末取消映射为 CANCELLED，已付权益保留至周期结束；扣款失败映射为 PAYMENT_FAILED，保留已付账期且纳入 Creem 开放订阅约束。付款恢复必须核实交易，同一期恢复不重置额度；已取消或到期记录不会被迟到付款恢复。
