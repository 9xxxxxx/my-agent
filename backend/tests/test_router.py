from core.router import Intent, classify_intent


def test_classifies_daily_greeting_as_general():
    assert classify_intent("你好，今天怎么样？").intent is Intent.GENERAL


def test_classifies_sql_and_chart_request_as_data_analysis():
    result = classify_intent("帮我查询订单表并画出销售趋势图")
    assert result.intent is Intent.DATA_ANALYSIS
    assert result.agent_name == "DataAnalyst"


def test_classifies_report_export_as_reporting():
    result = classify_intent("把刚才的分析生成报告并导出")
    assert result.intent is Intent.REPORTING
    assert result.agent_name == "ReportWriter"


def test_classifies_short_ambiguous_data_word_as_ambiguous():
    result = classify_intent("数据")
    assert result.intent is Intent.AMBIGUOUS
    assert result.agent_name == "GeneralAssistant"
