"""Deterministic user-intent routing for chat requests."""
from dataclasses import dataclass
from enum import Enum

from core.agent import DATA_ANALYST_NAME, GENERAL_ASSISTANT_NAME, REPORT_WRITER_NAME


class Intent(Enum):
    GENERAL = "general"
    DATA_ANALYSIS = "data_analysis"
    REPORTING = "reporting"
    AMBIGUOUS = "ambiguous"


@dataclass(frozen=True)
class RouteDecision:
    intent: Intent
    agent_name: str
    display_name: str


DATA_WORDS = ("数据", "表", "sql", "查询", "统计", "趋势", "图表", "可视化", "分析", "字段", "schema", "database")
REPORT_WORDS = ("报告", "导出", "通知", "发送", "飞书", "邮件", "markdown")


def classify_intent(message: str, context: dict | None = None) -> RouteDecision:
    text = message.strip().lower()
    if not text:
        return RouteDecision(Intent.AMBIGUOUS, GENERAL_ASSISTANT_NAME, "通用助手")

    if len(text) <= 4 and any(word in text for word in ("数据", "表", "分析")):
        return RouteDecision(Intent.AMBIGUOUS, GENERAL_ASSISTANT_NAME, "通用助手")

    if any(word in text for word in REPORT_WORDS):
        return RouteDecision(Intent.REPORTING, REPORT_WRITER_NAME, "报告撰写助手")

    if any(word in text for word in DATA_WORDS):
        return RouteDecision(Intent.DATA_ANALYSIS, DATA_ANALYST_NAME, "数据分析助手")

    return RouteDecision(Intent.GENERAL, GENERAL_ASSISTANT_NAME, "通用助手")
