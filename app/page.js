'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Users, Clock, Calendar, TrendingUp, LogIn, LogOut, ExternalLink, X, ChevronLeft, ChevronRight, Target, Loader2 } from 'lucide-react';

// Supabase 클라이언트 설정 (환경변수 사용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Google Meet URL
const GOOGLE_MEET_URL = 'https://meet.google.com/hti-iiby-dkc';

// 허용된 멤버 목록 (화이트리스트)
const ALLOWED_MEMBERS = {
  'psyoonchild@gmail.com': { name: '김지윤', avatar: '🦊' },
  'pit-a-pat@hotmail.co.kr': { name: '조하나', avatar: '🐰' },
  'khk9440@ewhain.net': { name: '곽호경', avatar: '🐻' },
  'youjin13ae@gmail.com': { name: '배유진', avatar: '🐱' },
  'hipsychology@gmail.com': { name: '황해인', avatar: '🐶' },
  'dawoon85@gmail.com': { name: '정다운', avatar: '🐼' },
};


export default function OnlineLibraryDashboard() {
  const [user, setUser] = useState(null); // 로그인한 사용자
  const [currentMember, setCurrentMember] = useState(null); // 현재 로그인한 멤버 정보
  const [members, setMembers] = useState([]);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [activityLog, setActivityLog] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [personalRecords, setPersonalRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  // 인증 상태 확인
  useEffect(() => {
    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // 인증 상태 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 로그인한 사용자의 멤버 정보 로드
  useEffect(() => {
    if (user) {
      loadCurrentMember();
    }
  }, [user]);

  const loadCurrentMember = async () => {
    if (!user) return;

    // 먼저 기존 멤버 조회
    let { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('email', user.email)
      .single();

    // 멤버가 없으면 자동 등록 (허용된 멤버만)
    if (error && error.code === 'PGRST116') {
      // 허용된 멤버인지 확인
      const allowedMember = ALLOWED_MEMBERS[user.email];
      if (!allowedMember) {
        // 허용되지 않은 사용자
        return;
      }

      const newMember = {
        name: allowedMember.name,
        email: user.email,
        avatar: user.user_metadata?.avatar_url || allowedMember.avatar,
        auth_id: user.id,
        attendance_rate: 0,
        total_hours: 0
      };

      const { data: insertedMember, error: insertError } = await supabase
        .from('members')
        .insert(newMember)
        .select()
        .single();

      if (!insertError && insertedMember) {
        // online_status 테이블에도 추가
        await supabase
          .from('online_status')
          .insert({
            member_id: insertedMember.id,
            is_online: false
          });

        setCurrentMember(insertedMember);
      } else {
        console.error('Error creating member:', insertError);
      }
    } else if (!error && data) {
      // auth_id가 없으면 업데이트
      if (!data.auth_id) {
        await supabase
          .from('members')
          .update({ auth_id: user.id })
          .eq('id', data.id);
      }
      setCurrentMember(data);
    }
  };

  // Google 로그인
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) {
      console.error('Login error:', error);
      alert('로그인 중 오류가 발생했습니다.');
    }
  };

  // 로그아웃
  const signOut = async () => {
    // 로그아웃 전에 입실 상태면 퇴실 처리
    if (currentMember && onlineStatus[currentMember.id]) {
      await handleExit();
    }
    await supabase.auth.signOut();
    setCurrentMember(null);
  };

  // 초기 데이터 로드
  useEffect(() => {
    if (!authLoading) {
      loadInitialData();
    }

    // 실시간 구독 설정
    const onlineStatusSubscription = supabase
      .channel('online_status_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'online_status' },
        (payload) => {
          console.log('Online status changed:', payload);
          setOnlineStatus(prev => ({
            ...prev,
            [payload.new.member_id]: payload.new.is_online
          }));
        }
      )
      .subscribe();

    const attendanceSubscription = supabase
      .channel('attendance_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_logs' },
        async (payload) => {
          console.log('New attendance log:', payload);
          const member = members.find(m => m.id === payload.new.member_id);
          if (member) {
            const newLog = {
              id: payload.new.id,
              member_id: payload.new.member_id,
              member_name: member.name,
              avatar: member.avatar,
              action: payload.new.action,
              logged_at: payload.new.logged_at
            };
            setActivityLog(prev => [newLog, ...prev].slice(0, 10));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(onlineStatusSubscription);
      supabase.removeChannel(attendanceSubscription);
    };
  }, [authLoading, members]);

  const loadInitialData = async () => {
    try {
      // 회원 목록 로드
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .order('name');

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // 온라인 상태 로드
      const { data: statusData, error: statusError } = await supabase
        .from('online_status')
        .select('*');

      if (statusError) throw statusError;

      const statusMap = {};
      statusData?.forEach(s => {
        statusMap[s.member_id] = s.is_online;
      });
      setOnlineStatus(statusMap);

      // 최근 활동 로그 로드
      const { data: logsData, error: logsError } = await supabase
        .from('attendance_logs')
        .select(`
          *,
          members (name, avatar)
        `)
        .order('logged_at', { ascending: false })
        .limit(10);

      if (logsError) throw logsError;

      const formattedLogs = logsData?.map(log => ({
        id: log.id,
        member_id: log.member_id,
        member_name: log.members?.name,
        avatar: log.members?.avatar,
        action: log.action,
        logged_at: log.logged_at
      })) || [];
      setActivityLog(formattedLogs);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 입실 처리 (입실하기 클릭 시)
  const handleEnterLibrary = async () => {
    if (!currentMember) {
      alert('먼저 로그인해주세요.');
      return;
    }

    try {
      // 1. attendance_logs에 입실 기록 추가
      const { error: logError } = await supabase
        .from('attendance_logs')
        .insert({
          member_id: currentMember.id,
          action: 'enter'
        });

      if (logError) throw logError;

      // 2. online_status 업데이트
      const { error: statusError } = await supabase
        .from('online_status')
        .update({
          is_online: true,
          last_enter: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('member_id', currentMember.id);

      if (statusError) throw statusError;

      // 로컬 상태 업데이트
      setOnlineStatus(prev => ({
        ...prev,
        [currentMember.id]: true
      }));

      // 활동 로그에 추가
      const newLog = {
        id: Date.now(),
        member_id: currentMember.id,
        member_name: currentMember.name,
        avatar: currentMember.avatar,
        action: 'enter',
        logged_at: new Date().toISOString()
      };
      setActivityLog(prev => [newLog, ...prev].slice(0, 10));

      // Google Meet 열기
      window.open(GOOGLE_MEET_URL, '_blank');

    } catch (error) {
      console.error('Error entering:', error);
      alert('입실 처리 중 오류가 발생했습니다.');
    }
  };

  // 퇴실 처리
  const handleExit = async () => {
    if (!currentMember) return;

    try {
      // 1. attendance_logs에 퇴실 기록 추가
      const { error: logError } = await supabase
        .from('attendance_logs')
        .insert({
          member_id: currentMember.id,
          action: 'exit'
        });

      if (logError) throw logError;

      // 2. online_status 업데이트
      const { error: statusError } = await supabase
        .from('online_status')
        .update({
          is_online: false,
          last_exit: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('member_id', currentMember.id);

      if (statusError) throw statusError;

      // 로컬 상태 업데이트
      setOnlineStatus(prev => ({
        ...prev,
        [currentMember.id]: false
      }));

      // 활동 로그에 추가
      const newLog = {
        id: Date.now(),
        member_id: currentMember.id,
        member_name: currentMember.name,
        avatar: currentMember.avatar,
        action: 'exit',
        logged_at: new Date().toISOString()
      };
      setActivityLog(prev => [newLog, ...prev].slice(0, 10));

    } catch (error) {
      console.error('Error exiting:', error);
      alert('퇴실 처리 중 오류가 발생했습니다.');
    }
  };

  // 개인 기록 로드
  const loadPersonalRecords = async (memberId) => {
    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('member_id', memberId)
        .order('logged_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // 입퇴실 쌍으로 묶기
      const records = [];
      let enterTime = null;

      data?.reverse().forEach(log => {
        if (log.action === 'enter') {
          enterTime = new Date(log.logged_at);
        } else if (log.action === 'exit' && enterTime) {
          const exitTime = new Date(log.logged_at);
          const duration = Math.round((exitTime - enterTime) / 60000);
          records.unshift({
            date: enterTime.toLocaleDateString('ko-KR'),
            enterTime: enterTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            exitTime: exitTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            duration: `${Math.floor(duration / 60)}시간 ${duration % 60}분`
          });
          enterTime = null;
        }
      });

      setPersonalRecords(records.slice(0, 14));
    } catch (error) {
      console.error('Error loading personal records:', error);
    }
  };

  const handleUserClick = (member) => {
    setSelectedUser(member);
    loadPersonalRecords(member.id);
    setShowModal(true);
  };

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 통계 계산
  const onlineCount = Object.values(onlineStatus).filter(Boolean).length;
  const avgAttendance = members.length > 0
    ? Math.round(members.reduce((acc, m) => acc + (m.attendance_rate || 0), 0) / members.length)
    : 0;
  const totalStudyHours = members.reduce((acc, m) => acc + (m.total_hours || 0), 0).toFixed(1);

  // 현재 사용자가 입실 상태인지 확인
  const isCurrentUserOnline = currentMember && onlineStatus[currentMember.id];

  // 로딩 중
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 로그인 안 된 경우
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full mx-4 text-center">
          <h1 className="text-3xl font-bold mb-2">📚 2026 임상심리전문가 자격시험 준비 스터디룸</h1>
          <p className="text-gray-500 mb-8">온라인 도서관 입실하기</p>

          <div className="space-y-4">
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google 계정으로 로그인
            </button>
          </div>

          <p className="mt-6 text-sm text-gray-400">
            스터디 멤버만 접근할 수 있습니다
          </p>
        </div>
      </div>
    );
  }

  // 허용되지 않은 사용자인 경우
  if (user && !ALLOWED_MEMBERS[user.email]) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full mx-4 text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold mb-2 text-gray-900">접근 권한이 없습니다</h1>
          <p className="text-gray-500 mb-6">
            이 서비스는 등록된 스터디 멤버만 이용할 수 있습니다.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            로그인 계정: {user.email}
          </p>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* 헤더 */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">📚 2026 임상심리전문가 자격시험 준비 스터디룸</h1>
              <p className="text-gray-500 text-sm mt-1">실시간 입퇴실 현황</p>
            </div>
            {/* 모바일: 프로필 */}
            <div className="flex md:hidden items-center gap-2">
              <img
                src={user.user_metadata?.avatar_url || '/default-avatar.png'}
                alt="프로필"
                className="w-8 h-8 rounded-full"
              />
              <button
                onClick={signOut}
                className="text-gray-400 hover:text-gray-600"
                title="로그아웃"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4">
            {/* 날짜 선택 */}
            <div className="flex items-center justify-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm border">
              <button onClick={() => changeDate(-1)} className="p-1 hover:bg-gray-100 rounded">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-sm">
                {selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
              </span>
              <button onClick={() => changeDate(1)} className="p-1 hover:bg-gray-100 rounded">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* 입실/퇴실 버튼 */}
            {isCurrentUserOnline ? (
              <button
                onClick={handleExit}
                className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                퇴실하기
              </button>
            ) : (
              <button
                onClick={handleEnterLibrary}
                className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                입실하기
              </button>
            )}

            {/* 데스크톱: 사용자 프로필 & 로그아웃 */}
            <div className="hidden md:flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm border">
              <img
                src={user.user_metadata?.avatar_url || '/default-avatar.png'}
                alt="프로필"
                className="w-8 h-8 rounded-full"
              />
              <span className="text-sm font-medium">{ALLOWED_MEMBERS[user.email]?.name || user.email}</span>
              <button
                onClick={signOut}
                className="ml-2 text-gray-400 hover:text-gray-600"
                title="로그아웃"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* D-day 대시보드 */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold">D-day</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {/* 임상심리전문가 필기 */}
          {(() => {
            const examDate = new Date('2026-02-06');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffTime = examDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const isToday = diffDays === 0;
            const isPast = diffDays < 0;

            return (
              <div className={`p-4 rounded-xl border-2 ${
                isToday ? 'bg-red-50 border-red-300' :
                isPast ? 'bg-gray-50 border-gray-200' :
                'bg-gradient-to-br from-orange-50 to-red-50 border-orange-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">2026.02.06 (금)</p>
                    <h3 className="font-bold text-gray-900 text-sm md:text-base">임상심리전문가 필기</h3>
                  </div>
                  <p className={`text-2xl md:text-3xl font-black ${
                    isToday ? 'text-red-600' :
                    isPast ? 'text-gray-400' :
                    diffDays <= 7 ? 'text-red-500' :
                    diffDays <= 14 ? 'text-orange-500' :
                    'text-blue-600'
                  }`}>
                    {isToday ? 'D-Day' : isPast ? `D+${Math.abs(diffDays)}` : `D-${diffDays}`}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* 임상심리전문가 면접 */}
          {(() => {
            const examDate = new Date('2026-02-07');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffTime = examDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const isToday = diffDays === 0;
            const isPast = diffDays < 0;

            return (
              <div className={`p-4 rounded-xl border-2 ${
                isToday ? 'bg-red-50 border-red-300' :
                isPast ? 'bg-gray-50 border-gray-200' :
                'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">2026.02.07 (토)</p>
                    <h3 className="font-bold text-gray-900 text-sm md:text-base">임상심리전문가 면접</h3>
                  </div>
                  <p className={`text-2xl md:text-3xl font-black ${
                    isToday ? 'text-red-600' :
                    isPast ? 'text-gray-400' :
                    diffDays <= 7 ? 'text-red-500' :
                    diffDays <= 14 ? 'text-orange-500' :
                    'text-purple-600'
                  }`}>
                    {isToday ? 'D-Day' : isPast ? `D+${Math.abs(diffDays)}` : `D-${diffDays}`}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs md:text-sm">현재 입실 멤버</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{onlineCount}명</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
            </div>
          </div>
          <p className="mt-2 md:mt-4 text-xs md:text-sm text-gray-400">전체 {members.length}명</p>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs md:text-sm">평균 출석률</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{avgAttendance}%</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-2 md:mt-4">
            <div className="w-full bg-gray-200 rounded-full h-1.5 md:h-2">
              <div className="bg-blue-600 h-1.5 md:h-2 rounded-full" style={{ width: `${avgAttendance}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs md:text-sm">총 학습시간</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{totalStudyHours}h</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
            </div>
          </div>
          <p className="mt-2 md:mt-4 text-xs md:text-sm text-gray-500">이번 달 누적</p>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs md:text-sm">오늘 입실</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
                {activityLog.filter(l => l.action === 'enter').length}회
              </p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <LogIn className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
            </div>
          </div>
          <p className="mt-2 md:mt-4 text-xs md:text-sm text-gray-500">실시간 업데이트</p>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* 회원 목록 */}
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-4">👥 멤버 현황</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {members.map(member => {
              const isOnline = onlineStatus[member.id] || false;
              const isMe = currentMember?.id === member.id;
              return (
                <div
                  key={member.id}
                  onClick={() => handleUserClick(member)}
                  className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${
                    isMe ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {member.avatar?.startsWith('http') ? (
                        <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full" />
                      ) : (
                        <span className="text-2xl">{member.avatar}</span>
                      )}
                      <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                        isOnline ? 'bg-green-500' : 'bg-gray-300'
                      }`}></span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {member.name}
                        {isMe && <span className="ml-2 text-xs text-blue-600">(나)</span>}
                      </p>
                      <p className="text-xs text-gray-500">총 {member.total_hours || 0}h 학습</p>
                    </div>
                  </div>
                  {isOnline && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">입실중</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 실시간 활동 로그 */}
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-4">📋 실시간 기록</h2>
          <div className="space-y-3 max-h-64 md:max-h-96 overflow-y-auto">
            {activityLog.length === 0 ? (
              <p className="text-gray-400 text-center py-8">활동 기록이 없습니다</p>
            ) : (
              activityLog.map(log => (
                <div key={log.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg animate-fadeIn">
                  {log.avatar?.startsWith('http') ? (
                    <img src={log.avatar} alt={log.member_name} className="w-8 h-8 rounded-full" />
                  ) : (
                    <span className="text-xl">{log.avatar}</span>
                  )}
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{log.member_name}</span>
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                        log.action === 'enter' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {log.action === 'enter' ? '입실' : '퇴실'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400">{formatTime(log.logged_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 개인 기록 모달 */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedUser.avatar?.startsWith('http') ? (
                  <img src={selectedUser.avatar} alt={selectedUser.name} className="w-12 h-12 rounded-full" />
                ) : (
                  <span className="text-3xl">{selectedUser.avatar}</span>
                )}
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.name}</h3>
                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{selectedUser.total_hours || 0}h</p>
                  <p className="text-xs text-gray-500">총 학습시간</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{selectedUser.attendance_rate || 0}%</p>
                  <p className="text-xs text-gray-500">출석률</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{personalRecords.length}일</p>
                  <p className="text-xs text-gray-500">최근 출석</p>
                </div>
              </div>

              <h4 className="font-medium mb-3">📅 최근 출석 기록</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {personalRecords.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">출석 기록이 없습니다</p>
                ) : (
                  personalRecords.map((record, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-sm">{record.date}</span>
                      <div className="text-right text-sm">
                        <span className="text-green-600">{record.enterTime}</span>
                        <span className="text-gray-400 mx-1">~</span>
                        <span className="text-red-600">{record.exitTime}</span>
                        <span className="text-gray-500 ml-2">({record.duration})</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
