'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, Brain, CheckCircle, FileText, ChevronDown, ChevronUp,
  Calendar, Clock, Trash2, AlertCircle
} from 'lucide-react';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 허용된 멤버 목록
const ALLOWED_MEMBERS = {
  'psyoonchild@gmail.com': { name: '김지윤', avatar: '🦊' },
  'pit-a-pat@hotmail.co.kr': { name: '조하나', avatar: '🐰' },
  'khk9440@ewhain.net': { name: '곽호경', avatar: '🐻' },
  'youjin13ae@gmail.com': { name: '배유진', avatar: '🐱' },
  'hipsychology@gmail.com': { name: '황해인', avatar: '🐶' },
  'dawoon85@gmail.com': { name: '정다운', avatar: '🐼' },
};

export default function MyAnswersPage() {
  const [user, setUser] = useState(null);
  const [currentMember, setCurrentMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState([]);
  const [cases, setCases] = useState({});
  const [expandedCases, setExpandedCases] = useState({});
  const [filter, setFilter] = useState('all'); // 'all' | 'major' | 'ethics'

  // 인증 확인
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 멤버 정보 로드
  useEffect(() => {
    if (user && ALLOWED_MEMBERS[user.email]) {
      loadCurrentMember();
    } else if (user) {
      setLoading(false);
    }
  }, [user]);

  const loadCurrentMember = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('email', user.email)
      .single();
    if (data) {
      setCurrentMember(data);
    }
    setLoading(false);
  };

  // 답안 로드
  const loadAnswers = useCallback(async () => {
    if (!currentMember) return;

    try {
      // 답안과 사례 정보를 함께 로드
      const { data: answersData, error: answersError } = await supabase
        .from('interview_answers')
        .select('*')
        .eq('member_id', currentMember.id)
        .order('updated_at', { ascending: false });

      if (answersError) throw answersError;

      // 사례 정보 로드
      const { data: casesData, error: casesError } = await supabase
        .from('interview_cases')
        .select(`
          *,
          interview_questions (*)
        `);

      if (casesError) throw casesError;

      // 사례 정보를 맵으로 변환
      const casesMap = {};
      casesData?.forEach(c => {
        casesMap[c.id] = {
          ...c,
          questions: (c.interview_questions || []).sort((a, b) => a.order_num - b.order_num)
        };
      });

      setCases(casesMap);
      setAnswers(answersData || []);
    } catch (error) {
      console.error('답안 로드 실패:', error);
    }
  }, [currentMember]);

  useEffect(() => {
    if (currentMember) {
      loadAnswers();
    }
  }, [currentMember, loadAnswers]);

  // 답안 삭제
  const handleDeleteAnswer = async (answerId) => {
    if (!confirm('이 답안을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('interview_answers')
        .delete()
        .eq('id', answerId);

      if (error) throw error;
      loadAnswers();
    } catch (error) {
      console.error('답안 삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 사례별로 답안 그룹화
  const groupedAnswers = answers.reduce((acc, answer) => {
    const caseInfo = cases[answer.case_id];
    if (!caseInfo) return acc;

    // 필터 적용
    if (filter !== 'all' && caseInfo.type !== filter) return acc;

    if (!acc[answer.case_id]) {
      acc[answer.case_id] = {
        caseInfo,
        answers: []
      };
    }
    acc[answer.case_id].answers.push(answer);
    return acc;
  }, {});

  const toggleCase = (caseId) => {
    setExpandedCases(prev => ({
      ...prev,
      [caseId]: !prev[caseId]
    }));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalAnswers = answers.filter(a => {
    const caseInfo = cases[a.case_id];
    if (!caseInfo) return false;
    if (filter === 'all') return true;
    return caseInfo.type === filter;
  }).length;

  const isAllowed = user && ALLOWED_MEMBERS[user.email];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (!user || !isAllowed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center shadow-sm border">
          <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 text-sm mb-4">로그인이 필요합니다</p>
          <Link href="/interview" className="text-blue-600 hover:underline text-sm">
            면접 시뮬레이터로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/interview" className="text-gray-400 hover:text-gray-600 transition p-1">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <h1 className="text-sm font-bold text-gray-800">내 답안 모아보기</h1>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full font-medium border border-emerald-100">
            총 {totalAnswers}개
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 py-4">
        {/* 필터 */}
        <div className="flex gap-1.5 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter('major')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === 'major'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            전공
          </button>
          <button
            onClick={() => setFilter('ethics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === 'ethics'
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            윤리
          </button>
        </div>

        {/* 답안 목록 */}
        {Object.keys(groupedAnswers).length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">작성된 답안이 없습니다</p>
            <p className="text-gray-400 text-xs mt-1">면접 시뮬레이터에서 답안을 작성해보세요!</p>
            <Link
              href="/interview"
              className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition"
            >
              면접 연습하기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedAnswers).map(([caseId, { caseInfo, answers: caseAnswers }]) => (
              <div key={caseId} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* 사례 헤더 */}
                <button
                  onClick={() => toggleCase(caseId)}
                  className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-2 text-left">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                      caseInfo.source === 'exam'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-violet-100 text-violet-700'
                    }`}>
                      {caseInfo.case_id}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      caseInfo.type === 'major'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {caseInfo.type === 'major' ? '전공' : '윤리'}
                    </span>
                    <span className="text-xs font-medium text-gray-800 truncate max-w-[200px]">
                      {caseInfo.title || caseInfo.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">
                      {caseAnswers.length}개 답안
                    </span>
                    {expandedCases[caseId] ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* 답안 목록 */}
                {expandedCases[caseId] && (
                  <div className="border-t divide-y">
                    {caseAnswers
                      .sort((a, b) => a.question_index - b.question_index)
                      .map(answer => {
                        const question = caseInfo.questions?.[answer.question_index];
                        return (
                          <div key={answer.id} className="p-3 bg-gray-50">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                                  Q{answer.question_index + 1}
                                </span>
                                {answer.checked_points?.length > 0 && (
                                  <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                                    <CheckCircle className="w-3 h-3" />
                                    {answer.checked_points.length}개 체크
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(answer.updated_at)}
                                </span>
                                <button
                                  onClick={() => handleDeleteAnswer(answer.id)}
                                  className="p-1 text-gray-400 hover:text-red-500 transition"
                                  title="삭제"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {question && (
                              <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                                {question.question}
                              </p>
                            )}
                            <div className="bg-white rounded-lg p-2 border">
                              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {answer.answer || '(답안 없음)'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
