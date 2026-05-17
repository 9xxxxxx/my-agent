from core.router import Intent, classify_intent


def test_classifies_daily_greeting_as_general():
    assert classify_intent("你好，今天怎么样？").intent is Intent.GENERAL


def test_classifies_sql_and_chart_request_as_data_analysis():
    result = classify_intent("帮我查询订单表并画出销售趋势图")
    assert result.intent is Intent.DATA_ANALYSIS
    assert result.agent_name == "DataAnalyst"
