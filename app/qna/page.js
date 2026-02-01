'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Plus, MessageSquare, Send, X, User } from 'lucide-react';
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

export default function QnAPage() {
  const [user, setUser] = useState(null);
  const [currentMember, setCurrentMember] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newComment, setNewComment] = useState('');

  // 인증 상태 확인
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 로그인한 사용자의 멤버 정보 로드
  useEffect(() => {
    if (user) {
      loadCurrentMember();
      loadQuestions();
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

  const loadQuestions = async () => {
    const { data, error } = await supabase
      .from('questions')
      .select(`
        *,
        members (name, avatar)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setQuestions(data);
    }
  };

  const loadComments = async (questionId) => {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        members (name, avatar)
      `)
      .eq('question_id', questionId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setComments(data);
    }
  };

  const handleQuestionClick = async (question) => {
    setSelectedQuestion(question);
    await loadComments(question.id);
  };

  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !currentMember) return;

    const { error } = await supabase
      .from('questions')
      .insert({
        member_id: currentMember.id,
        title: newTitle.trim(),
        content: newContent.trim()
      });

    if (!error) {
      setNewTitle('');
      setNewContent('');
      setShowNewQuestion(false);
      loadQuestions();
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !currentMember || !selectedQuestion) return;

    const { error } = await supabase
      .from('comments')
      .insert({
        question_id: selectedQuestion.id,
        member_id: currentMember.id,
        content: newComment.trim()
      });

    if (!error) {
      setNewComment('');
      loadComments(selectedQuestion.id);
    }
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

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 로그인 안 된 경우
  if (!user || !ALLOWED_MEMBERS[user.email]) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">로그인이 필요합니다</p>
          <Link href="/" className="text-blue-600 hover:underline">
            메인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">💬 토론의 방</h1>
        </div>
        <button
          onClick={() => setShowNewQuestion(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          질문하기
        </button>
      </div>

      {/* 질문 목록 */}
      {!selectedQuestion && (
        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">아직 질문이 없습니다</p>
              <p className="text-gray-400 text-sm mt-1">첫 번째 질문을 남겨보세요!</p>
            </div>
          ) : (
            questions.map(q => (
              <div
                key={q.id}
                onClick={() => handleQuestionClick(q)}
                className="bg-white rounded-xl shadow-sm border p-4 cursor-pointer hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {q.members?.avatar?.startsWith('http') ? (
                      <img src={q.members.avatar} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <span className="text-2xl">{q.members?.avatar || '👤'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{q.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{q.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <span>{q.members?.name}</span>
                      <span>•</span>
                      <span>{formatDate(q.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 질문 상세 + 댓글 */}
      {selectedQuestion && (
        <div className="space-y-4">
          {/* 뒤로가기 */}
          <button
            onClick={() => { setSelectedQuestion(null); setComments([]); }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로
          </button>

          {/* 질문 내용 */}
          <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0">
                {selectedQuestion.members?.avatar?.startsWith('http') ? (
                  <img src={selectedQuestion.members.avatar} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <span className="text-2xl">{selectedQuestion.members?.avatar || '👤'}</span>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">{selectedQuestion.members?.name}</p>
                <p className="text-xs text-gray-400">{formatDate(selectedQuestion.created_at)}</p>
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">{selectedQuestion.title}</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{selectedQuestion.content}</p>
          </div>

          {/* 댓글 목록 */}
          <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
            <h3 className="font-semibold text-gray-900 mb-4">💭 댓글 {comments.length}개</h3>

            <div className="space-y-4 mb-4">
              {comments.length === 0 ? (
                <p className="text-gray-400 text-center py-4">아직 댓글이 없습니다</p>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      {c.members?.avatar?.startsWith('http') ? (
                        <img src={c.members.avatar} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <span className="text-xl">{c.members?.avatar || '👤'}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900">{c.members?.name}</span>
                        <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                      </div>
                      <p className="text-gray-700 text-sm mt-1 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 댓글 입력 */}
            <form onSubmit={handleSubmitComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="댓글을 입력하세요..."
                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 새 질문 모달 */}
      {showNewQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">새 질문 작성</h2>
              <button
                onClick={() => setShowNewQuestion(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitQuestion} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="질문 제목을 입력하세요"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="질문 내용을 자세히 작성해주세요"
                  rows={5}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  maxLength={2000}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewQuestion(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || !newContent.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
