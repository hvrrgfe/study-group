-- ============================================================
--  学习群答题积分系统 — Supabase 建表 SQL
--  使用方法：登录 Supabase → 左侧 SQL Editor → 粘贴以下内容 → Run
-- ============================================================

-- 1. 成员表
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 题目表
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT,
  reference_answer TEXT,
  points INTEGER DEFAULT 5,
  date DATE NOT NULL,
  publish_time TEXT DEFAULT '20:00',
  close_time TEXT DEFAULT '21:00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 提交记录表
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  answer TEXT,
  score INTEGER DEFAULT 0,
  correct BOOLEAN,
  graded BOOLEAN DEFAULT FALSE,
  graded_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(question_id, member_id)
);

-- 4. 开启行级安全 (RLS)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 5. 允许匿名用户读写（学习群共享模式）
--    如果以后需要更严格的权限，可以在这里修改策略
CREATE POLICY "members_all" ON members FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "questions_all" ON questions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "submissions_all" ON submissions FOR ALL TO anon USING (true) WITH CHECK (true);

-- 6. 按日期查询的索引（加速今日题目查询）
CREATE INDEX IF NOT EXISTS idx_questions_date ON questions(date);
CREATE INDEX IF NOT EXISTS idx_submissions_member ON submissions(member_id);
CREATE INDEX IF NOT EXISTS idx_submissions_question ON submissions(question_id);
