-- ================================================================
-- 면접 시뮬레이터 테이블 생성 SQL
-- 실행: Supabase Dashboard > SQL Editor에서 실행
-- ================================================================

-- 1. 사례 테이블
CREATE TABLE IF NOT EXISTS interview_cases (
  id SERIAL PRIMARY KEY,
  type VARCHAR(10) NOT NULL CHECK (type IN ('major', 'ethics')),
  title VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  diagnosis VARCHAR(100),              -- 전공 사례용
  topic VARCHAR(100),                  -- 윤리 사례용
  case_text TEXT NOT NULL,
  years TEXT[] DEFAULT '{}',
  frequency INTEGER DEFAULT 1,
  source VARCHAR(20) DEFAULT 'exam' CHECK (source IN ('exam', 'predicted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 질문 테이블
CREATE TABLE IF NOT EXISTS interview_questions (
  id SERIAL PRIMARY KEY,
  case_id INTEGER REFERENCES interview_cases(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  key_points TEXT[] DEFAULT '{}',
  model_answer TEXT,
  tip TEXT,
  source VARCHAR(20) DEFAULT 'exam' CHECK (source IN ('exam', 'predicted')),
  order_num INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 연습 기록 테이블 (member_id는 UUID 타입)
CREATE TABLE IF NOT EXISTS interview_logs (
  id SERIAL PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  case_id INTEGER REFERENCES interview_cases(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES interview_questions(id) ON DELETE CASCADE,
  user_answer TEXT,
  time_spent INTEGER DEFAULT 0,        -- 초 단위
  score INTEGER,                       -- 자가 평가 점수 (선택)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_interview_cases_type ON interview_cases(type);
CREATE INDEX IF NOT EXISTS idx_interview_cases_category ON interview_cases(category);
CREATE INDEX IF NOT EXISTS idx_interview_questions_case_id ON interview_questions(case_id);
CREATE INDEX IF NOT EXISTS idx_interview_logs_member_id ON interview_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_interview_logs_created_at ON interview_logs(created_at DESC);

-- 5. RLS (Row Level Security) 정책
ALTER TABLE interview_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_logs ENABLE ROW LEVEL SECURITY;

-- 사례와 질문은 모든 인증 사용자가 읽기 가능
CREATE POLICY "Anyone can read cases" ON interview_cases
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read questions" ON interview_questions
  FOR SELECT USING (true);

-- 연습 기록은 본인만 읽기/쓰기 가능
CREATE POLICY "Users can insert own logs" ON interview_logs
  FOR INSERT WITH CHECK (
    member_id IN (
      SELECT id FROM members WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can read own logs" ON interview_logs
  FOR SELECT USING (
    member_id IN (
      SELECT id FROM members WHERE auth_id = auth.uid()
    )
  );

-- 6. Updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_interview_cases_updated_at
  BEFORE UPDATE ON interview_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 실행 후 확인용 쿼리
-- ================================================================
-- SELECT * FROM interview_cases LIMIT 5;
-- SELECT * FROM interview_questions LIMIT 5;
