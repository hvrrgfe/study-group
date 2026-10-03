#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""批量添加成员和测试题目到 Supabase"""

import json
import urllib.request
import urllib.error

# Supabase REST API
BASE = "https://wsipigpjkxaeljfrrvyq.supabase.co/rest/v1"
KEY = "sb_publishable_YbtTbQGMakCyoAVV0atHDw_z_D8hZtB"
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# 成员名单（从截图提取，不含群主）
MEMBERS = [
    "部落萨满亚伦", "悲伤土豆地雷", "别逗你奇姐笑",
    "Castor", "尘梵", "鐡师", "Cs夜艳",
    "大白兔奶糖", "独特", "惰者（臭学物",
    "嗯",
    "疯狂允吸二次", "氟西汀", "枫屿雲",
    "乖乖", "干就", "高三上学勿踢", "高一2班16号苏璟睿", "古月照今尘",
    "辉", "河北高三", "虎虎生威",
    "句号", "jorona", "镜中故鸊",
    "可笑ə",
    "啦啦啦", "濑名紫阳花", "蓝云白天", "凌空（开学不",
    "moshang",
    "NOx", "念戎",
    "OVO",
    "破冰者",
    "千般繁优", "千逐",
    "若如秋来",
    "三年后必上211", "桑语",
    "太白", "听风叙旧金", "特务兔",
    "up",
    "雾岛", "无名小卒", "我确实没意见", "往昔当下", "无垠雲",
    "XiuLi娅", "向往玫瑰的冒", "小云", "西江",
    "有", "逾", "余", "芽", "晔", "月尘", "幼儿园中班Pro", "月亮计划", "永远的共产节拍", "庸爪",
    "资料多", "只有做个肝帝了",
    "sô1ã†éð", "2602肖雅琴", "48张昊尘", "@@@", "备注待定",
]

def api_post(path, data):
    url = f"{BASE}/{path}"
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "message": e.read().decode()}

def api_patch(path, data):
    url = f"{BASE}/{path}"
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=HEADERS, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "message": e.read().decode()}

def api_get(path):
    url = f"{BASE}/{path}"
    req = urllib.request.Request(url, headers=HEADERS, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "message": e.read().decode()}

print("=" * 50)
print("🚀 开始批量添加成员到 Supabase...")
print("=" * 50)

# 检查现有成员
existing = api_get("members?select=id,name")
if "error" not in existing:
    existing_names = {m["name"] for m in existing}
    print(f"数据库中已有 {len(existing)} 个成员")
else:
    existing_names = set()
    print(f"检查成员时出错: {existing}")

# 批量添加新成员
new_members = []
for i, name in enumerate(MEMBERS, 1):
    if name not in existing_names:
        new_members.append({"name": name, "points": 0})

if new_members:
    print(f"需要添加 {len(new_members)} 个新成员...")
    
    # 分批插入（每次50个避免URL过长）
    batch_size = 50
    total_added = 0
    for i in range(0, len(new_members), batch_size):
        batch = new_members[i:i+batch_size]
        result = api_post("members", batch)
        if isinstance(result, list):
            total_added += len(result)
            print(f"  批次 {i//batch_size+1}: 成功添加 {len(result)} 人")
        elif "error" in result:
            print(f"  批次 {i//batch_size+1}: 失败 - {result}")
        else:
            if isinstance(result, dict) and len(result) > 0:
                total_added += len(result)
                print(f"  批次 {i//batch_size+1}: 成功添加 {len(result)} 人")
    
    print(f"\n✅ 共添加 {total_added} 个新成员")
else:
    print("所有成员已在数据库中")

# 添加测试题目
print("\n" + "=" * 50)
print("📝 添加测试题目...")
print("=" * 50)

today = "2026-10-03"

# 检查现有题目
existing_qs = api_get(f"questions?select=id,subject,type,content&date=eq.{today}")
if "error" not in existing_qs:
    print(f"今天已有 {len(existing_qs)} 道题目")
else:
    existing_qs = []
    print("检查题目时出错")

# 数学选择题
math_q = {
    "subject": "数学", "type": "选择",
    "content": "已知函数 f(x) = x² + 2x，求 f(3) 的值。",
    "options": ["15", "9", "12", "6"],
    "correct_answer": "A",
    "reference_answer": "f(3) = 3² + 2×3 = 9 + 6 = 15",
    "points": 5,
    "date": today,
    "publish_time": "20:00",
    "close_time": "21:00"
}

# 数学填空题
math_fill = {
    "subject": "数学", "type": "填空",
    "content": "方程 x² - 5x + 6 = 0 的两个根是 ___ 和 ___。",
    "correct_answer": "2,3",
    "reference_answer": "因式分解得 (x-2)(x-3)=0，所以 x=2 或 x=3",
    "points": 5,
    "date": today,
    "publish_time": "20:00",
    "close_time": "21:00"
}

# 语文作文
essay = {
    "subject": "语文", "type": "作文",
    "content": "以\"诚信\"为题，写一篇不少于800字的议论文。",
    "reference_answer": "可从诚信的定义、重要性、现实案例等角度展开",
    "points": 35,
    "date": today,
    "publish_time": "20:00",
    "close_time": "21:00"
}

test_questions = [math_q, math_fill, essay]
for q in test_questions:
    # 检查是否已存在
    exists = any(x.get("content") == q["content"] for x in existing_qs)
    if not exists:
        result = api_post("questions", q)
        if "error" in result:
            print(f"  ❌ {q['subject']} {q['type']}: 添加失败 - {result}")
        else:
            print(f"  ✅ {q['subject']} {q['type']}: 添加成功")
    else:
        print(f"  ⏭️ {q['subject']} {q['type']}: 已存在")

print("\n✅ 数据库初始化完成！")
