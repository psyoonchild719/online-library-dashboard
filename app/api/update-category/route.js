import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (key !== 'update2026') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 감별진단 → 꾀병 으로 변경
    const { data, error } = await supabase
      .from('interview_cases')
      .update({ category: '꾀병' })
      .eq('category', '감별진단')
      .select();

    if (error) throw error;

    return Response.json({
      success: true,
      message: `${data?.length || 0}개 사례의 카테고리를 '감별진단' → '꾀병'으로 변경 완료`
    });

  } catch (error) {
    console.error('Update category error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
