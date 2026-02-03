-- 면접 시뮬레이터 답안 저장 테이블
CREATE TABLE IF NOT EXISTS interview_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  case_id UUID REFERENCES interview_cases(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  answer TEXT DEFAULT '',
  checked_points INTEGER[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(member_id, case_id, question_index)
);

-- 인덱스 생성 (이미 존재하면 무시)
CREATE INDEX IF NOT EXISTS idx_interview_answers_member ON interview_answers(member_id);
CREATE INDEX IF NOT EXISTS idx_interview_answers_case ON interview_answers(case_id);

-- RLS 정책 활성화
ALTER TABLE interview_answers ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있으면)
DROP POLICY IF EXISTS "Users can read own answers" ON interview_answers;
DROP POLICY IF EXISTS "Users can insert own answers" ON interview_answers;
DROP POLICY IF EXISTS "Users can update own answers" ON interview_answers;
DROP POLICY IF EXISTS "Users can delete own answers" ON interview_answers;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON interview_answers;

-- 간단한 정책: 인증된 사용자는 모든 작업 가능 (스터디 멤버만 앱에 접근 가능하므로)
CREATE POLICY "Enable all for authenticated users" ON interview_answers
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- updated_at 자동 업데이트 함수 (이미 존재하면 대체)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 (이미 존재하면 삭제 후 재생성)
DROP TRIGGER IF EXISTS update_interview_answers_updated_at ON interview_answers;
CREATE TRIGGER update_interview_answers_updated_at
  BEFORE UPDATE ON interview_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
