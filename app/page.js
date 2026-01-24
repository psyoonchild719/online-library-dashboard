'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Users, Clock, Calendar, TrendingUp, LogIn, LogOut, ExternalLink, X, ChevronLeft, ChevronRight, Target, Loader2 } from 'lucide-react';

// Supabase 클라이언트 설정 (환경변수 사용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Google Meet URL
const GOOGLE_MEET_URL = 'https://meet.google.com/hti-iiby-dkc';

// 주간 통계 데이터
const weeklyData = [
  { day: '월', hours: 5.2, attendance: 7 },
  { day: '화', hours: 6.1, attendance: 8 },
  { day: '수', hours: 4.8, attendance: 6 },
  { day: '목', hours: 7.3, attendance: 8 },
  { day: '금', hours: 5.9, attendance: 7 },
  { day: '토', hours: 3.2, attendance: 4 },
  { day: '일', hours: 2.1, attendance: 3 },
];

export default function OnlineLibraryDashboard() {
  const [members, setMembers] = useState([]);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [activityLog, setActivityLog] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [personalRecords, setPersonalRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // 초기 데이터 로드
  useEffect(() => {
    loadInitialData();

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
          // 새 로그에 회원 정보 추가
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
  }, [members]);

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

  // 입퇴실 처리
  const handleAction = async (memberId, action) => {
    try {
      const isEntering = action === 'enter';

      // 1. attendance_logs에 기록 추가
      const { error: logError } = await supabase
        .from('attendance_logs')
        .insert({
          member_id: memberId,
          action: action
        });

      if (logError) throw logError;

      // 2. online_status 업데이트
      const { error: statusError } = await supabase
        .from('online_status')
        .update({
          is_online: isEntering,
          [isEntering ? 'last_enter' : 'last_exit']: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('member_id', memberId);

      if (statusError) throw statusError;

      // 로컬 상태 즉시 업데이트
      setOnlineStatus(prev => ({
        ...prev,
        [memberId]: isEntering
      }));

      // 활동 로그에 추가
      const member = members.find(m => m.id === memberId);
      if (member) {
        const newLog = {
          id: Date.now(),
          member_id: memberId,
          member_name: member.name,
          avatar: member.avatar,
          action: action,
          logged_at: new Date().toISOString()
        };
        setActivityLog(prev => [newLog, ...prev].slice(0, 10));
      }

    } catch (error) {
      console.error('Error handling action:', error);
      alert('처리 중 오류가 발생했습니다.');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📚 온라인 도서관</h1>
            <p className="text-gray-500 mt-1">실시간 입퇴실 현황 대시보드</p>
          </div>
          <div className="flex items-center gap-4">
            {/* 날짜 선택 */}
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border">
              <button onClick={() => changeDate(-1)} className="p-1 hover:bg-gray-100 rounded">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="font-medium">
                {selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              <button onClick={() => changeDate(1)} className="p-1 hover:bg-gray-100 rounded">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {/* Google Meet 링크 */}
            <a
              href={GOOGLE_MEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              도서관 입장하기
            </a>
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">현재 접속자</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{onlineCount}명</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-600">● 온라인</span>
            <span className="text-gray-400 ml-2">/ 전체 {members.length}명</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">평균 출석률</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{avgAttendance}%</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${avgAttendance}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">총 학습시간</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalStudyHours}h</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">이번 달 누적</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">오늘 입실</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {activityLog.filter(l => l.action === 'enter').length}회
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <LogIn className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">실시간 업데이트 중</p>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="grid grid-cols-3 gap-6">
        {/* 회원 목록 */}
        <div className="col-span-2 bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">👥 회원 현황</h2>
          <div className="grid grid-cols-2 gap-3">
            {members.map(member => {
              const isOnline = onlineStatus[member.id] || false;
              return (
                <div
                  key={member.id}
                  onClick={() => handleUserClick(member)}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <span className="text-2xl">{member.avatar}</span>
                      <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                        isOnline ? 'bg-green-500' : 'bg-gray-300'
                      }`}></span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.total_hours || 0}h 학습</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAction(member.id, 'enter'); }}
                      disabled={isOnline}
                      className={`p-2 rounded-lg transition-colors ${
                        isOnline
                          ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                          : 'bg-green-100 text-green-600 hover:bg-green-200'
                      }`}
                    >
                      <LogIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAction(member.id, 'exit'); }}
                      disabled={!isOnline}
                      className={`p-2 rounded-lg transition-colors ${
                        !isOnline
                          ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      }`}
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 실시간 활동 로그 */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">📋 실시간 기록</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activityLog.length === 0 ? (
              <p className="text-gray-400 text-center py-8">활동 기록이 없습니다</p>
            ) : (
              activityLog.map(log => (
                <div key={log.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg animate-fadeIn">
                  <span className="text-xl">{log.avatar}</span>
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

      {/* 통계 차트 */}
      <div className="grid grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">📊 주간 학습시간</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                formatter={(value) => [`${value}시간`, '학습시간']}
              />
              <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">📈 주간 출석 현황</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                formatter={(value) => [`${value}명`, '출석인원']}
              />
              <Line
                type="monotone"
                dataKey="attendance"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#10b981' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* D-day 대시보드 */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold">🎯 D-day 카운트다운</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
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
              <div className={`p-5 rounded-xl border-2 ${
                isToday ? 'bg-red-50 border-red-300' :
                isPast ? 'bg-gray-50 border-gray-200' :
                'bg-gradient-to-br from-orange-50 to-red-50 border-orange-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500">2026.02.06 (금)</p>
                    <h3 className="font-bold text-gray-900 mt-1">임상심리전문가 필기</h3>
                    <p className="text-xs text-gray-500 mt-1">기초 / 임상</p>
                  </div>
                  <div className={`text-right ${isPast ? 'opacity-50' : ''}`}>
                    <p className={`text-3xl font-black ${
                      isToday ? 'text-red-600' :
                      isPast ? 'text-gray-400' :
                      diffDays <= 7 ? 'text-red-500' :
                      diffDays <= 14 ? 'text-orange-500' :
                      'text-blue-600'
                    }`}>
                      {isToday ? 'D-Day' : isPast ? `D+${Math.abs(diffDays)}` : `D-${diffDays}`}
                    </p>
                    {!isPast && !isToday && (
                      <p className="text-xs text-gray-400 mt-1">
                        {diffDays <= 7 ? '🔥 화이팅!' : diffDays <= 14 ? '💪 조금만 더!' : '📚 꾸준히!'}
                      </p>
                    )}
                  </div>
                </div>
                {!isPast && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          diffDays <= 7 ? 'bg-red-500' : diffDays <= 14 ? 'bg-orange-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, (1 - diffDays / 30) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                )}
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
              <div className={`p-5 rounded-xl border-2 ${
                isToday ? 'bg-red-50 border-red-300' :
                isPast ? 'bg-gray-50 border-gray-200' :
                'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500">2026.02.07 (토)</p>
                    <h3 className="font-bold text-gray-900 mt-1">임상심리전문가 면접</h3>
                    <p className="text-xs text-gray-500 mt-1">구술시험</p>
                  </div>
                  <div className={`text-right ${isPast ? 'opacity-50' : ''}`}>
                    <p className={`text-3xl font-black ${
                      isToday ? 'text-red-600' :
                      isPast ? 'text-gray-400' :
                      diffDays <= 7 ? 'text-red-500' :
                      diffDays <= 14 ? 'text-orange-500' :
                      'text-purple-600'
                    }`}>
                      {isToday ? 'D-Day' : isPast ? `D+${Math.abs(diffDays)}` : `D-${diffDays}`}
                    </p>
                    {!isPast && !isToday && (
                      <p className="text-xs text-gray-400 mt-1">
                        {diffDays <= 7 ? '🔥 화이팅!' : diffDays <= 14 ? '💪 조금만 더!' : '📚 꾸준히!'}
                      </p>
                    )}
                  </div>
                </div>
                {!isPast && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          diffDays <= 7 ? 'bg-red-500' : diffDays <= 14 ? 'bg-orange-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, (1 - diffDays / 30) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* 개인 기록 모달 */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedUser.avatar}</span>
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
