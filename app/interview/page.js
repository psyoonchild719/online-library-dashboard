'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  BookOpen, Brain, Scale, ChevronRight, ChevronLeft,
  Eye, EyeOff, Clock, RotateCcw, Home, LogIn, LogOut,
  CheckCircle, AlertCircle, Shuffle, Filter, X
} from 'lucide-react';
import { majorCases, ethicsCases, majorCategories, ethicsCategories } from '../../data/cases';

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 허용된 멤버 목록 (기존 앱과 동일)
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
  const [authLoading, setAuthLoading] = useState(true);

  // 시뮬레이터 상태
  const [caseType, setCaseType] = useState('major'); // 'major' | 'ethics'
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showCase, setShowCase] = useState(true);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [practiceLog, setPracticeLog] = useState([]);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // 현재 유형의 사례 및 카테고리 목록
  const currentCases = caseType === 'major' ? majorCases : ethicsCases;
  const currentCategories = caseType === 'major' ? majorCategories : ethicsCategories;

  // 필터링된 사례 목록
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
  }, [caseType, selectedCategory]);

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
          </div>
          <div className="flex items-center gap-3">
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
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setCaseType('major')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
              caseType === 'major'
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            전공 ({majorCases.length})
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
            윤리 ({ethicsCases.length})
          </button>
        </div>

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
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    caseType === 'major' ? 'bg-blue-500/30 text-blue-300' : 'bg-green-500/30 text-green-300'
                  }`}>
                    {currentCase.category}
                  </span>
                  <h2 className="text-lg font-bold text-white mt-2">{currentCase.title}</h2>
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
          </div>
        )}
      </main>
    </div>
  );
}
