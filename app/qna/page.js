'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Plus, MessageSquare, Send, X, User, Trash2, Pencil, Check, ExternalLink, Image } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

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

// 마크다운 + URL 렌더링 컴포넌트
const RenderContent = ({ content }) => {
  if (!content) return null;

  // 이미지 확장자
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i;
  // 구글 드라이브 이미지 링크
  const googleDriveRegex = /drive\.google\.com\/file\/d\/([^/]+)/;

  // 커스텀 링크 렌더러
  const customComponents = {
    // 링크 처리
    a: ({ href, children }) => {
      const isImage = imageExtensions.test(href);
      const isGoogleDrive = googleDriveRegex.test(href);

      // 구글 드라이브 이미지 변환
      let imageUrl = href;
      if (isGoogleDrive) {
        const match = href.match(googleDriveRegex);
        if (match) {
          imageUrl = `https://drive.google.com/uc?export=view&id=${match[1]}`;
        }
      }

      if (isImage || isGoogleDrive) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="block my-2">
            <img
              src={imageUrl}
              alt="첨부 이미지"
              className="max-w-full max-h-96 rounded-lg border hover:opacity-90 transition-opacity"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="hidden items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-blue-600 hover:bg-gray-200 w-fit">
              <ExternalLink className="w-4 h-4" />
              <span className="text-sm truncate max-w-xs">링크 열기</span>
            </div>
          </a>
        );
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-blue-600 hover:bg-gray-200 transition-colors text-sm"
        >
          <ExternalLink className="w-3 h-3" />
          <span className="truncate max-w-xs">
            {href.includes('drive.google.com') ? '구글 드라이브' :
             href.includes('docs.google.com') ? '구글 문서' :
             children || '링크'}
          </span>
        </a>
      );
    },
    // 마크다운 스타일링
    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
    li: ({ children }) => <li>{children}</li>,
    code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-pink-600">{children}</code>,
    pre: ({ children }) => <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm my-2">{children}</pre>,
    blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-600 my-2">{children}</blockquote>,
    h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
    h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
    h3: ({ children }) => <h3 className="text-base font-bold mb-1">{children}</h3>,
  };

  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={customComponents}>{content}</ReactMarkdown>
    </div>
  );
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
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentContent, setEditCommentContent] = useState('');

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
        members (name, avatar),
        comments (count)
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

  // 질문 삭제
  const handleDeleteQuestion = async (questionId) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId);

    if (!error) {
      setSelectedQuestion(null);
      setComments([]);
      loadQuestions();
    } else {
      alert('삭제에 실패했습니다.');
    }
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (!error) {
      loadComments(selectedQuestion.id);
    } else {
      alert('삭제에 실패했습니다.');
    }
  };

  // 질문 수정 시작
  const startEditQuestion = () => {
    setEditTitle(selectedQuestion.title);
    setEditContent(selectedQuestion.content);
    setEditingQuestion(true);
  };

  // 질문 수정 저장
  const handleUpdateQuestion = async () => {
    if (!editTitle.trim() || !editContent.trim()) return;

    const { error } = await supabase
      .from('questions')
      .update({
        title: editTitle.trim(),
        content: editContent.trim()
      })
      .eq('id', selectedQuestion.id);

    if (!error) {
      setSelectedQuestion({
        ...selectedQuestion,
        title: editTitle.trim(),
        content: editContent.trim()
      });
      setEditingQuestion(false);
      loadQuestions();
    } else {
      alert('수정에 실패했습니다.');
    }
  };

  // 댓글 수정 시작
  const startEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditCommentContent(comment.content);
  };

  // 댓글 수정 저장
  const handleUpdateComment = async (commentId) => {
    if (!editCommentContent.trim()) return;

    const { error } = await supabase
      .from('comments')
      .update({ content: editCommentContent.trim() })
      .eq('id', commentId);

    if (!error) {
      setEditingCommentId(null);
      setEditCommentContent('');
      loadComments(selectedQuestion.id);
    } else {
      alert('수정에 실패했습니다.');
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

  // 12시간 이내 작성된 글인지 확인
  const isNewPost = (dateString) => {
    const postDate = new Date(dateString);
    const now = new Date();
    const hoursDiff = (now - postDate) / (1000 * 60 * 60);
    return hoursDiff <= 12;
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{q.title}</h3>
                      {isNewPost(q.created_at) && (
                        <span className="px-2 py-0.5 bg-gradient-to-r from-rose-500 to-orange-400 text-white text-[10px] font-medium rounded-full shadow-sm animate-pulse">NEW</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{q.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <span>{q.members?.name}</span>
                      <span>•</span>
                      <span>{formatDate(q.created_at)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {q.comments?.[0]?.count || 0}
                      </span>
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
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
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
              {currentMember?.id === selectedQuestion.member_id && !editingQuestion && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={startEditQuestion}
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    title="수정"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(selectedQuestion.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            {editingQuestion ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
                <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
                  <p className="font-medium text-gray-600">📝 마크다운 문법:</p>
                  <p><code className="bg-gray-200 px-1 rounded">**굵게**</code> → 굵게 · <code className="bg-gray-200 px-1 rounded">*기울임*</code> → 기울임 · <code className="bg-gray-200 px-1 rounded">- 항목</code> → 목록</p>
                  <p><code className="bg-gray-200 px-1 rounded">`코드`</code> → 코드 · <code className="bg-gray-200 px-1 rounded">&gt; 인용</code> → 인용문 · <code className="bg-gray-200 px-1 rounded"># 제목</code> → 큰 제목</p>
                  <p className="font-medium text-gray-600 pt-1">🔗 구글 드라이브 링크로 이미지/파일 공유 가능 (https://... 형식으로 붙여넣기)</p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingQuestion(false)}
                    className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleUpdateQuestion}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-3">{selectedQuestion.title}</h2>
                <div className="text-gray-700">
                  <RenderContent content={selectedQuestion.content} />
                </div>
              </>
            )}
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900">{c.members?.name}</span>
                          <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                        </div>
                        {currentMember?.id === c.member_id && editingCommentId !== c.id && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditComment(c)}
                              className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                              title="수정"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      {editingCommentId === c.id ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={editCommentContent}
                            onChange={(e) => setEditCommentContent(e.target.value)}
                            rows={3}
                            className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                          />
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400">
                              📝 <code className="bg-gray-100 px-1 rounded">**굵게**</code> · <code className="bg-gray-100 px-1 rounded">*기울임*</code> · 🔗 URL 자동 링크
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingCommentId(null)}
                                className="px-2 py-1 text-gray-500 hover:bg-gray-200 rounded text-sm"
                              >
                                취소
                              </button>
                              <button
                                onClick={() => handleUpdateComment(c.id)}
                                className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                              >
                                저장
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-700 text-sm mt-1">
                          <RenderContent content={c.content} />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 댓글 입력 */}
            <form onSubmit={handleSubmitComment} className="space-y-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="댓글을 입력하세요..."
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
              />
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-gray-400">
                  📝 <code className="bg-gray-100 px-1 rounded">**굵게**</code> · <code className="bg-gray-100 px-1 rounded">*기울임*</code> · <code className="bg-gray-100 px-1 rounded">`코드`</code> · 🔗 URL 자동 링크
                </p>
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
                >
                  <Send className="w-4 h-4" />
                  등록
                </button>
              </div>
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
                  rows={10}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  maxLength={2000}
                />
                <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
                  <p className="font-medium text-gray-600">📝 마크다운 문법:</p>
                  <p><code className="bg-gray-200 px-1 rounded">**굵게**</code> → 굵게 · <code className="bg-gray-200 px-1 rounded">*기울임*</code> → 기울임 · <code className="bg-gray-200 px-1 rounded">- 항목</code> → 목록</p>
                  <p><code className="bg-gray-200 px-1 rounded">`코드`</code> → 코드 · <code className="bg-gray-200 px-1 rounded">&gt; 인용</code> → 인용문 · <code className="bg-gray-200 px-1 rounded"># 제목</code> → 큰 제목</p>
                  <p className="font-medium text-gray-600 pt-1">🔗 구글 드라이브 링크로 이미지/파일 공유 가능 (https://... 형식으로 붙여넣기)</p>
                </div>
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
