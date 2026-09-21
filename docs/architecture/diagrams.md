# 系统架构图与业务流程图

状态：**Implemented**（与代码同步维护）

> 本文档集中存放可视化图表。GitHub / 支持 Mermaid 的 Markdown 查看器可直接渲染。

## 1. 系统部署架构

```mermaid
flowchart TB
    subgraph 用户侧
        U1[管理员浏览器]
        U2[闲鱼客户咨询时的你]
    end

    subgraph 服务器["腾讯云轻量 124.220.169.36（Ubuntu 24.04）"]
        subgraph Nginx["nginx 1.24（80/443）"]
            NG1["静态托管 web/dist<br/>SPA history 回退"]
            NG2["/api/* 反向代理<br/>→ 127.0.0.1:3000"]
        end
        subgraph Systemd["systemd: hotel-api.service"]
            API["Node.js 22 + Express 4<br/>JWT 鉴权 / 业务规则 / 幂等迁移链"]
        end
        DB[("MySQL 8<br/>库 hhao1121 · utf8mb4<br/>12 张表")]
        CERT["certbot<br/>Let's Encrypt 3 域名证书<br/>自动续期 · HTTP→HTTPS 301"]
    end

    U1 -->|"https://hhao1121.cn"| NG1
    U1 -->|"/api 请求"| NG2
    NG2 --> API
    API -->|"mysql2 连接池<br/>127.0.0.1:3306"| DB
    CERT -.-> NG1
```

- 443/80 防火墙已放行；3306 不对公网开放（开发走 SSH 隧道 13306）
- 域名：`hhao1121.cn` / `www.hhao1121.cn` / `order9d.hhao1121.cn`（DNSPod A 记录）

## 2. 数据模型 ER 图

```mermaid
erDiagram
    users {
        int id PK
        varchar username UK
        varchar password_hash
    }

    hotels {
        int id PK
        varchar name
        varchar city
        tinyint checkin_presence "NULL未确认/1需到场/0无需"
        varchar checkin_info_required
        varchar checkin_process
        varchar official_phone
        text guide_text "入住指南·可复制"
    }

    room_types {
        int id PK
        int hotel_id FK
        varchar name
        decimal default_price "参考价"
    }

    customers {
        int id PK
        varchar name
        tinyint is_hotel "酒店客户标签"
        tinyint is_golf "高尔夫客户标签"
    }

    benefit_holders {
        int id PK
        varchar name
        varchar card_type "卡片类型"
        enum source_channel "xianyu/wechat/other"
        int hotel_benefit_count "酒店权益剩余"
        tinyint hotel_refresh_month "更新月1-12"
        enum availability "any/weekend_only/weekday_only"
        tinyint willing_present "愿意到场"
        tinyint willing_assist "愿意协助"
        tinyint active "合作中"
    }

    bookings {
        int id PK
        int customer_id FK "住店客户"
        int hotel_id FK
        int benefit_holder_id FK "用谁的权益·可空"
        enum status "10态流程"
        tinyint benefit_used "是否用升级权益"
        int benefit_count_used "用几张券"
        tinyint breakfast_included "含双早"
        tinyint holder_settled "已给权益人结算"
        decimal sale_total "服务端自动算"
        decimal cost_total
    }

    booking_items {
        int id PK
        int booking_id FK "每行=一间房"
        int room_type_id FK
        decimal price "该间全程总价·每间可不同"
    }

    golf_benefit_types {
        int id PK
        varchar name UK "金葵花/经典白/中信…"
        varchar course_scope "all 或球场名列表"
    }

    holder_golf_benefits {
        int id PK
        int holder_id FK
        int benefit_type_id FK
        int count_left "该种类剩余次数"
        tinyint refresh_month
    }

    golf_orders {
        int id PK
        int customer_id FK "买家"
        int benefit_holder_id FK "定位人·可空"
        int benefit_type_id FK "消耗的权益种类"
        varchar course_name
        enum status "pending/booked/completed/cancelled"
        tinyint teach_needed "需教定位"
        enum channel "xianyu/wechat"
    }

    hotels ||--o{ room_types : "房型"
    hotels ||--o{ bookings : "被预定"
    room_types ||--o{ booking_items : "被引用"
    customers ||--o{ bookings : "住店"
    benefit_holders ||--o{ bookings : "出酒店权益·结算对象"
    bookings ||--|{ booking_items : "明细·级联删"
    benefit_holders ||--o{ holder_golf_benefits : "持有明细·级联删"
    golf_benefit_types ||--o{ holder_golf_benefits : "种类·删除保护"
    customers ||--o{ golf_orders : "买球局"
    benefit_holders ||--o{ golf_orders : "出高尔夫权益"
    golf_benefit_types ||--o{ golf_orders : "消耗种类"
```

## 3. 酒店预订业务流程（10 态状态机）

```mermaid
stateDiagram-v2
    [*] --> communicating : 闲鱼客户咨询
    communicating --> ordered : 闲鱼付款
    ordered --> info_confirmed : 确认酒店信息<br/>（日期/房型/几间几晚/是否升级/含双早）
    info_confirmed --> booking : 开始找权益人
    booking --> booked : 权益人已预订·已付款
    booked --> hotel_confirmed : 权益平台发单<br/>酒店确认订单
    hotel_confirmed --> awaiting_checkin : 到入住日之前
    awaiting_checkin --> checked_in : 客户拿到房间
    checked_in --> finished : 入住完成<br/>提醒客户确认收货

    communicating --> cancelled : 取消
    ordered --> cancelled : 取消
    info_confirmed --> cancelled : 取消
    booking --> cancelled : 取消
    booked --> cancelled : 取消
    hotel_confirmed --> cancelled : 取消
    awaiting_checkin --> cancelled : 取消
    finished --> [*]

    note right of booked
        勾「使用升级权益」填张数
        从预订人酒店权益扣 N 张
        取消时全额返还
    end note
```

## 4. 酒店业务全流程（含结算分支）

```mermaid
flowchart TB
    A[闲鱼客户咨询] --> B[沟通中·建单记录]
    B --> C[客户闲鱼付款]
    C --> D[确认酒店信息<br/>入住日期/房型/几间几晚<br/>是否升级/是否含双早]
    D --> E{需要几个权益人?}
    E -->|1间通常1人| F[选预订人·勾权益填张数]
    E -->|2间或券不够| G[复制预定·拆多笔<br/>每笔挂一个预订人]
    G --> F
    F --> H[权益人下单付款·已预订]
    H --> I[酒店订单确认<br/>权益平台发单成功]
    I --> J{预订人来源渠道}
    J -->|微信好友| K[酒店确认后微信转账<br/>勾「已结算」]
    J -->|闲鱼渠道| L[等客户入住完成<br/>去闲鱼确认收货结账]
    I --> M[待入住 → 客户入住成功 → 入住完成]
    M --> N[提醒客户闲鱼确认收货]
    L --> O[勾「已结算」]
    N --> P[订单闭环]
    K --> P
    O --> P

    style G fill:#fff3cd
    style K fill:#d1ecf1
    style L fill:#d1ecf1
```

## 5. 高尔夫业务全流程

```mermaid
flowchart TB
    A[闲鱼挂单出售高尔夫权益] --> B[客户咨询问价]
    B --> C[闲鱼沟通成功·付款]
    C --> D[客户加微信]
    D --> E[在微信找有权益的预订人]
    E --> F{权益适用球场匹配}
    F -->|金葵花→金桥 ✓<br/>经典白/中信→东镇+金桥 ✓| G[预订人定位 tee time]
    F -->|金葵花→东镇 ✗ 400拦截| H[换种类或换人]
    H --> E
    G --> I{预订人会定位吗}
    I -->|不会| J[教他定位·勾「需教定位」]
    I -->|会| K[已定位]
    J --> K
    K --> L[打球日期到·客户下场]
    L --> M[已完成]
    M --> N[结算成本给权益人]

    style F fill:#fff3cd
    style J fill:#fff3cd
```

## 6. 权益账本规则（酒店 & 高尔夫统一语义）

```mermaid
flowchart LR
    subgraph 占用判定
        A[benefit_used = 1] --> B{status ≠ cancelled?}
        B -->|是| C[占用生效]
        B -->|否| D[不占用]
    end

    C --> E["酒店线：扣预订人 hotel_benefit_count × 张数<br/>高尔夫线：扣 holder_golf_benefits 对应种类行 × 1"]

    subgraph 调整场景
        F[新建] --> G[扣]
        H[编辑·同人同种类] --> I[按张数差额多退少补]
        J[编辑·换人/换种类] --> K[旧目标返还·新目标扣减]
        L[取消 / 删除] --> M[全额返还]
        N[余额不足] --> O[400 拦截·事务回滚不留脏数据]
    end

    E -.-> G
    E -.-> I
    E -.-> K
    E -.-> M
    E -.-> O
```

## 7. 角色与数据流总览

```mermaid
flowchart LR
    subgraph 资源侧
        H1[预订人A<br/>经典白·酒店6张·高尔夫12次]
        H2[预订人B<br/>金葵花·仅金桥·仅周末]
    end
    subgraph 需求侧
        C1[酒店客户<br/>闲鱼买家·双早要求]
        C2[高尔夫客户<br/>闲鱼买家·周末打球]
    end
    subgraph 平台["酒店预订管理系统"]
        B1[酒店预定单<br/>10态流程·权益张数·结算]
        B2[高尔夫订单<br/>球场×种类校验·教定位]
        S[统计仪表盘<br/>双线收入/成本/利润]
    end

    C1 --> B1
    C2 --> B2
    H1 -->|酒店权益/高尔夫权益| B1 & B2
    H2 -->|金葵花·仅金桥| B2
    B1 --> S
    B2 --> S
```
