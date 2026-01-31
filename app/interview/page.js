'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  BookOpen, Brain, Scale, ChevronRight, ChevronLeft,
  Eye, EyeOff, Clock, RotateCcw, Home, LogIn, LogOut,
  CheckCircle, AlertCircle, Shuffle, Database, Settings
} from 'lucide-react';
import Link from 'next/link';

// Fallback: 하드코딩된 데이터 (DB 실패 시 사용)
import { majorCases, ethicsCases, majorCategories, ethicsCategories, predictedCases } from '../../data/cases';

// Supabase 클라이언트 설정
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

export default function InterviewSimulator() {
  // 인증 상태
  const [user, setUser] = useState(null);
  const [currentMember, setCurrentMember] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // DB 상태
  const [useDatabase, setUseDatabase] = useState(true);
  const [dbCases, setDbCases] = useState({ major: [], ethics: [] });
  const [dbLoading, setDbLoading] = useState(true);

  // 시뮬레이터 상태
  const [caseType, setCaseType] = useState('major');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showCase, setShowCase] = useState(true);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [includePredicted, setIncludePredicted] = useState(false);
  const [practiceCount, setPracticeCount] = useState(0);

  // DB에서 사례 로드
  const loadCasesFromDB = useCallback(async () => {
    setDbLoading(true);
    try {
      const { data: casesData, error: casesError } = await supabase
        .from('interview_cases')
        .select(`
          *,
          interview_questions (*)
        `)
        .order('id');

      if (casesError) throw casesError;

      const majorList = [];
      const ethicsList = [];

      casesData?.forEach(c => {
        const formatted = {
          id: c.id,
          title: c.title,
          category: c.category,
          diagnosis: c.diagnosis,
          topic: c.topic,
          caseText: c.case_text,
          years: c.years || [],
          source: c.source,
          questions: (c.interview_questions || [])
            .sort((a, b) => a.order_num - b.order_num)
            .map(q => ({
              q: q.question,
              keyPoints: q.key_points || [],
              tip: q.tip
            }))
        };

        if (c.type === 'major') {
          majorList.push(formatted);
        } else if (c.type === 'ethics') {
          ethicsList.push(formatted);
        }
      });

      setDbCases({ major: majorList, ethics: ethicsList });
    } catch (error) {
      console.error('DB 로드 실패:', error);
      setUseDatabase(false);
    } finally {
      setDbLoading(false);
    }
  }, []);

  // 탭별 카운트 (독립적으로 계산)
  const useDb = useDatabase && (dbCases.major.length > 0 || dbCases.ethics.length > 0);
  const majorExamCount = useDb
    ? dbCases.major.filter(c => c.source === 'exam').length
    : majorCases.length;
  const majorPredictedCount = useDb
    ? dbCases.major.filter(c => c.source === 'predicted').length
    : predictedCases.length;
  const ethicsCount = useDb ? dbCases.ethics.length : ethicsCases.length;

  // 현재 사용할 데이터 소스 결정
  const getDataSource = () => {
    if (useDb) {
      const baseCases = caseType === 'major' ? dbCases.major : dbCases.ethics;
      if (caseType === 'major' && includePredicted) {
        return [...baseCases];
      }
      if (caseType === 'major') {
        return baseCases.filter(c => c.source === 'exam');
      }
      return baseCases;
    } else {
      const baseCases = caseType === 'major' ? majorCases : ethicsCases;
      if (caseType === 'major' && includePredicted) {
        return [...baseCases, ...predictedCases];
      }
      return baseCases;
    }
  };

  const currentCases = getDataSource();
  const currentCategories = caseType === 'major' ? majorCategories : ethicsCategories;

  const filteredCases = currentCases.filter(c => {
    if (selectedCategory !== '전체' && c.category !== selectedCategory) return false;
    return true;
  });

  const currentCase = filteredCases[currentCaseIndex];
  const currentQuestion = currentCase?.questions?.[currentQuestionIndex];

  // 인증 상태 확인
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
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
    }
  }, [user]);

  const loadCurrentMember = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('email', user.email)
      .single();
    if (data) setCurrentMember(data);
  };

  // DB에서 사례 로드
  useEffect(() => {
    loadCasesFromDB();
  }, [loadCasesFromDB]);

  // 오늘 연습 횟수 로드
  useEffect(() => {
    if (currentMember) {
      loadTodayPracticeCount();
    }
  }, [currentMember]);

  const loadTodayPracticeCount = async () => {
    if (!currentMember) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('interview_logs')
      .select('*', { count: 'exact', head: true })
      .eq('member_id', currentMember.id)
      .gte('created_at', today.toISOString());

    setPracticeCount(count || 0);
  };

  // 연습 기록 저장
  const logPractice = async () => {
    if (!currentMember || !currentCase) return;

    try {
      await supabase.from('interview_logs').insert({
        member_id: currentMember.id,
        case_id: currentCase.id,
        time_spent: timer
      });
      setPracticeCount(prev => prev + 1);
    } catch (error) {
      console.error('연습 기록 저장 실패:', error);
    }
  };

  // 타이머
  useEffect(() => {
    let interval;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // 카테고리 변경 시 인덱스 리셋
  useEffect(() => {
    setCurrentCaseIndex(0);
    setCurrentQuestionIndex(0);
    setShowAnswer(false);
  }, [caseType, selectedCategory, includePredicted]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/interview' }
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const nextCase = () => {
    if (timer > 30) logPractice();

    if (currentCaseIndex < filteredCases.length - 1) {
      setCurrentCaseIndex(prev => prev + 1);
      setCurrentQuestionIndex(0);
      setShowAnswer(false);
      setTimer(0);
    }
  };

  const prevCase = () => {
    if (currentCaseIndex > 0) {
      setCurrentCaseIndex(prev => prev - 1);
      setCurrentQuestionIndex(0);
      setShowAnswer(false);
      setTimer(0);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion && currentQuestionIndex < currentCase.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setShowAnswer(false);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setShowAnswer(false);
    }
  };

  const randomCase = () => {
    if (timer > 30) logPractice();

    const randomIndex = Math.floor(Math.random() * filteredCases.length);
    setCurrentCaseIndex(randomIndex);
    setCurrentQuestionIndex(0);
    setShowAnswer(false);
    setTimer(0);
  };

  const isAllowed = user && ALLOWED_MEMBERS[user.email];

  // 로딩 화면
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 text-lg">로딩 중...</div>
      </div>
    );
  }

  // 로그인 필요 화면
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl border border-gray-100">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">면접 시뮬레이터</h1>
          <p className="text-gray-500 mb-6">임상심리전문가 자격시험 면접 연습</p>
          <button
            onClick={signInWithGoogle}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
          >
            <LogIn className="w-5 h-5" />
            Google로 로그인
          </button>
        </div>
      </div>
    );
  }

  // 비허용 사용자 화면
  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl border border-gray-100">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">접근 권한 없음</h2>
          <p className="text-gray-500 mb-4">스터디 멤버만 이용 가능합니다.</p>
          <p className="text-gray-400 text-sm mb-6">{user.email}</p>
          <button
            onClick={signOut}
            className="bg-gray-100 text-gray-600 py-2 px-6 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-gray-600 transition p-1">
              <Home className="w-5 h-5" />
            </a>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Brain className="w-4 h-4 text-indigo-600" />
              </div>
              <h1 className="text-lg font-bold text-gray-800">면접 시뮬레이터</h1>
            </div>
            {/* DB 상태 표시 */}
            <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
              useDb && !dbLoading
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-amber-50 text-amber-600 border border-amber-200'
            }`}>
              <Database className="w-3 h-3" />
              {dbLoading ? '로딩' : useDb ? 'DB' : '파일'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* 오늘 연습 횟수 */}
            <span className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-medium border border-indigo-100">
              오늘 {practiceCount}건
            </span>
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
              <img
                src={user.user_metadata?.avatar_url || '/default-avatar.png'}
                alt="프로필"
                className="w-6 h-6 rounded-full"
              />
              <span className="text-sm text-gray-700 font-medium">
                {ALLOWED_MEMBERS[user.email]?.name}
              </span>
            </div>
            <button
              onClick={signOut}
              className="text-gray-400 hover:text-gray-600 transition p-1"
              title="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 유형 선택 탭 */}
        <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-200 flex gap-1 mb-4">
          <button
            onClick={() => setCaseType('major')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
              caseType === 'major'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            전공 ({includePredicted ? majorExamCount + majorPredictedCount : majorExamCount})
          </button>
          <button
            onClick={() => setCaseType('ethics')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
              caseType === 'ethics'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Scale className="w-5 h-5" />
            윤리 ({ethicsCount})
          </button>
        </div>

        {/* 예상문제 포함 토글 (전공일 때만) */}
        {caseType === 'major' && (
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/interview/admin"
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-violet-600 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm hover:border-violet-300 transition"
            >
              <Settings className="w-4 h-4" />
              예상문제 관리
            </Link>
            <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
              <input
                type="checkbox"
                checked={includePredicted}
                onChange={(e) => setIncludePredicted(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-violet-500 focus:ring-violet-500"
              />
              <span className="text-sm text-gray-600">
                🔮 예상문제 포함 <span className="text-violet-500 font-medium">+{majorPredictedCount}</span>
              </span>
            </label>
          </div>
        )}

        {/* 카테고리 필터 */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {currentCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition border ${
                selectedCategory === cat
                  ? caseType === 'major'
                    ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-200'
                    : 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 컨트롤 바 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm font-medium bg-white px-3 py-1.5 rounded-lg border border-gray-200">
              {currentCaseIndex + 1} / {filteredCases.length}
            </span>
            <button
              onClick={randomCase}
              className="p-2 bg-white rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition border border-gray-200"
              title="랜덤 사례"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 border ${
                isTimerRunning
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Clock className="w-4 h-4" />
              {formatTime(timer)}
            </button>
            <button
              onClick={() => setTimer(0)}
              className="p-2 bg-white rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition border border-gray-200"
              title="타이머 리셋"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {currentCase ? (
          <>
            {/* 사례 카드 */}
            <div className="bg-white rounded-2xl border border-gray-200 mb-4 overflow-hidden shadow-sm">
              {/* 사례 헤더 */}
              <div className="p-5 border-b border-gray-100 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      caseType === 'major'
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    }`}>
                      {currentCase.category}
                    </span>
                    {currentCase.source === 'predicted' && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-200 font-medium">
                        🔮 예상
                      </span>
                    )}
                    {currentCase.years?.map(year => (
                      <span key={year} className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full">
                        {year}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-lg font-bold text-gray-800">{currentCase.title}</h2>
                  {currentCase.diagnosis && (
                    <p className="text-sm text-gray-500 mt-1">
                      <span className="font-medium text-gray-600">진단:</span> {currentCase.diagnosis}
                    </p>
                  )}
                  {currentCase.topic && (
                    <p className="text-sm text-gray-500 mt-1">
                      <span className="font-medium text-gray-600">주제:</span> {currentCase.topic}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowCase(!showCase)}
                  className="p-2 bg-gray-50 rounded-lg text-gray-500 hover:bg-gray-100 transition ml-4"
                >
                  {showCase ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* 사례 내용 */}
              {showCase && (
                <div className="p-5 bg-gray-50 border-t border-gray-100">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {currentCase.caseText}
                  </p>
                </div>
              )}
            </div>

            {/* 질문 카드 */}
            {currentQuestion && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-500 font-medium">
                    질문 {currentQuestionIndex + 1} / {currentCase.questions.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={prevQuestion}
                      disabled={currentQuestionIndex === 0}
                      className="p-2 bg-gray-50 rounded-lg text-gray-500 hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={nextQuestion}
                      disabled={currentQuestionIndex === currentCase.questions.length - 1}
                      className="p-2 bg-gray-50 rounded-lg text-gray-500 hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-gray-800 text-lg font-medium mb-5 leading-relaxed">{currentQuestion.q}</p>

                <button
                  onClick={() => setShowAnswer(!showAnswer)}
                  className={`w-full py-3.5 rounded-xl font-medium transition ${
                    showAnswer
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                  }`}
                >
                  {showAnswer ? '핵심 포인트 숨기기' : '핵심 포인트 보기'}
                </button>

                {showAnswer && currentQuestion.keyPoints && (
                  <div className="mt-5 p-5 bg-amber-50 rounded-xl border border-amber-200">
                    <h4 className="text-amber-800 font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      핵심 포인트
                    </h4>
                    <ul className="space-y-2.5">
                      {currentQuestion.keyPoints.map((point, idx) => (
                        <li key={idx} className="text-gray-700 flex items-start gap-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                    {currentQuestion.tip && (
                      <div className="mt-4 pt-4 border-t border-amber-200">
                        <p className="text-sm text-violet-700 flex items-start gap-2">
                          <span>💡</span>
                          <span><strong>Tip:</strong> {currentQuestion.tip}</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 네비게이션 */}
            <div className="flex gap-3">
              <button
                onClick={prevCase}
                disabled={currentCaseIndex === 0}
                className="flex-1 py-3.5 bg-white rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-200 shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
                이전 사례
              </button>
              <button
                onClick={nextCase}
                disabled={currentCaseIndex === filteredCases.length - 1}
                className="flex-1 py-3.5 bg-white rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-200 shadow-sm"
              >
                다음 사례
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">해당 카테고리에 사례가 없습니다.</p>
            {dbLoading && (
              <p className="text-gray-400 text-sm mt-2">데이터 로딩 중...</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
