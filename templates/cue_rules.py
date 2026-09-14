# 字幕规则（每个项目一份）
# FIX：ASR 错字 → 正确写法（按 ASR 段做替换；跨段的词拆成两条）
FIX = [
    ("multi agent", "Multi-Agent"), ("multiagent", "Multi-Agent"), ("2C", "To C"),
    ("5位数", "五位数"), ("6位数", "六位数"), ("openai", "OpenAI"), ("Openai", "OpenAI"),
]
# GOLD：字幕里金色高亮的关键词（≤2s 一次的密度，长词在前）
GOLD = []
# PROT_EXTRA：额外不许拦腰断开的词
PROT_EXTRA = []
# DROP：整条丢弃的幻觉句（正则）
DROP = r'请不吝|点赞|订阅|转发|打赏|明镜|点点栏目|字幕|Amara'
