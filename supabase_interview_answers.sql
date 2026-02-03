-- 면접 시뮬레이터 답안 저장 테이블
CREATE TABLE interview_answers (
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

-- 인덱스 생성
CREATE INDEX idx_interview_answers_member ON interview_answers(member_id);
CREATE INDEX idx_interview_answers_case ON interview_answers(case_id);

-- RLS 정책 활성화
ALTER TABLE interview_answers ENABLE ROW LEVEL SECURITY;

-- 읽기 권한: 본인 답안만
CREATE POLICY "Users can read own answers" ON interview_answers
  FOR SELECT USING (
    member_id IN (
      SELECT id FROM members WHERE auth_id = auth.uid()
    )
  );

-- 쓰기 권한: 본인만
CREATE POLICY "Users can insert own answers" ON interview_answers
  FOR INSERT WITH CHECK (
    member_id IN (
      SELECT id FROM members WHERE auth_id = auth.uid()
    )
  );

-- 수정 권한: 본인만
CREATE POLICY "Users can update own answers" ON interview_answers
  FOR UPDATE USING (
    member_id IN (
      SELECT id FROM members WHERE auth_id = auth.uid()
    )
  );

-- 삭제 권한: 본인만
CREATE POLICY "Users can delete own answers" ON interview_answers
  FOR DELETE USING (
    member_id IN (
      SELECT id FROM members WHERE auth_id = auth.uid()
    )
  );

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_interview_answers_updated_at
  BEFORE UPDATE ON interview_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
