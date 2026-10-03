#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为学习群成员批量生成登录账号和密码"""

import random
import string

# 群成员名单（从截图提取，不含群主"我是一个人呐 qwvedc"）
# 有些名字在截图中被截断，用可见部分 + 下划线标注
MEMBERS = [
    # B
    "部落萨满亚伦", "悲伤土豆地雷", "别逗你奇姐笑",
    # C
    "Castor", "尘梵", "鐡师", "Cs夜艳",
    # D
    "大白兔奶糖", "独特", "惰者（臭学物",
    # E
    "嗯",
    # F
    "疯狂允吸二次", "氟西汀", "枫屿雲",
    # G
    "乖乖", "干就", "高三上学勿踢", "高一2班16号苏璟睿", "古月照今尘",
    # H
    "辉", "河北高三", "虎虎生威",
    # J
    "句号", "jorona", "镜中故鸊",
    # K
    "可笑ə",
    # L
    "啦啦啦", "濑名紫阳花", "蓝云白天", "凌空（开学不",
    # M
    "moshang",
    # N
    "NOx", "念戎",
    # O
    "OVO",
    # P
    "破冰者",
    # Q
    "千般繁优", "千逐",
    # R
    "若如秋来",
    # S
    "三年后必上211", "桑语",
    # T
    "太白", "听风叙旧金", "特务兔",
    # U
    "up",
    # W（群主"我"已排除）
    "雾岛", "无名小卒", "我确实没意见", "往昔当下", "无垠雲",
    # X
    "XiuLi娅", "向往玫瑰的冒", "小云", "西江",
    # Y
    "有", "逾", "余", "芽", "晔", "月尘", "幼儿园中班Pro", "月亮计划", "永远的共产节拍", "庸爪",
    # Z
    "资料多", "只有做个肝帝了",
    # #
    "sô1ã†éð", "2602肖雅琴", "48张昊尘", "@@@", "备注待定",
]

def gen_password(length=10):
    """生成随机密码"""
    chars = string.ascii_letters + string.digits + '!@#$%^&*'
    return ''.join(random.choice(chars) for _ in range(length))

def to_pinyin_initial(name):
    """取名字首字母作为账号前缀（中文取拼音首字母太复杂，用编号代替）"""
    return name[:6].replace(' ', '').replace('(', '').replace(')')

def generate_accounts(members):
    accounts = []
    for i, name in enumerate(members, 1):
        username = f"student{i:03d}"
        password = gen_password(12)
        display_name = name if len(name) <= 10 else name[:8] + "..."
        accounts.append((username, password, display_name))
    return accounts

def format_html(accounts):
    """生成HTML表格"""
    html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>学习群成员账号密码</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #0f1129; color: #e8eaf6; padding: 20px; }
.container { max-width: 800px; margin: 0 auto; }
h1 { text-align: center; margin-bottom: 8px; font-size: 22px; }
.subtitle { text-align: center; color: #a0a3c8; font-size: 13px; margin-bottom: 24px; }
table { width: 100%; border-collapse: collapse; background: #1e2040; border-radius: 12px; overflow: hidden; }
th { background: #2c2f63; padding: 12px 16px; text-align: left; font-size: 14px; color: #4f7cff; }
td { padding: 10px 16px; border-bottom: 1px solid rgba(79,124,255,0.08); font-size: 14px; }
tr:hover { background: rgba(79,124,255,0.05); }
.pwd { font-family: monospace; color: #4ecdc4; letter-spacing: 1px; }
.copy-btn { 
    background: #4f7cff; color: white; border: none; padding: 8px 16px; border-radius: 8px; 
    cursor: pointer; font-size: 13px; margin: 16px 0; display: block; margin-left: auto; margin-right: auto;
}
.notice { background: rgba(255,185,48,0.1); border: 1px solid rgba(255,185,48,0.2); border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; font-size: 13px; color: #ffb930; }
</style>
</head>
<body>
<div class="container">
<h1>📚 学习群成员账号密码表</h1>
<p class="subtitle">群主账号为"我是一个人呐 qwvedc"（权限更高）· 以下为普通成员账号</p>
<div class="notice">⚠️ 请将密码发给你要添加的好友，不要公开分享。首次登录后请修改密码。</div>
<button class="copy-btn" onclick="copyAll()">📋 一键复制全部</button>
<table>
<thead>
<tr><th>#</th><th>昵称</th><th>账号</th><th>密码</th></tr>
</thead>
<tbody>
"""
    for i, (user, pwd, name) in enumerate(accounts, 1):
        html += f'<tr><td>{i}</td><td>{name}</td><td>{user}</td><td class="pwd">{pwd}</td></tr>\n'
    html += """</tbody>
</table>
</div>
<script>
function copyAll() {
    let text = '昵称 | 账号 | 密码\n';
    document.querySelectorAll('tbody tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        text += cells[1].textContent + ' | ' + cells[2].textContent + ' | ' + cells[3].textContent + '\n';
    });
    navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板'));
}
</script>
</body>
</html>"""
    return html

if __name__ == '__main__':
    accounts = generate_accounts(MEMBERS)
    
    # 输出HTML
    html = format_html(accounts)
    with open('/var/minis/workspace/study-group/accounts.html', 'w', encoding='utf-8') as f:
        f.write(html)
    
    # 输出纯文本到终端（不打印密码到stdout，改写到文件）
    with open('/var/minis/workspace/study-group/accounts.txt', 'w', encoding='utf-8') as f:
        f.write("学习群成员账号密码表\n")
        f.write("=" * 60 + "\n")
        f.write(f"{'#':<4} {'昵称':<15} {'账号':<15} {'密码'}\n")
        f.write("-" * 60 + "\n")
        for i, (user, pwd, name) in enumerate(accounts, 1):
            f.write(f"{i:<4} {name:<15} {user:<15} {pwd}\n")
    
    print(f"已生成 {len(accounts)} 个成员账号")
    print("输出文件: accounts.html 和 accounts.txt")
