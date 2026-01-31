import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST() {
  try {
    // interview_questions 테이블에 model_answer 컬럼 추가
    const { error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS model_answer TEXT;`
    });

    if (error) {
      // RPC가 없으면 직접 쿼리 시도
      console.log('RPC 실패, 대체 방법 시도:', error.message);

      // 테스트로 기존 데이터에 빈 값으로 업데이트 시도
      const { data, error: testError } = await supabase
        .from('interview_questions')
        .select('id')
        .limit(1);

      if (testError) throw testError;

      return NextResponse.json({
        success: true,
        message: 'Supabase Dashboard에서 직접 컬럼을 추가해주세요.',
        instruction: `
          Supabase Dashboard > SQL Editor에서 실행:
          ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS model_answer TEXT;
        `
      });
    }

    return NextResponse.json({
      success: true,
      message: 'model_answer 컬럼이 추가되었습니다.'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      instruction: `
        Supabase Dashboard > SQL Editor에서 직접 실행:
        ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS model_answer TEXT;
      `
    }, { status: 500 });
  }
}
