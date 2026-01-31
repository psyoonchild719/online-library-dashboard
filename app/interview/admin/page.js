'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Plus, Trash2, Edit3, Save, X, ChevronDown, ChevronUp,
  Home, Brain, AlertCircle, LogOut, Loader2, ArrowLeft
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 허용된 멤버 목록 (모든 스터디 멤버 접근 가능)
const ALLOWED_MEMBERS = {
  'psyoonchild@gmail.com': { name: '김지윤', avatar: '🦊' },
  'pit-a-pat@hotmail.co.kr': { name: '조하나', avatar: '🐰' },
  'khk9440@ewhain.net': { name: '곽호경', avatar: '🐻' },
  'youjin13ae@gmail.com': { name: '배유진', avatar: '🐱' },
  'hipsychology@gmail.com': { name: '황해인', avatar: '🐶' },
  'dawoon85@gmail.com': { name: '정다운', avatar: '🐼' },
};

// 카테고리 옵션
// 전공 카테고리
const MAJOR_CATEGORIES = [
  '강박/정신증', '우울/불안', '외상/스트레스', '성격장애', '신경발달',
  '신체증상', '꾀병', '섭식장애', '해리장애', '물질관련', '신경인지', '충동조절'
];

// 윤리 카테고리
const ETHICS_CATEGORIES = [
  '비밀유지/기록', '검사보안/평가', '다중관계', '신고의무', '동료윤리', '전문성', '무자격자', '동의/정보', '연구윤리'
];

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCase, setExpandedCase] = useState(null);
  const [editingCase, setEditingCase] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showAddCase, setShowAddCase] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(null);
  const [saving, setSaving] = useState(false);

  // 필터 상태
  const [caseType, setCaseType] = useState('major'); // 'major' | 'ethics'
  const [sourceFilter, setSourceFilter] = useState('all'); // 'exam' | 'predicted' | 'all'

  // 새 사례 폼
  const [newCase, setNewCase] = useState({
    title: '', category: '우울/불안', diagnosis: '', topic: '', case_text: '', source: 'predicted', type: 'major'
  });

  // 새 질문 폼
  const [newQuestion, setNewQuestion] = useState({
    question: '', key_points: '', tip: ''
  });

  // 인증 확인
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

  // 사례 로드
  useEffect(() => {
    if (user && ALLOWED_MEMBERS[user.email]) {
      loadCases();
    }
  }, [user, caseType, sourceFilter]);

  const loadCases = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('interview_cases')
        .select(`*, interview_questions (*)`)
        .eq('type', caseType)
        .order('id', { ascending: false });

      if (sourceFilter !== 'all') {
        query = query.eq('source', sourceFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCases(data || []);
    } catch (error) {
      console.error('로드 실패:', error);
      alert('데이터 로드 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 사례 추가
  const handleAddCase = async () => {
    if (!newCase.title || !newCase.case_text) {
      alert('제목과 사례 내용은 필수입니다.');
      return;
    }

    setSaving(true);
    try {
      // 연도 파싱 (쉼표로 구분된 문자열 → 배열)
      let yearsArray = ['예상'];
      if (newCase.source === 'exam' && newCase.years) {
        yearsArray = newCase.years.split(',').map(y => y.trim()).filter(y => y);
      }

      const insertData = {
        type: newCase.type,
        title: newCase.title,
        category: newCase.category,
        case_text: newCase.case_text,
        years: yearsArray,
        source: newCase.source
      };

      // 전공이면 diagnosis, 윤리면 topic
      if (newCase.type === 'major') {
        insertData.diagnosis = newCase.diagnosis || null;
      } else {
        insertData.topic = newCase.topic || null;
      }

      const { error } = await supabase.from('interview_cases').insert(insertData);

      if (error) throw error;

      setNewCase({ title: '', category: caseType === 'major' ? '우울/불안' : '비밀유지/기록', diagnosis: '', topic: '', case_text: '', source: 'predicted', type: caseType, years: '' });
      setShowAddCase(false);
      loadCases();
    } catch (error) {
      alert('추가 실패: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 사례 수정
  const handleUpdateCase = async (caseData) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('interview_cases')
        .update({
          title: caseData.title,
          category: caseData.category,
          diagnosis: caseData.diagnosis,
          case_text: caseData.case_text
        })
        .eq('id', caseData.id);

      if (error) throw error;

      setEditingCase(null);
      loadCases();
    } catch (error) {
      alert('수정 실패: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 사례 삭제
  const handleDeleteCase = async (caseId) => {
    if (!confirm('이 사례와 모든 질문을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('interview_cases')
        .delete()
        .eq('id', caseId);

      if (error) throw error;
      loadCases();
    } catch (error) {
      alert('삭제 실패: ' + error.message);
    }
  };

  // 질문 추가
  const handleAddQuestion = async (caseId) => {
    if (!newQuestion.question) {
      alert('질문 내용은 필수입니다.');
      return;
    }

    setSaving(true);
    try {
      const keyPointsArray = newQuestion.key_points
        .split('\n')
        .map(s => s.trim())
        .filter(s => s);

      const { error } = await supabase.from('interview_questions').insert({
        case_id: caseId,
        question: newQuestion.question,
        key_points: keyPointsArray,
        tip: newQuestion.tip || null,
        order_num: 1,
        source: 'predicted'
      });

      if (error) throw error;

      setNewQuestion({ question: '', key_points: '', tip: '' });
      setShowAddQuestion(null);
      loadCases();
    } catch (error) {
      alert('질문 추가 실패: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 질문 수정
  const handleUpdateQuestion = async (questionData) => {
    setSaving(true);
    try {
      const keyPointsArray = Array.isArray(questionData.key_points)
        ? questionData.key_points
        : questionData.key_points.split('\n').map(s => s.trim()).filter(s => s);

      const { error } = await supabase
        .from('interview_questions')
        .update({
          question: questionData.question,
          key_points: keyPointsArray,
          tip: questionData.tip
        })
        .eq('id', questionData.id);

      if (error) throw error;

      setEditingQuestion(null);
      loadCases();
    } catch (error) {
      alert('질문 수정 실패: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 질문 삭제
  const handleDeleteQuestion = async (questionId) => {
    if (!confirm('이 질문을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('interview_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;
      loadCases();
    } catch (error) {
      alert('질문 삭제 실패: ' + error.message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // 로딩 화면
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // 비로그인
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl border border-gray-100">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">로그인이 필요합니다</h2>
          <a href="/interview" className="text-indigo-600 hover:underline">
            면접 시뮬레이터로 이동하여 로그인
          </a>
        </div>
      </div>
    );
  }

  // 권한 없음
  if (!ALLOWED_MEMBERS[user.email]) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl border border-gray-100">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">스터디 멤버만 접근 가능</h2>
          <p className="text-gray-500 mb-4">{user.email}</p>
          <button onClick={signOut} className="text-gray-500 hover:text-gray-700">
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
            <a href="/interview" className="text-gray-400 hover:text-gray-600 transition p-1">
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                <Brain className="w-4 h-4 text-violet-600" />
              </div>
              <h1 className="text-lg font-bold text-gray-800">사례 관리</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
            <button onClick={signOut} className="text-gray-400 hover:text-gray-600 transition p-1" title="로그아웃">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* 필터 탭 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6">
          {/* 전공/윤리 탭 */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => { setCaseType('major'); setSourceFilter('all'); }}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                caseType === 'major' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              전공
            </button>
            <button
              onClick={() => { setCaseType('ethics'); setSourceFilter('all'); }}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                caseType === 'ethics' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              윤리
            </button>
          </div>
          {/* 기출/예상 필터 */}
          <div className="flex gap-2">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                sourceFilter === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              전체 ({cases.length})
            </button>
            <button
              onClick={() => setSourceFilter('exam')}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                sourceFilter === 'exam' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              📚 기출
            </button>
            <button
              onClick={() => setSourceFilter('predicted')}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                sourceFilter === 'predicted' ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🔮 예상
            </button>
          </div>
        </div>

        {/* 상단 액션 */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            {caseType === 'major' ? '전공' : '윤리'} · {sourceFilter === 'all' ? '전체' : sourceFilter === 'exam' ? '기출' : '예상'}
            <span className="font-bold text-indigo-600 ml-1">{cases.length}</span>개
          </p>
          <button
            onClick={() => {
              setNewCase({
                title: '',
                category: caseType === 'major' ? '우울/불안' : '비밀유지/기록',
                diagnosis: '',
                topic: '',
                case_text: '',
                source: 'predicted',
                type: caseType,
                years: ''
              });
              setShowAddCase(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
          >
            <Plus className="w-5 h-5" />
            새 사례 추가
          </button>
        </div>

        {/* 새 사례 추가 폼 */}
        {showAddCase && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4">
              새 {newCase.type === 'major' ? '전공' : '윤리'} 사례 추가
            </h3>
            <div className="space-y-4">
              {/* 유형 및 소스 선택 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
                  <select
                    value={newCase.type}
                    onChange={(e) => setNewCase({
                      ...newCase,
                      type: e.target.value,
                      category: e.target.value === 'major' ? '우울/불안' : '비밀유지/기록'
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="major">전공</option>
                    <option value="ethics">윤리</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">구분</label>
                  <select
                    value={newCase.source}
                    onChange={(e) => setNewCase({ ...newCase, source: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="exam">📚 기출</option>
                    <option value="predicted">🔮 예상</option>
                  </select>
                </div>
              </div>
              {/* 기출인 경우 연도 입력 */}
              {newCase.source === 'exam' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">출제 연도 (쉼표로 구분)</label>
                  <input
                    type="text"
                    value={newCase.years || ''}
                    onChange={(e) => setNewCase({ ...newCase, years: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    placeholder="예: 2018, 2019, 2021"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                <input
                  type="text"
                  value={newCase.title}
                  onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="예: 30대 여성 섭식장애"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                  <select
                    value={newCase.category}
                    onChange={(e) => setNewCase({ ...newCase, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  >
                    {(newCase.type === 'major' ? MAJOR_CATEGORIES : ETHICS_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {newCase.type === 'major' ? '진단' : '주제'}
                  </label>
                  <input
                    type="text"
                    value={newCase.type === 'major' ? newCase.diagnosis : newCase.topic}
                    onChange={(e) => setNewCase({
                      ...newCase,
                      [newCase.type === 'major' ? 'diagnosis' : 'topic']: e.target.value
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    placeholder={newCase.type === 'major' ? '예: 신경성 식욕부진증' : '예: 다중관계'}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사례 내용 *</label>
                <textarea
                  value={newCase.case_text}
                  onChange={(e) => setNewCase({ ...newCase, case_text: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 h-32"
                  placeholder="사례 내용을 입력하세요..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowAddCase(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleAddCase}
                  disabled={saving}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 로딩 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : cases.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">등록된 예상문제가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cases.map(caseItem => (
              <div key={caseItem.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                {/* 사례 헤더 */}
                <div className="p-4 flex items-start justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => setExpandedCase(expandedCase === caseItem.id ? null : caseItem.id)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-600 rounded-full font-medium">
                        {caseItem.category}
                      </span>
                      <span className="text-xs text-gray-400">
                        질문 {caseItem.interview_questions?.length || 0}개
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-800">{caseItem.title}</h3>
                    {caseItem.diagnosis && (
                      <p className="text-sm text-gray-500">진단: {caseItem.diagnosis}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingCase(caseItem)}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCase(caseItem.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandedCase(expandedCase === caseItem.id ? null : caseItem.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition"
                    >
                      {expandedCase === caseItem.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 확장된 내용 */}
                {expandedCase === caseItem.id && (
                  <div className="border-t border-gray-100">
                    {/* 사례 내용 */}
                    <div className="p-4 bg-gray-50">
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{caseItem.case_text}</p>
                    </div>

                    {/* 질문 목록 */}
                    <div className="p-4 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-700">질문 목록</h4>
                        <button
                          onClick={() => setShowAddQuestion(caseItem.id)}
                          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                        >
                          <Plus className="w-4 h-4" />
                          질문 추가
                        </button>
                      </div>

                      {/* 새 질문 추가 폼 */}
                      {showAddQuestion === caseItem.id && (
                        <div className="bg-indigo-50 rounded-xl p-4 mb-3 border border-indigo-100">
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">질문 *</label>
                              <input
                                type="text"
                                value={newQuestion.question}
                                onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="질문 내용"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">핵심 포인트 (줄바꿈으로 구분)</label>
                              <textarea
                                value={newQuestion.key_points}
                                onChange={(e) => setNewQuestion({ ...newQuestion, key_points: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-20"
                                placeholder="포인트1&#10;포인트2&#10;포인트3"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Tip</label>
                              <input
                                type="text"
                                value={newQuestion.tip}
                                onChange={(e) => setNewQuestion({ ...newQuestion, tip: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="팁 내용"
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setShowAddQuestion(null)}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                              >
                                취소
                              </button>
                              <button
                                onClick={() => handleAddQuestion(caseItem.id)}
                                disabled={saving}
                                className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                저장
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 질문 리스트 */}
                      {caseItem.interview_questions?.length > 0 ? (
                        <div className="space-y-2">
                          {caseItem.interview_questions
                            .sort((a, b) => a.order_num - b.order_num)
                            .map((q, idx) => (
                              <div key={q.id} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                                {editingQuestion?.id === q.id ? (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      value={editingQuestion.question}
                                      onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                    <textarea
                                      value={Array.isArray(editingQuestion.key_points) ? editingQuestion.key_points.join('\n') : editingQuestion.key_points}
                                      onChange={(e) => setEditingQuestion({ ...editingQuestion, key_points: e.target.value })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-20"
                                      placeholder="핵심 포인트 (줄바꿈 구분)"
                                    />
                                    <input
                                      type="text"
                                      value={editingQuestion.tip || ''}
                                      onChange={(e) => setEditingQuestion({ ...editingQuestion, tip: e.target.value })}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                      placeholder="Tip"
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <button
                                        onClick={() => setEditingQuestion(null)}
                                        className="px-3 py-1 border border-gray-300 rounded-lg text-xs text-gray-600"
                                      >
                                        취소
                                      </button>
                                      <button
                                        onClick={() => handleUpdateQuestion(editingQuestion)}
                                        disabled={saving}
                                        className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs"
                                      >
                                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                        저장
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-800 mb-1">
                                        Q{idx + 1}. {q.question}
                                      </p>
                                      {q.key_points?.length > 0 && (
                                        <ul className="text-xs text-gray-500 ml-4">
                                          {q.key_points.map((point, i) => (
                                            <li key={i}>• {point}</li>
                                          ))}
                                        </ul>
                                      )}
                                      {q.tip && (
                                        <p className="text-xs text-violet-600 mt-1">💡 {q.tip}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                      <button
                                        onClick={() => setEditingQuestion(q)}
                                        className="p-1 text-gray-400 hover:text-indigo-600"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteQuestion(q.id)}
                                        className="p-1 text-gray-400 hover:text-red-600"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">등록된 질문이 없습니다.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 사례 수정 모달 */}
        {editingCase && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-800">사례 수정</h3>
                <button onClick={() => setEditingCase(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                  <input
                    type="text"
                    value={editingCase.title}
                    onChange={(e) => setEditingCase({ ...editingCase, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                    <select
                      value={editingCase.category}
                      onChange={(e) => setEditingCase({ ...editingCase, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">진단</label>
                    <input
                      type="text"
                      value={editingCase.diagnosis || ''}
                      onChange={(e) => setEditingCase({ ...editingCase, diagnosis: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">사례 내용</label>
                  <textarea
                    value={editingCase.case_text}
                    onChange={(e) => setEditingCase({ ...editingCase, case_text: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl h-40"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditingCase(null)}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => handleUpdateCase(editingCase)}
                    disabled={saving}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    저장
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
