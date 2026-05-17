"""飞书 Webhook 推送 + 邮件发送工具"""
import json
import re
import urllib.request
from datetime import datetime
from agents import function_tool
from core.config import settings

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


@function_tool
def send_feishu_notification(
    title: str,
    content: str,
    chart_configs_json: str = "",
    table_configs_json: str = "",
) -> str:
    """推送分析结果到飞书群。通过 Webhook 发送交互式卡片，支持 Markdown 文本、图表和表格。
    chart_configs_json: 图表配置 JSON 数组字符串，格式 [{"chart_type":"bar","title":"xxx","data":[...]}]
    table_configs_json: 表格配置 JSON 数组字符串，格式 [{"title":"xxx","data":[[col1,col2],[val1,val2]]}]"""
    webhook_url = settings.FEISHU_WEBHOOK_URL
    if not webhook_url:
        return "错误: 未配置飞书 Webhook 地码。请在 .env 中设置 FEISHU_WEBHOOK_URL。"

    elements = []

    # Markdown 内容
    if content:
        elements.append({"tag": "markdown", "content": content})

    # 图表卡片
    if chart_configs_json:
        try:
            charts = json.loads(chart_configs_json)
            for chart in charts:
                elements.append({"tag": "hr"})
                elements.append({
                    "tag": "markdown",
                    "content": f"**{chart.get('title', '图表')}**"
                })
                # 使用 VChart 组件嵌入图表
                elements.append({
                    "tag": "chart",
                    "chart_spec": chart.get("spec", chart),
                    "aspect_ratio": "16:9",
                })
        except json.JSONDecodeError:
            elements.append({"tag": "markdown", "content": "*图表配置解析失败*"})

    # 表格
    if table_configs_json:
        try:
            tables = json.loads(table_configs_json)
            for table in tables:
                elements.append({"tag": "hr"})
                elements.append({
                    "tag": "markdown",
                    "content": f"**{table.get('title', '数据表')}**"
                })
                if "data" in table and table["data"]:
                    header = " | ".join(str(c) for c in table["data"][0])
                    separator = " | ".join("---" for _ in table["data"][0])
                    rows = "\n".join(" | ".join(str(c) for c in row) for row in table["data"][1:])
                    elements.append({"tag": "markdown", "content": f"{header}\n{separator}\n{rows}"})
        except json.JSONDecodeError:
            elements.append({"tag": "markdown", "content": "*表格配置解析失败*"})

    # 底部时间戳
    elements.append({"tag": "hr"})
    elements.append({
        "tag": "note",
        "elements": [{"tag": "plain_text", "content": f"由数据分析 Agent 自动生成 | {datetime.now().strftime('%Y-%m-%d %H:%M')}"}]
    })

    card = {
        "msg_type": "interactive",
        "card": {
            "schema": "2.0",
            "header": {
                "title": {"tag": "plain_text", "content": title},
                "template": "blue",
            },
            "body": {"elements": elements},
        },
    }

    try:
        data = json.dumps(card, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(webhook_url, data=data)
        req.add_header("Content-Type", "application/json; charset=utf-8")
        with urllib.request.urlopen(req, timeout=15) as response:
            result = json.loads(response.read().decode("utf-8"))
        if result.get("code") == 0 or result.get("StatusCode") == 0:
            return f"已成功推送到飞书群: {title}"
        return f"飞书推送失败: {result}"
    except Exception as e:
        return f"飞书推送异常: {e}"


@function_tool
def send_email_notification(
    to_address: str, subject: str, body: str,
) -> str:
    """通过 SMTP 发送邮件通知。用于发送分析报告给指定收件人。"""
    import smtplib
    from email.mime.text import MIMEText

    if not settings.SMTP_SERVER or not settings.SMTP_USERNAME:
        return "错误: 未配置 SMTP。请在 .env 中设置 SMTP_SERVER / SMTP_USERNAME / SMTP_PASSWORD。"

    # Validate email address
    if not _EMAIL_RE.match(to_address.strip()):
        return f"错误: 无效的邮箱地址 '{to_address}'。"

    # Validate subject (no newlines)
    if "\n" in subject or "\r" in subject:
        return "错误: 邮件主题不能包含换行符。"

    msg = MIMEText(body, "html", "utf-8")
    msg["From"] = settings.SMTP_USERNAME
    msg["To"] = to_address.strip()
    msg["Subject"] = subject

    try:
        with smtplib.SMTP_SSL(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=15) as server:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)
        return f"邮件已成功发送至 {to_address}"
    except Exception as e:
        return f"邮件发送失败: {e}"
