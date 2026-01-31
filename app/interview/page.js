'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  BookOpen, Brain, Scale, ChevronRight, ChevronLeft,
  Eye, EyeOff, Clock, RotateCcw, Home, LogIn, LogOut,
  CheckCircle, AlertCircle, Shuffle, Database, RefreshCw
} from 'lucide-react';

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
      console.log(`DB 로드 완료: 전공 ${majorList.length}건, 윤리 ${ethicsList.length}건`);
    } catch (error) {
      console.error('DB 로드 실패:', error);
      setUseDatabase(false);
    } finally {
      setDbLoading(false);
    }
  }, []);

  // 현재 사용할 데이터 소스 결정
  const getDataSource = () => {
    if (useDatabase && (dbCases.major.length > 0 || dbCases.ethics.length > 0)) {
      const baseCases = caseType === 'major' ? dbCases.major : dbCases.ethics;
      if (caseType === 'major' && includePredicted) {
        const examCases = baseCases.filter(c => c.source === 'exam');
        const predicted = baseCases.filter(c => c.source === 'predicted');
        return { cases: [...examCases, ...predicted], examCount: examCases.length, predictedCount: predicted.length };
      }
      const examCases = baseCases.filter(c => c.source === 'exam');
      const predicted = baseCases.filter(c => c.source === 'predicted');
      return { cases: examCases, examCount: examCases.length, predictedCount: predicted.length };
    } else {
      const baseCases = caseType === 'major' ? majorCases : ethicsCases;
      if (caseType === 'major' && includePredicted) {
        return { cases: [...baseCases, ...predictedCases], examCount: baseCases.length, predictedCount: predictedCases.length };
      }
      return { cases: baseCases, examCount: baseCases.length, predictedCount: predictedCases.length };
    }
  };

  const { cases: currentCases, examCount, predictedCount } = getDataSource();
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">로딩 중...</div>
      </div>
    );
  }

  // 로그인 필요 화면
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md w-full text-center border border-white/20">
          <Brain className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">면접 시뮬레이터</h1>
          <p className="text-gray-300 mb-6">임상심리전문가 자격시험 면접 연습</p>
          <button
            onClick={signInWithGoogle}
            className="w-full bg-white text-gray-800 py-3 px-4 rounded-xl font-medium hover:bg-gray-100 transition flex items-center justify-center gap-2"
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md w-full text-center border border-white/20">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">접근 권한 없음</h2>
          <p className="text-gray-300 mb-4">스터디 멤버만 이용 가능합니다.</p>
          <p className="text-gray-400 text-sm mb-6">{user.email}</p>
          <button
            onClick={signOut}
            className="bg-red-500/20 text-red-300 py-2 px-4 rounded-lg hover:bg-red-500/30 transition"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* 헤더 */}
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-gray-400 hover:text-white transition">
              <Home className="w-5 h-5" />
            </a>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              면접 시뮬레이터
            </h1>
            {/* DB 상태 표시 */}
            <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
              useDatabase && !dbLoading ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
            }`}>
              <Database className="w-3 h-3" />
              {dbLoading ? '로딩' : useDatabase ? 'DB' : '파일'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* 오늘 연습 횟수 */}
            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">
              오늘 {practiceCount}건 연습
            </span>
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
              <img
                src={user.user_metadata?.avatar_url || '/default-avatar.png'}
                alt="프로필"
                className="w-6 h-6 rounded-full"
              />
              <span className="text-sm text-gray-300 font-medium">
                {ALLOWED_MEMBERS[user.email]?.name}
              </span>
            </div>
            <button
              onClick={signOut}
              className="text-gray-400 hover:text-white transition"
              title="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* 유형 선택 탭 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setCaseType('major')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
              caseType === 'major'
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            전공 ({includePredicted ? examCount + predictedCount : examCount})
          </button>
          <button
            onClick={() => setCaseType('ethics')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
              caseType === 'ethics'
                ? 'bg-green-500 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <Scale className="w-5 h-5" />
            윤리 ({useDatabase ? dbCases.ethics.length : ethicsCases.length})
          </button>
        </div>

        {/* 예상문제 포함 토글 (전공일 때만) */}
        {caseType === 'major' && (
          <div className="flex items-center justify-end gap-2 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includePredicted}
                onChange={(e) => setIncludePredicted(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-300">
                🔮 DSM-5-TR 예상문제 포함 (+{predictedCount}건)
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
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                selectedCategory === cat
                  ? caseType === 'major' ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 컨트롤 바 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">
              {currentCaseIndex + 1} / {filteredCases.length}
            </span>
            <button
              onClick={randomCase}
              className="p-2 bg-white/10 rounded-lg text-gray-300 hover:bg-white/20 transition"
              title="랜덤 사례"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
                isTimerRunning ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-gray-300'
              }`}
            >
              <Clock className="w-4 h-4" />
              {formatTime(timer)}
            </button>
            <button
              onClick={() => setTimer(0)}
              className="p-2 bg-white/10 rounded-lg text-gray-300 hover:bg-white/20 transition"
              title="타이머 리셋"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {currentCase ? (
          <>
            {/* 사례 카드 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 mb-4 overflow-hidden">
              {/* 사례 헤더 */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      caseType === 'major' ? 'bg-blue-500/30 text-blue-300' : 'bg-green-500/30 text-green-300'
                    }`}>
                      {currentCase.category}
                    </span>
                    {currentCase.source === 'predicted' && (
                      <span className="text-xs px-2 py-1 rounded-full bg-purple-500/30 text-purple-300">
                        🔮 예상
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-white">{currentCase.title}</h2>
                  {currentCase.diagnosis && (
                    <p className="text-sm text-gray-400 mt-1">진단: {currentCase.diagnosis}</p>
                  )}
                  {currentCase.topic && (
                    <p className="text-sm text-gray-400 mt-1">주제: {currentCase.topic}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {currentCase.years?.map(year => (
                    <span key={year} className="text-xs px-2 py-1 bg-purple-500/30 text-purple-300 rounded">
                      {year}
                    </span>
                  ))}
                  <button
                    onClick={() => setShowCase(!showCase)}
                    className="p-2 bg-white/10 rounded-lg text-gray-300 hover:bg-white/20 transition"
                  >
                    {showCase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 사례 내용 */}
              {showCase && (
                <div className="p-4 bg-black/20">
                  <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {currentCase.caseText}
                  </p>
                </div>
              )}
            </div>

            {/* 질문 카드 */}
            {currentQuestion && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">
                    질문 {currentQuestionIndex + 1} / {currentCase.questions.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={prevQuestion}
                      disabled={currentQuestionIndex === 0}
                      className="p-1.5 bg-white/10 rounded-lg text-gray-300 hover:bg-white/20 transition disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={nextQuestion}
                      disabled={currentQuestionIndex === currentCase.questions.length - 1}
                      className="p-1.5 bg-white/10 rounded-lg text-gray-300 hover:bg-white/20 transition disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-white text-lg font-medium mb-4">{currentQuestion.q}</p>

                <button
                  onClick={() => setShowAnswer(!showAnswer)}
                  className={`w-full py-3 rounded-xl font-medium transition ${
                    showAnswer
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : 'bg-purple-500 text-white hover:bg-purple-600'
                  }`}
                >
                  {showAnswer ? '핵심 포인트 숨기기' : '핵심 포인트 보기'}
                </button>

                {showAnswer && currentQuestion.keyPoints && (
                  <div className="mt-4 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
                    <h4 className="text-yellow-300 font-medium mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      핵심 포인트
                    </h4>
                    <ul className="space-y-2">
                      {currentQuestion.keyPoints.map((point, idx) => (
                        <li key={idx} className="text-gray-200 flex items-start gap-2">
                          <span className="text-yellow-400">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                    {currentQuestion.tip && (
                      <p className="mt-3 text-sm text-purple-300 italic">
                        💡 Tip: {currentQuestion.tip}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 네비게이션 */}
            <div className="flex gap-4">
              <button
                onClick={prevCase}
                disabled={currentCaseIndex === 0}
                className="flex-1 py-3 bg-white/10 rounded-xl text-gray-300 font-medium hover:bg-white/20 transition disabled:opacity-30 flex items-center justify-center gap-2"
              >
                <ChevronLeft className="w-5 h-5" />
                이전 사례
              </button>
              <button
                onClick={nextCase}
                disabled={currentCaseIndex === filteredCases.length - 1}
                className="flex-1 py-3 bg-white/10 rounded-xl text-gray-300 font-medium hover:bg-white/20 transition disabled:opacity-30 flex items-center justify-center gap-2"
              >
                다음 사례
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-300">해당 카테고리에 사례가 없습니다.</p>
            {dbLoading && (
              <p className="text-gray-400 text-sm mt-2">데이터 로딩 중...</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
