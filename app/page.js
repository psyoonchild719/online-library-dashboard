'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Users, Clock, Calendar, TrendingUp, LogIn, LogOut, ExternalLink, X, Target, Loader2, Send, MessageCircle } from 'lucide-react';

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
  const [showModal, setShowModal] = useState(false);
  const [personalRecords, setPersonalRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [todayStudyTime, setTodayStudyTime] = useState({}); // 오늘의 멤버별 학습시간
  const [totalStudyTimeMap, setTotalStudyTimeMap] = useState({}); // 멤버별 누적 학습시간 (분)
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // 알림 권한 요청
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // 알림 권한 요청 함수
  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  // 알림 보내기 함수
  const sendNotification = (title, body) => {
    if (notificationPermission === 'granted') {
      new Notification(title, {
        body,
        icon: '📚',
        tag: 'study-room-notification'
      });
    }
  };

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

            // 다른 멤버의 입실/퇴실 시 알림 보내기
            if (currentMember && member.id !== currentMember.id) {
              const actionText = payload.new.action === 'enter' ? '학습을 시작했습니다' : '학습을 종료했습니다';
              sendNotification('📚 스터디룸 알림', `${member.name}님이 ${actionText}`);
            }
          }
        }
      )
      .subscribe();

    // 채팅 메시지 실시간 구독
    const chatSubscription = supabase
      .channel('chat_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const member = members.find(m => m.id === payload.new.member_id);
          if (member) {
            const newChat = {
              id: payload.new.id,
              member_id: payload.new.member_id,
              member_name: member.name,
              avatar: member.avatar,
              message: payload.new.message,
              created_at: payload.new.created_at
            };
            setChatMessages(prev => [...prev, newChat].slice(-50));

            // 다른 멤버의 메시지 알림
            if (currentMember && member.id !== currentMember.id) {
              sendNotification('💬 새 메시지', `${member.name}: ${payload.new.message}`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(onlineStatusSubscription);
      supabase.removeChannel(attendanceSubscription);
      supabase.removeChannel(chatSubscription);
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

      // 오늘의 학습시간 계산
      await loadTodayStudyTime();

      // 누적 학습시간 계산
      await loadTotalStudyTime();

      // 채팅 메시지 로드
      await loadChatMessages();

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 오늘의 멤버별 학습시간 로드
  const loadTodayStudyTime = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: todayLogs, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .gte('logged_at', today.toISOString())
        .lt('logged_at', tomorrow.toISOString())
        .order('logged_at', { ascending: true });

      if (error) throw error;

      // 멤버별로 학습시간 계산
      const studyTimeMap = {};
      const enterTimeMap = {};

      todayLogs?.forEach(log => {
        if (log.action === 'enter') {
          enterTimeMap[log.member_id] = new Date(log.logged_at);
        } else if (log.action === 'exit' && enterTimeMap[log.member_id]) {
          const enterTime = enterTimeMap[log.member_id];
          const exitTime = new Date(log.logged_at);
          const minutes = Math.round((exitTime - enterTime) / 60000);
          studyTimeMap[log.member_id] = (studyTimeMap[log.member_id] || 0) + minutes;
          delete enterTimeMap[log.member_id];
        }
      });

      // 현재 입실 중인 멤버는 현재 시간까지 계산
      Object.keys(enterTimeMap).forEach(memberId => {
        const enterTime = enterTimeMap[memberId];
        const now = new Date();
        const minutes = Math.round((now - enterTime) / 60000);
        studyTimeMap[memberId] = (studyTimeMap[memberId] || 0) + minutes;
      });

      setTodayStudyTime(studyTimeMap);
    } catch (error) {
      console.error('Error loading today study time:', error);
    }
  };

  // 멤버별 누적 학습시간 로드
  const loadTotalStudyTime = async () => {
    try {
      const { data: allLogs, error } = await supabase
        .from('attendance_logs')
        .select('*')
        .order('logged_at', { ascending: true });

      if (error) throw error;

      // 멤버별로 누적 학습시간 계산
      const studyTimeMap = {};
      const enterTimeMap = {};

      allLogs?.forEach(log => {
        if (log.action === 'enter') {
          enterTimeMap[log.member_id] = new Date(log.logged_at);
        } else if (log.action === 'exit' && enterTimeMap[log.member_id]) {
          const enterTime = enterTimeMap[log.member_id];
          const exitTime = new Date(log.logged_at);
          const minutes = Math.round((exitTime - enterTime) / 60000);
          studyTimeMap[log.member_id] = (studyTimeMap[log.member_id] || 0) + minutes;
          delete enterTimeMap[log.member_id];
        }
      });

      // 현재 학습 중인 멤버는 현재 시간까지 계산
      Object.keys(enterTimeMap).forEach(memberId => {
        const enterTime = enterTimeMap[memberId];
        const now = new Date();
        const minutes = Math.round((now - enterTime) / 60000);
        studyTimeMap[memberId] = (studyTimeMap[memberId] || 0) + minutes;
      });

      setTotalStudyTimeMap(studyTimeMap);
    } catch (error) {
      console.error('Error loading total study time:', error);
    }
  };

  // 채팅 메시지 로드
  const loadChatMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          members (name, avatar)
        `)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      const formattedMessages = data?.map(msg => ({
        id: msg.id,
        member_id: msg.member_id,
        member_name: msg.members?.name,
        avatar: msg.members?.avatar,
        message: msg.message,
        created_at: msg.created_at
      })) || [];
      setChatMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading chat messages:', error);
    }
  };

  // 채팅 메시지 전송
  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentMember) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          member_id: currentMember.id,
          message: newMessage.trim()
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('메시지 전송에 실패했습니다.');
    }
  };

  // 학습 시작 처리 (Google Meet 없이)
  const handleStartStudy = async () => {
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

    } catch (error) {
      console.error('Error starting study:', error);
      alert('학습 시작 처리 중 오류가 발생했습니다.');
    }
  };

  // 도서관 입실 처리 (학습 시작 + Google Meet 열기)
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

      // Google Meet 새 창으로 열기
      window.open(GOOGLE_MEET_URL, '_blank', 'noopener,noreferrer');

    } catch (error) {
      console.error('Error entering library:', error);
      alert('입실 처리 중 오류가 발생했습니다.');
    }
  };

  // 퇴실 처리
  const handleExit = async () => {
    if (!currentMember) return;

    try {
      // 0. 마지막 입실 시간 조회해서 학습 시간 계산
      const { data: lastEnterLog } = await supabase
        .from('attendance_logs')
        .select('logged_at')
        .eq('member_id', currentMember.id)
        .eq('action', 'enter')
        .order('logged_at', { ascending: false })
        .limit(1)
        .single();

      let studyMinutes = 0;
      if (lastEnterLog) {
        const enterTime = new Date(lastEnterLog.logged_at);
        const exitTime = new Date();
        studyMinutes = Math.round((exitTime - enterTime) / 60000);
      }

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

      // 3. members 테이블의 total_hours 업데이트
      const newTotalHours = (currentMember.total_hours || 0) + (studyMinutes / 60);
      const { error: memberError } = await supabase
        .from('members')
        .update({ total_hours: newTotalHours })
        .eq('id', currentMember.id);

      if (memberError) throw memberError;

      // 로컬 상태 업데이트
      setOnlineStatus(prev => ({
        ...prev,
        [currentMember.id]: false
      }));

      // currentMember 업데이트
      setCurrentMember(prev => ({
        ...prev,
        total_hours: newTotalHours
      }));

      // members 배열도 업데이트
      setMembers(prev => prev.map(m =>
        m.id === currentMember.id ? { ...m, total_hours: newTotalHours } : m
      ));

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
          <h1 className="text-3xl font-bold mb-2">📚 2026 임상심리전문가<br />자격시험 준비 스터디룸</h1>
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
      {/* 알림 권한 요청 배너 */}
      {notificationPermission === 'default' && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-blue-700">🔔 다른 멤버의 입실/퇴실 알림을 받으시겠어요?</span>
          <button
            onClick={requestNotificationPermission}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            알림 허용
          </button>
        </div>
      )}

      {/* 제목 + 구글계정 */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">📚 2026 스터디룸</h1>
        {/* 사용자 프로필 & 로그아웃 */}
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm border">
          <img
            src={user.user_metadata?.avatar_url || '/default-avatar.png'}
            alt="프로필"
            className="w-8 h-8 rounded-full"
          />
          <span className="hidden md:inline text-sm font-medium">{ALLOWED_MEMBERS[user.email]?.name || user.email}</span>
          <button
            onClick={signOut}
            className="ml-1 text-gray-400 hover:text-gray-600"
            title="로그아웃"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 학습 버튼들 - 가운데 정렬 */}
      <div className="mb-6 flex justify-center">
        <div className="flex items-center gap-2">
          <button
            onClick={handleEnterLibrary}
            className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            도서관 입실하기
          </button>

          {!isCurrentUserOnline ? (
            <button
              onClick={handleStartStudy}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Clock className="w-4 h-4" />
              학습 시작
            </button>
          ) : (
            <button
              onClick={handleExit}
              className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              학습 종료
            </button>
          )}
        </div>
      </div>

      {/* D-day 대시보드 */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border p-3 md:p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-red-500" />
            <h2 className="text-base font-semibold">D-day</h2>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium">
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
          </div>
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

      {/* 메인 컨텐츠 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 왼쪽: 멤버 현황 + 실시간 메시지 */}
        <div className="md:col-span-2 space-y-4">
          {/* 회원 목록 */}
          <div className="bg-white rounded-xl shadow-sm border p-3 md:p-4">
            <h2 className="text-base font-semibold mb-2">👥 멤버 현황</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {members.map(member => {
              const isOnline = onlineStatus[member.id] || false;
              const isMe = currentMember?.id === member.id;
              return (
                <div
                  key={member.id}
                  onClick={() => handleUserClick(member)}
                  className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                    isMe ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {member.avatar?.startsWith('http') ? (
                      <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full" />
                    ) : (
                      <span className="text-xl">{member.avatar}</span>
                    )}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      isOnline ? 'bg-green-500' : 'bg-gray-300'
                    }`}></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {member.name}
                      {isMe && <span className="ml-1 text-xs text-blue-600">(나)</span>}
                    </p>
                    {isOnline && (
                      <span className="text-xs text-green-600">학습중</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>

          {/* 실시간 채팅 */}
          <div className="bg-white rounded-xl shadow-sm border p-3 md:p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-blue-500" />
              <h2 className="text-base font-semibold">실시간 메시지</h2>
            </div>

            {/* 채팅 메시지 목록 */}
            <div className="space-y-3 max-h-40 overflow-y-auto mb-4" id="chat-container">
              {chatMessages.length === 0 ? (
                <p className="text-gray-400 text-center py-6">첫 번째 메시지를 남겨보세요! 💪</p>
              ) : (
                chatMessages.map(msg => {
                  const isMe = currentMember?.id === msg.member_id;
                  return (
                    <div key={msg.id} className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                      {msg.avatar?.startsWith('http') ? (
                        <img src={msg.avatar} alt={msg.member_name} className="w-8 h-8 rounded-full flex-shrink-0" />
                      ) : (
                        <span className="text-xl flex-shrink-0">{msg.avatar}</span>
                      )}
                      <div className={`max-w-[70%] ${isMe ? 'text-right' : ''}`}>
                        <p className="text-xs text-gray-500 mb-1">{msg.member_name}</p>
                        <div className={`inline-block px-3 py-2 rounded-lg ${
                          isMe ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'
                        }`}>
                          <p className="text-sm">{msg.message}</p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 메시지 입력 */}
            <form onSubmit={sendChatMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="메시지를 입력하세요!"
                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                maxLength={200}
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* 오른쪽: 실시간 활동 로그 */}
        <div className="bg-white rounded-xl shadow-sm border p-3 md:p-4">
          <h2 className="text-base font-semibold mb-2">📋 실시간 기록</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {activityLog.length === 0 ? (
              <p className="text-gray-400 text-center py-8">활동 기록이 없습니다</p>
            ) : (
              activityLog.map(log => (
                <div key={log.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg animate-fadeIn">
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
                        {log.action === 'enter' ? '학습 시작' : '학습 종료'}
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

      {/* 학습 시간 현황 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-6">
        {/* 오늘의 학습시간 */}
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-4">⏱️ 오늘의 학습시간</h2>
          <div className="space-y-3">
            {members.length === 0 ? (
              <p className="text-gray-400 text-center py-4">멤버가 없습니다</p>
            ) : (
              members
                .map(member => ({
                  ...member,
                  todayMinutes: todayStudyTime[member.id] || 0
                }))
                .sort((a, b) => b.todayMinutes - a.todayMinutes)
                .map((member, index) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-lg font-bold text-gray-400 w-6">{index + 1}</span>
                    {member.avatar?.startsWith('http') ? (
                      <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full" />
                    ) : (
                      <span className="text-xl">{member.avatar}</span>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{member.name}</p>
                    </div>
                    <p className="font-bold text-blue-600">
                      {member.todayMinutes >= 60
                        ? `${Math.floor(member.todayMinutes / 60)}h ${member.todayMinutes % 60}m`
                        : `${member.todayMinutes}m`
                      }
                    </p>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* 누적 학습시간 랭킹 */}
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-4">🏆 누적 학습시간 랭킹</h2>
          <div className="space-y-3">
            {members.length === 0 ? (
              <p className="text-gray-400 text-center py-4">멤버가 없습니다</p>
            ) : (
              members
                .map(member => ({
                  ...member,
                  totalMinutes: totalStudyTimeMap[member.id] || 0
                }))
                .sort((a, b) => b.totalMinutes - a.totalMinutes)
                .map((member, index) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className={`text-lg font-bold w-6 ${
                      index === 0 ? 'text-yellow-500' :
                      index === 1 ? 'text-gray-400' :
                      index === 2 ? 'text-amber-600' : 'text-gray-300'
                    }`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </span>
                    {member.avatar?.startsWith('http') ? (
                      <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full" />
                    ) : (
                      <span className="text-xl">{member.avatar}</span>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{member.name}</p>
                    </div>
                    <p className="font-bold text-purple-600">
                      {member.totalMinutes >= 60
                        ? `${Math.floor(member.totalMinutes / 60)}h ${member.totalMinutes % 60}m`
                        : `${member.totalMinutes}m`
                      }
                    </p>
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
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    {(() => {
                      const totalMinutes = totalStudyTimeMap[selectedUser.id] || 0;
                      const hours = Math.floor(totalMinutes / 60);
                      const minutes = totalMinutes % 60;
                      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                    })()}
                  </p>
                  <p className="text-xs text-gray-500">총 학습시간</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{personalRecords.length}회</p>
                  <p className="text-xs text-gray-500">최근 출석 횟수</p>
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
