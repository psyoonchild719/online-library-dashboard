import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 고빈도 카테고리 심화 예상문제
const newPredictedCases = [
  // ========== 우울/불안 심화 ==========
  {
    type: 'major',
    title: '35세 여성 산후우울',
    category: '우울/불안',
    diagnosis: '산후우울증/산후정신병',
    case_text: '35세 여성이 첫 아이 출산 3주 후부터 극심한 우울감을 호소한다. 아기에게 정이 안 가고, 아기를 돌보는 것이 너무 힘들다고 한다. 밤에 잠을 못 자고 식욕도 없다. 최근에는 "내가 이 아이를 잘 키울 수 있을까", "차라리 없어지는 게 나을 것 같다"는 생각이 든다고 한다. 남편은 "갑자기 사람이 변했다"며 걱정하고 있다.',
    years: ['예상'],
    source: 'predicted',
    questions: [
      { q: '진단과 감별진단은?', keyPoints: ['산후우울증: 출산 후 4주 이내 발병', '산후정신병 r/o: 정신병적 증상 유무', 'Baby blues와 감별: 2주 이내 호전 여부', '자살/영아살해 위험 평가 필수'], tip: '출산 후 시점과 증상 심각도가 핵심' },
      { q: '치료적 접근과 고려사항은?', keyPoints: ['안전 평가 우선 (자해/타해)', '모유수유 시 약물 선택 주의', 'SSRI 중 sertraline 선호', '지지적 심리치료 + 가족교육'], tip: '수유 중 약물 안전성 숙지 필요' }
    ]
  },
  {
    type: 'major',
    title: '55세 남성 치료저항성 우울',
    category: '우울/불안',
    diagnosis: '치료저항성 우울장애',
    case_text: '55세 남성으로 10년간 우울장애 치료 중이다. 여러 종류의 항우울제를 적절한 용량과 기간으로 복용했으나 호전이 없다. 현재 무기력감, 흥미 저하, 수면 장애가 지속되고 있다. 최근 직장에서 조기 퇴직 압박을 받으면서 증상이 더 악화되었고, "이렇게 사느니 차라리..."라는 말을 자주 한다.',
    years: ['예상'],
    source: 'predicted',
    questions: [
      { q: '치료저항성 우울의 정의와 평가는?', keyPoints: ['2가지 이상 항우울제 적절히 사용 후 무반응', '약물 순응도 확인', '동반질환 재평가 (갑상선, 물질 등)', '성격장애 동반 여부'], tip: '적절한 용량과 기간이 핵심' },
      { q: '다음 치료 전략은?', keyPoints: ['증강요법 (lithium, 비정형 항정신병)', 'MAOI 고려', 'ECT 고려', 'TMS, ketamine 등 신규 치료'], tip: '단계적 접근 설명' }
    ]
  },
  {
    type: 'major',
    title: '28세 여성 공황장애 vs 갑상선',
    category: '우울/불안',
    diagnosis: '공황장애/갑상선기능항진증',
    case_text: '28세 여성이 최근 2개월간 갑작스러운 심장 두근거림, 떨림, 발한, 호흡곤란을 호소한다. 이런 증상이 예고 없이 나타나 응급실을 3번 방문했으나 심장 검사에서 이상이 없었다. 체중이 5kg 감소했고, 평소보다 더위를 많이 탄다고 한다. 어머니가 갑상선 질환 병력이 있다.',
    years: ['예상'],
    source: 'predicted',
    questions: [
      { q: '감별진단을 위한 평가는?', keyPoints: ['갑상선기능검사 (TSH, T3, T4)', '공황발작 vs 지속적 증상 패턴', '체중감소, 열불내성은 갑상선 시사', '가족력 고려'], tip: '신체질환 배제가 우선' },
      { q: '두 질환의 감별점은?', keyPoints: ['공황: 삽화적, 예기불안, 회피', '갑상선: 지속적, 안구돌출, 빈맥', '공존 가능성도 고려'], tip: '삽화적 vs 지속적 패턴' }
    ]
  },

  // ========== 강박/정신증 심화 ==========
  {
    type: 'major',
    title: '19세 남성 초발 정신증',
    category: '강박/정신증',
    diagnosis: '조현병 초발/단기정신병적장애',
    case_text: '19세 남학생이 최근 2개월간 "누군가 나를 감시한다", "생각이 새어나간다"고 호소한다. 혼잣말을 하고, 갑자기 웃는 모습이 관찰된다. 고3 때까지 성적이 우수했으나 재수 중 증상이 시작되었다. 가족력상 외삼촌이 조현병으로 치료 중이다. 최근 방에서 나오지 않고 씻지도 않는다.',
    years: ['예상'],
    source: 'predicted',
    questions: [
      { q: '진단적 고려사항은?', keyPoints: ['조현병: 6개월 이상 지속 시', '조현양상장애: 1-6개월', '단기정신병적장애: 1개월 미만', '물질 유발 배제', 'DUP(치료받지 않은 기간) 중요'], tip: '증상 기간이 감별 핵심' },
      { q: '초발 정신증 개입 전략은?', keyPoints: ['조기 개입의 중요성', '저용량 항정신병 약물', '가족 심리교육', '인지재활', '예후 인자 평가'], tip: 'DUP 단축이 예후에 중요' }
    ]
  },
  {
    type: 'major',
    title: '45세 여성 망상장애',
    category: '강박/정신증',
    diagnosis: '망상장애 피해형/조현병',
    case_text: '45세 여성이 "이웃이 나를 감시하고 도청한다"고 주장한다. 3년 전 이웃과 층간소음 갈등 이후 시작되었다. 경찰에 수차례 신고했으나 증거가 없었다. 망상 외에 환청이나 와해된 언어는 없고, 직장생활도 유지하고 있다. 남편은 "이것만 빼면 정상"이라고 한다.',
    years: ['예상'],
    source: 'predicted',
    questions: [
      { q: '망상장애와 조현병 감별점은?', keyPoints: ['망상장애: 비기괴한 망상, 기능 보존', '조현병: 기괴한 망상, 음성증상, 기능저하', '환청 유무', '망상 외 영역의 기능'], tip: '기능 보존 여부가 핵심' },
      { q: '치료적 접근은?', keyPoints: ['치료 동맹 형성이 어려움', '항정신병 약물 효과 제한적', '망상에 직접 도전 피함', 'CBT for psychosis 고려'], tip: '관계 형성이 가장 중요' }
    ]
  },
  {
    type: 'major',
    title: '32세 남성 강박 vs 강박성 성격',
    category: '강박/정신증',
    diagnosis: '강박장애/강박성 성격장애',
    case_text: '32세 남성 회계사가 업무 중 숫자를 반복 확인하느라 야근이 잦다. 책상을 완벽하게 정리하고, 사소한 실수도 용납하지 못한다. 본인은 "꼼꼼한 성격"이라고 하나, 아내는 "너무 융통성이 없다"고 불평한다. 최근 실수에 대한 걱정이 심해져 퇴근 후에도 계속 확인 전화를 한다.',
    years: ['예상'],
    source: 'predicted',
    questions: [
      { q: 'OCD와 OCPD 감별점은?', keyPoints: ['OCD: 자아이질적, 침습사고, 고통', 'OCPD: 자아동조적, 성격 특성', 'OCD: 특정 강박행동', 'OCPD: 전반적 완벽주의'], tip: '자아이질적 vs 자아동조적' },
      { q: '공존 가능성과 치료 접근은?', keyPoints: ['두 장애 공존 가능 (25%)', 'OCPD 동반 시 치료 저항', 'ERP + 성격 특성 다루기', '융통성 훈련'], tip: '공존 시 예후 더 나쁨' }
    ]
  },

  // ========== 외상/스트레스 심화 ==========
  {
    type: 'major',
    title: '30세 여성 복합 PTSD',
    category: '외상/스트레스',
    diagnosis: '복합 PTSD/경계선 성격장애',
    case_text: '30세 여성이 어린 시절부터 지속된 가정폭력 피해 경험이 있다. 현재 악몽, 플래시백, 과각성 증상과 함께 정서조절 어려움, 만성적 공허감, 불안정한 대인관계를 보인다. 자해 경력이 있고, "나는 더럽혀진 존재"라는 부정적 자기인식을 가지고 있다.',
    years: ['예상'],
    source: 'predicted',
    questions: [
      { q: 'PTSD와 복합PTSD, BPD 감별은?', keyPoints: ['복합PTSD: 정서조절장애, 부정적 자기개념, 관계장애 추가', 'BPD: 버림받음 두려움, 이상화-평가절하', '외상력과 증상 발생 시점', 'ICD-11 복합PTSD 기준'], tip: '외상과 증상의 관계가 핵심' },
      { q: '치료 단계는?', keyPoints: ['1단계: 안정화, 정서조절 기술', '2단계: 외상 처리 (PE, EMDR)', '3단계: 재통합, 관계 개선', '장기 치료 필요'], tip: '단계적 접근 필수' }
    ]
  },
  {
    type: 'major',
    title: '25세 남성 해리 동반 PTSD',
    category: '외상/스트레스',
    diagnosis: 'PTSD 해리 하위유형',
    case_text: '25세 남성이 1년 전 심각한 교통사고 후 PTSD 진단을 받았다. 최근 면담 중 갑자기 "멍해지면서 여기가 어딘지 모르겠다"는 경험을 보고한다. 때로 자신의 몸이 자기 것이 아닌 것 같고, 주변이 비현실적으로 느껴진다고 한다. 외상 기억을 말할 때 감정이 분리된 것처럼 담담하게 이야기한다.',
    years: ['예상'],
    source: 'predicted',
    questions: [
      { q: 'PTSD 해리 하위유형의 특징은?', keyPoints: ['이인증: 자신과 분리된 느낌', '비현실감: 환경이 비현실적', 'DSM-5에서 하위유형으로 명시', '정서적 과소반응'], tip: '과각성 대신 해리 반응' },
      { q: '치료 시 고려사항은?', keyPoints: ['해리 상태에서 노출치료 효과 감소', '접지(grounding) 기술 우선', '단계적 노출', '안전 확보 중요'], tip: '해리 조절 후 외상 처리' }
    ]
  },

  // ========== 성격장애 심화 ==========
  {
    type: 'major',
    title: '40세 남성 자기애성 성격',
    category: '성격장애',
    diagnosis: '자기애성 성격장애',
    case_text: '40세 남성 사업가가 아내의 권유로 내원했다. 자신은 "특별한 존재"이며 "남들이 나를 질투한다"고 말한다. 직원들이 자신을 충분히 인정하지 않는다고 자주 화를 낸다. 비판에 매우 예민하고, 타인의 성공을 견디기 어려워한다. 공감능력 부족으로 대인관계에서 갈등이 잦다.',
    years: ['예상'],
    source: 'predicted',
    questions: [
      { q: 'NPD 진단 기준과 핵심 특성은?', keyPoints: ['웅대성, 찬사 욕구, 공감 결여', '특권의식', '착취적 대인관계', '취약한 자존감 (이면)'], tip: '과대성 이면의 취약성 파악' },
      { q: '치료적 접근과 어려움은?', keyPoints: ['치료 동기 부족', '치료자 평가절하 가능', '공감 발달 목표', '전이-역전이 관리'], tip: '나르시시스틱 상처에 주의' }
    ]
  },
  {
    type: 'major',
    title: '22세 남성 반사회성 특성',
    category: '성격장애',
    diagnosis: '반사회성 성격장애/품행장애 병력',
    case_text: '22세 남성이 폭행 사건으로 법원 명령에 의해 평가받으러 왔다. 15세 때부터 절도, 무단결석, 싸움이 잦았다. 현재도 충동적이고 무책임하며, 피해자에 대한 죄책감이 없어 보인다. "그 사람이 먼저 시비를 걸었다"며 자신의 행동을 합리화한다.',
    years: ['예상'],
    source: 'predicted',
    questions: [
      { q: 'ASPD 진단 요건은?', keyPoints: ['18세 이상', '15세 이전 품행장애 증거 필요', '법 무시, 속임, 충동성, 공격성', '무책임, 양심 결여'], tip: '품행장애 병력이 필수' },
      { q: '평가 시 유의점은?', keyPoints: ['자기보고 신뢰도 문제', '다중 정보원 필요', 'PCL-R 활용', '꾀병과 감별'], tip: '객관적 행동 기록 중요' }
    ]
  },

  // ========== 신경발달 심화 ==========
  {
    type: 'major',
    title: '8세 남아 ASD 의심',
    category: '신경발달',
    diagnosis: '자폐스펙트럼장애/ADHD',
    case_text: '8세 남아가 또래관계 어려움으로 내원했다. 친구들의 감정을 잘 읽지 못하고, 자기가 관심 있는 공룡 이야기만 일방적으로 한다. 눈 맞춤이 부자연스럽고, 일상의 작은 변화에도 심하게 짜증낸다. 유치원 때부터 "독특한 아이"로 여겨졌다. 언어 발달은 정상이었으나 말투가 어른스럽다.',
    years: ['예상'],
    source: 'predicted',
    questions: [
      { q: 'ASD 핵심 증상 영역은?', keyPoints: ['사회적 의사소통 결함', '제한적/반복적 행동, 관심사', '감각 과민/둔감', '초기 발달력 중요'], tip: '사회성 + 상동성 두 영역' },
      { q: 'ADHD와 감별점은?', keyPoints: ['ASD: 사회적 관심 자체 부족', 'ADHD: 관심은 있으나 부주의로 놓침', '상동행동은 ASD 특징', '공존 가능 (DSM-5부터)'], tip: '사회적 동기 차이가 핵심' }
    ]
  },
  {
    type: 'major',
    title: '10세 여아 학습장애',
    category: '신경발달',
    diagnosis: '특정학습장애/ADHD',
    case_text: '10세 여아가 읽기와 쓰기에 심한 어려움이 있다. 지능검사에서 IQ 105로 정상이나, 읽기 속도가 또래보다 현저히 느리고 글자를 자주 뒤바꿔 읽는다. 받아쓰기 점수가 항상 최하위이다. 수학은 상대적으로 괜찮다. 공부할 때 쉽게 포기하고 자존감이 낮아졌다.',
    years: ['예상'],
    source: 'predicted',
    questions: [
      { q: '특정학습장애 진단 기준은?', keyPoints: ['학업 기술이 연령 기대에 비해 현저히 저조', '지능과 학업성취 간 불일치', '6개월 이상 지속', '읽기, 쓰기, 수학 하위유형'], tip: '지능 정상인데 학업 저조' },
      { q: '평가 구성은?', keyPoints: ['지능검사 (K-WISC)', '학습검사 (BASA, KISE-BAAT)', '언어검사', 'ADHD 동반 평가', '정서적 영향 평가'], tip: '다면적 평가 필요' }
    ]
  },
  {
    type: 'major',
    title: '35세 여성 성인 ADHD',
    category: '신경발달',
    diagnosis: '성인 ADHD/우울장애',
    case_text: '35세 여성 직장인이 "집중을 못 하겠다"며 내원했다. 어릴 때부터 덜렁대고 물건을 자주 잃어버렸으나 "여자애치고 활발하다"고만 여겨졌다. 현재 업무 마감을 자주 어기고, 회의 중 딴생각을 하며, 일을 끝까지 마무리하지 못한다. 이로 인해 우울감과 자책이 심하다.',
    years: ['예상'],
    source: 'predicted',
    questions: [
      { q: '성인 ADHD 평가 시 고려점은?', keyPoints: ['12세 이전 증상 시작 확인', '아동기 기록/보호자 면담', '여성은 부주의형 많아 간과됨', '우울/불안 동반 흔함'], tip: '아동기 증상 확인 필수' },
      { q: 'ADHD와 우울장애 감별점은?', keyPoints: ['ADHD: 평생 지속, 상황 무관', '우울: 삽화적, 흥미저하 동반', '집중력 저하 양쪽 다 가능', '발병 시점이 핵심'], tip: '종단적 병력이 중요' }
    ]
  }
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (key !== 'add2026') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let insertedCases = 0;
    let insertedQuestions = 0;

    for (const caseData of newPredictedCases) {
      // 사례 삽입
      const { data: insertedCase, error: caseError } = await supabase
        .from('interview_cases')
        .insert({
          type: caseData.type,
          title: caseData.title,
          category: caseData.category,
          diagnosis: caseData.diagnosis,
          case_text: caseData.case_text,
          years: caseData.years,
          source: caseData.source
        })
        .select()
        .single();

      if (caseError) {
        console.error('Case insert error:', caseError);
        continue;
      }

      insertedCases++;

      // 질문들 삽입
      for (let i = 0; i < caseData.questions.length; i++) {
        const q = caseData.questions[i];
        const { error: qError } = await supabase
          .from('interview_questions')
          .insert({
            case_id: insertedCase.id,
            question: q.q,
            key_points: q.keyPoints,
            tip: q.tip || null,
            order_num: i + 1,
            source: 'predicted'
          });

        if (!qError) insertedQuestions++;
      }
    }

    return Response.json({
      success: true,
      message: `고빈도 카테고리 심화 예상문제 ${insertedCases}개 사례, ${insertedQuestions}개 질문 추가 완료`,
      categories: ['우울/불안', '강박/정신증', '외상/스트레스', '성격장애', '신경발달']
    });

  } catch (error) {
    console.error('Add cases error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
