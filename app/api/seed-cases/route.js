'use server';

import { createClient } from '@supabase/supabase-js';
import { majorCases, ethicsCases, predictedCases } from '../../../data/cases';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request) {
  // 간단한 보안: 쿼리 파라미터로 확인
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (key !== 'seed2026') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. 기존 데이터 삭제 (재실행 대비)
    await supabase.from('interview_questions').delete().neq('id', 0);
    await supabase.from('interview_cases').delete().neq('id', 0);

    // 2. 전공 기출 사례 삽입
    for (const c of majorCases) {
      const { data: caseData, error: caseError } = await supabase
        .from('interview_cases')
        .insert({
          type: 'major',
          title: c.title,
          category: c.category,
          diagnosis: c.diagnosis,
          topic: null,
          case_text: c.caseText,
          years: c.years || [],
          source: 'exam'
        })
        .select()
        .single();

      if (caseError) {
        console.error('Error inserting major case:', caseError);
        continue;
      }

      // 질문 삽입
      if (c.questions && caseData) {
        for (let i = 0; i < c.questions.length; i++) {
          const q = c.questions[i];
          await supabase.from('interview_questions').insert({
            case_id: caseData.id,
            question: q.q,
            key_points: q.keyPoints || [],
            order_num: i + 1
          });
        }
      }
    }

    // 3. 윤리 기출 사례 삽입
    for (const c of ethicsCases) {
      const { data: caseData, error: caseError } = await supabase
        .from('interview_cases')
        .insert({
          type: 'ethics',
          title: c.title,
          category: c.category,
          diagnosis: null,
          topic: c.topic,
          case_text: c.caseText,
          years: c.years || [],
          source: 'exam'
        })
        .select()
        .single();

      if (caseError) {
        console.error('Error inserting ethics case:', caseError);
        continue;
      }

      // 질문 삽입
      if (c.questions && caseData) {
        for (let i = 0; i < c.questions.length; i++) {
          const q = c.questions[i];
          await supabase.from('interview_questions').insert({
            case_id: caseData.id,
            question: q.q,
            key_points: q.keyPoints || [],
            order_num: i + 1
          });
        }
      }
    }

    // 4. 예상문제 삽입
    for (const c of predictedCases) {
      const { data: caseData, error: caseError } = await supabase
        .from('interview_cases')
        .insert({
          type: 'major',
          title: c.title,
          category: c.category,
          diagnosis: c.diagnosis,
          topic: null,
          case_text: c.caseText,
          years: c.years || ['예상'],
          source: 'predicted'
        })
        .select()
        .single();

      if (caseError) {
        console.error('Error inserting predicted case:', caseError);
        continue;
      }

      // 질문 삽입
      if (c.questions && caseData) {
        for (let i = 0; i < c.questions.length; i++) {
          const q = c.questions[i];
          await supabase.from('interview_questions').insert({
            case_id: caseData.id,
            question: q.q,
            key_points: q.keyPoints || [],
            order_num: i + 1
          });
        }
      }
    }

    return Response.json({
      success: true,
      message: `Seeded: ${majorCases.length} major + ${ethicsCases.length} ethics + ${predictedCases.length} predicted cases`
    });

  } catch (error) {
    console.error('Seed error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
