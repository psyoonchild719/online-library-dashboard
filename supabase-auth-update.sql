-- =============================================
-- Google Auth 연동을 위한 DB 업데이트
-- =============================================

-- members 테이블에 auth_id 컬럼 추가 (Google 로그인 사용자 연결용)
ALTER TABLE members ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

-- 기존 샘플 데이터의 이메일을 실제 사용할 이메일로 업데이트하거나,
-- 새로운 사용자가 Google 로그인 시 자동으로 등록되도록 함

-- RLS 정책 업데이트: 본인만 입퇴실 가능하도록
DROP POLICY IF EXISTS "Allow public insert on attendance_logs" ON attendance_logs;
DROP POLICY IF EXISTS "Allow public update on online_status" ON online_status;

-- 새 정책: 로그인한 사용자만 본인의 입퇴실 기록 가능
CREATE POLICY "Users can insert own attendance" ON attendance_logs
  FOR INSERT WITH CHECK (
    member_id IN (
      SELECT id FROM members WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own online status" ON online_status
  FOR UPDATE USING (
    member_id IN (
      SELECT id FROM members WHERE auth_id = auth.uid()
    )
  );

-- 새 멤버 자동 등록을 위한 함수 (Google 로그인 시 자동 생성)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.members (auth_id, name, email, avatar)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    '👤'
  )
  ON CONFLICT (email) DO UPDATE SET auth_id = NEW.id;

  -- online_status도 생성
  INSERT INTO public.online_status (member_id, is_online)
  SELECT id, false FROM public.members WHERE auth_id = NEW.id
  ON CONFLICT (member_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성 (이미 있으면 삭제 후 재생성)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
