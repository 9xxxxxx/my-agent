"""ECharts 图表配置生成工具"""
from agents import function_tool
from core.database import run_query_to_dataframe
from core.file_loader import query_file
import json


CHART_TYPES = {
    "bar": "柱状图", "line": "折线图", "pie": "饼图", "scatter": "散点图",
    "area": "面积图", "radar": "雷达图", "heatmap": "热力图", "boxplot": "箱线图",
    "candlestick": "K线图", "funnel": "漏斗图", "sankey": "桑基图",
    "horizontal_bar": "水平柱状图", "treemap": "矩形树图", "waterfall": "瀑布图",
}


def _build_echarts_option(
    data_records: list[dict], chart_type: str, title: str,
    x_field: str, y_field: str, series_field: str = "",
) -> dict:
    """根据数据和图表类型生成 ECharts option JSON"""
    x_values = [r.get(x_field, "") for r in data_records]

    base = {
        "title": {"text": title, "left": "center"},
        "tooltip": {"trigger": "axis" if chart_type not in ("pie", "scatter") else "item"},
        "grid": {"left": "3%", "right": "4%", "bottom": "3%", "containLabel": True},
    }

    if chart_type == "pie":
        base["series"] = [{
            "type": "pie", "radius": ["40%", "70%"],
            "data": [{"name": r.get(x_field, ""), "value": r.get(y_field, 0)} for r in data_records],
            "label": {"show": True, "formatter": "{b}: {c} ({d}%)"},
        }]
    elif chart_type == "scatter":
        base["xAxis"] = {"type": "value", "name": x_field}
        base["yAxis"] = {"type": "value", "name": y_field}
        base["series"] = [{"type": "scatter", "data": [[r.get(x_field, 0), r.get(y_field, 0)] for r in data_records]}]
    elif chart_type in ("bar", "line", "area"):
        base["xAxis"] = {"type": "category", "data": x_values, "axisLabel": {"rotate": 30 if len(x_values) > 10 else 0}}
        base["yAxis"] = {"type": "value"}
        series_type = "line" if chart_type == "area" else chart_type
        series = {"type": series_type, "data": [r.get(y_field, 0) for r in data_records]}
        if chart_type == "area":
            series["areaStyle"] = {}
        if series_field:
            # 多系列分组
            groups: dict[str, list] = {}
            for r in data_records:
                groups.setdefault(r.get(series_field, ""), []).append(r)
            base["series"] = []
            base["legend"] = {"data": list(groups.keys()), "bottom": 0}
            base["xAxis"]["data"] = list({r.get(x_field, "") for r in data_records})
            for group_name, records in groups.items():
                base["series"].append({
                    "type": series_type, "name": group_name,
                    "data": [r.get(y_field, 0) for r in records],
                    **({"areaStyle": {}} if chart_type == "area" else {}),
                })
        else:
            base["series"] = [series]
    elif chart_type == "horizontal_bar":
        base["yAxis"] = {"type": "category", "data": x_values}
        base["xAxis"] = {"type": "value"}
        base["series"] = [{"type": "bar", "data": [r.get(y_field, 0) for r in data_records]}]
    elif chart_type == "heatmap":
        x_vals = sorted({r.get(x_field, "") for r in data_records})
        y_vals = sorted({r.get(series_field or y_field, "") for r in data_records})
        heat_data = []
        for r in data_records:
            xi = x_vals.index(r.get(x_field, ""))
            yi = y_vals.index(r.get(series_field or y_field, ""))
            heat_data.append([xi, yi, r.get(y_field, 0)])
        base["xAxis"] = {"type": "category", "data": x_vals}
        base["yAxis"] = {"type": "category", "data": y_vals}
        base["visualMap"] = {"min": 0, "max": max(d[2] for d in heat_data) if heat_data else 1, "calculable": True}
        base["series"] = [{"type": "heatmap", "data": heat_data}]
    elif chart_type == "radar":
        indicators = [{"name": r.get(x_field, ""), "max": max(r.get(y_field, 0) for r in data_records) * 1.2} for r in data_records]
        base["radar"] = {"indicator": indicators}
        base["series"] = [{"type": "radar", "data": [{"value": [r.get(y_field, 0) for r in data_records]}]}]
    elif chart_type == "funnel":
        base["series"] = [{
            "type": "funnel", "left": "10%", "width": "80%",
            "data": [{"name": r.get(x_field, ""), "value": r.get(y_field, 0)} for r in data_records],
        }]
    elif chart_type == "boxplot":
        base["xAxis"] = {"type": "category", "data": x_values}
        base["yAxis"] = {"type": "value"}
        base["series"] = [{"type": "boxplot", "data": [r.get(y_field, 0) for r in data_records]}]
    elif chart_type == "treemap":
        base["series"] = [{
            "type": "treemap",
            "data": [{"name": r.get(x_field, ""), "value": r.get(y_field, 0)} for r in data_records],
        }]
    elif chart_type == "candlestick":
        # OHLC data: expects x_field=date, y_field=comma-separated "open,close,low,high"
        base["xAxis"] = {"type": "category", "data": x_values}
        base["yAxis"] = {"type": "value", "scale": True}
        ohlc = []
        for r in data_records:
            val = r.get(y_field, "0,0,0,0")
            if isinstance(val, str):
                parts = [float(x) for x in val.split(",")]
            elif isinstance(val, (list, tuple)):
                parts = [float(x) for x in val]
            else:
                parts = [0, 0, 0, 0]
            # ECharts candlestick: [open, close, lowest, highest]
            ohlc.append(parts[:4] if len(parts) >= 4 else parts + [0] * (4 - len(parts)))
        base["series"] = [{"type": "candlestick", "data": ohlc}]
    elif chart_type == "sankey":
        # Expects series_field=source, x_field=target, y_field=value
        nodes = set()
        links = []
        for r in data_records:
            src = str(r.get(series_field or x_field, ""))
            tgt = str(r.get(x_field if series_field else y_field, ""))
            val = r.get(y_field if series_field else "value", 0)
            nodes.add(src)
            nodes.add(tgt)
            links.append({"source": src, "target": tgt, "value": val})
        base.pop("grid", None)
        base.pop("xAxis", None)
        base.pop("yAxis", None)
        base["series"] = [{
            "type": "sankey",
            "data": [{"name": n} for n in sorted(nodes)],
            "links": links,
            "emphasis": {"focus": "adjacency"},
            "lineStyle": {"color": "gradient", "curveness": 0.5},
        }]
    elif chart_type == "waterfall":
        # Cumulative waterfall: each bar starts where previous ended
        values = [r.get(y_field, 0) for r in data_records]
        base["xAxis"] = {"type": "category", "data": x_values, "axisLabel": {"rotate": 30 if len(x_values) > 10 else 0}}
        base["yAxis"] = {"type": "value"}
        # Build transparent base + colored bar stacks
        base_data = []
        positive_data = []
        negative_data = []
        cumulative = 0
        for v in values:
            if v >= 0:
                base_data.append(cumulative)
                positive_data.append(v)
                negative_data.append("-")
                cumulative += v
            else:
                cumulative += v
                base_data.append(cumulative)
                positive_data.append("-")
                negative_data.append(abs(v))
        base["series"] = [
            {"type": "bar", "stack": "waterfall", "data": base_data, "itemStyle": {"color": "transparent"}, "emphasis": {"itemStyle": {"color": "transparent"}}},
            {"type": "bar", "stack": "waterfall", "data": positive_data, "name": "增加", "itemStyle": {"color": "#059669"}},
            {"type": "bar", "stack": "waterfall", "data": negative_data, "name": "减少", "itemStyle": {"color": "#ef4444"}},
        ]
        base["legend"] = {"data": ["增加", "减少"], "bottom": 0}
    else:
        base["xAxis"] = {"type": "category", "data": x_values}
        base["yAxis"] = {"type": "value"}
        base["series"] = [{"type": "bar", "data": [r.get(y_field, 0) for r in data_records]}]

    return base


@function_tool
def create_chart(
    chart_type: str, title: str, x_field: str, y_field: str,
    sql_query: str, series_field: str = "", data_source: str = "database",
) -> str:
    """执行 SQL 查询并生成 ECharts 图表配置 JSON。
    data_source: "database" 从数据库查询，"file" 从已上传文件查询。
    支持的图表类型: bar(柱状图), line(折线图), pie(饼图), scatter(散点图), area(面积图), radar(雷达图), heatmap(热力图), boxplot(箱线图), candlestick(K线图), funnel(漏斗图), sankey(桑基图), horizontal_bar(水平柱状图), treemap(矩形树图), waterfall(瀑布图)。
    candlestick: y_field 填 "open,close,low,high" 四列逗号分隔。
    sankey: series_field=源, x_field=目标, y_field=值。
    waterfall: 自动计算累计值，正数绿色、负数红色。"""
    if chart_type not in CHART_TYPES:
        supported = ", ".join(f"{k}({v})" for k, v in CHART_TYPES.items())
        return f"错误: 不支持的图表类型 '{chart_type}'。支持: {supported}"

    # 安全检查
    for kw in ["DROP ", "DELETE ", "UPDATE ", "INSERT ", "ALTER ", "TRUNCATE "]:
        if kw in sql_query.upper():
            return f"错误: 禁止执行含有 {kw.strip()} 的语句。"

    try:
        if data_source == "file":
            df = query_file(sql_query)
        else:
            df = run_query_to_dataframe(sql_query)

        if df.empty:
            return "错误: 查询未返回任何数据，无法生成图表。"

        # 列名模糊匹配
        actual_cols = list(df.columns)
        actual_lower = [c.lower() for c in actual_cols]

        def fix_col(name: str) -> str | None:
            if name in actual_cols:
                return name
            if name.lower() in actual_lower:
                return actual_cols[actual_lower.index(name.lower())]
            return None

        x_fixed = fix_col(x_field)
        y_fixed = fix_col(y_field)
        if not x_fixed:
            return f"错误: X 轴列 '{x_field}' 不存在。可用列: {actual_cols}"
        if not y_fixed:
            return f"错误: Y 轴列 '{y_field}' 不存在。可用列: {actual_cols}"

        series_fixed = fix_col(series_field) if series_field else ""

        if len(df) > 500:
            df = df.head(500)
            title += " (前 500 条)"

        records = df.to_dict(orient="records")
        option = _build_echarts_option(records, chart_type, title, x_fixed, y_fixed, series_fixed or "")
        return f"[ECHARTS_CHART] {json.dumps(option, ensure_ascii=False)}"
    except Exception as e:
        return f"图表生成错误: {e}"
