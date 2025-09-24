import React, { useState, useEffect } from 'react';

const Options = () => {
  const [settings, setSettings] = useState({
    comments: [],
    isEnabled: true
  });
  const [newComment, setNewComment] = useState('');
  const [executionLog, setExecutionLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    loadExecutionLog();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (response.success) {
        setSettings(response);
      }
    } catch (error) {
      console.error('설정 로드 오류:', error);
    }
  };

  const loadExecutionLog = async () => {
    try {
      const data = await chrome.storage.local.get('executionLog');
      setExecutionLog(data.executionLog || []);
    } catch (error) {
      console.error('로그 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: {
          comments: settings.comments,
          isEnabled: settings.isEnabled
        }
      });

      if (response.success) {
        alert('설정이 저장되었습니다.');
      } else {
        alert('설정 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('설정 저장 오류:', error);
      alert('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const addComment = () => {
    if (newComment.trim() && !settings.comments.includes(newComment.trim())) {
      setSettings(prev => ({
        ...prev,
        comments: [...prev.comments, newComment.trim()]
      }));
      setNewComment('');
    }
  };

  const removeComment = (index) => {
    setSettings(prev => ({
      ...prev,
      comments: prev.comments.filter((_, i) => i !== index)
    }));
  };

  const resetToDefault = () => {
    if (confirm('기본 댓글로 초기화하시겠습니까?')) {
      setSettings(prev => ({
        ...prev,
        comments: [
          '응원합니다!',
          '좋은 일에 함께할 수 있어 기쁩니다.',
          '의미있는 활동이네요!',
          '작은 힘이지만 보탭니다.',
          '함께 만들어가요!'
        ]
      }));
    }
  };

  const clearExecutionLog = async () => {
    if (confirm('모든 실행 기록을 삭제하시겠습니까?')) {
      try {
        await chrome.storage.local.set({ executionLog: [] });
        setExecutionLog([]);
        alert('실행 기록이 삭제되었습니다.');
      } catch (error) {
        console.error('로그 삭제 오류:', error);
        alert('로그 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const clearParticipationHistory = async () => {
    if (confirm('참여 기록을 삭제하면 이미 참여한 항목에도 다시 참여하게 됩니다. 계속하시겠습니까?')) {
      try {
        await chrome.storage.local.set({ participatedContentIds: [] });
        alert('참여 기록이 삭제되었습니다.');
      } catch (error) {
        console.error('참여 기록 삭제 오류:', error);
        alert('참여 기록 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR');
  };

  if (loading) {
    return (
      <div className="options-container">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="options-container">
      <div className="header">
        <h1>카카오같이가치 자동 참여 설정</h1>
        <div className="version">Version 1.0</div>
      </div>

      <div className="content">
        {/* 기본 설정 */}
        <section className="section">
          <h2>기본 설정</h2>
          <div className="setting-item">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.isEnabled}
                onChange={(e) => setSettings(prev => ({ ...prev, isEnabled: e.target.checked }))}
              />
              자동화 기능 활성화
            </label>
            <p className="setting-description">
              매일 자동으로 카카오같이가치 항목에 참여합니다.
            </p>
          </div>
        </section>

        {/* 댓글 관리 */}
        <section className="section">
          <h2>댓글 관리</h2>
          <div className="comment-manager">
            <div className="comment-input">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="새 댓글을 입력하세요"
                maxLength={100}
                onKeyPress={(e) => e.key === 'Enter' && addComment()}
              />
              <button onClick={addComment} disabled={!newComment.trim()}>
                추가
              </button>
            </div>

            <div className="comment-list">
              {settings.comments.map((comment, index) => (
                <div key={index} className="comment-item">
                  <span className="comment-text">{comment}</span>
                  <button 
                    className="remove-btn"
                    onClick={() => removeComment(index)}
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="comment-actions">
              <button onClick={resetToDefault} className="secondary-btn">
                기본 댓글로 초기화
              </button>
              <span className="comment-count">
                총 {settings.comments.length}개 댓글 (랜덤으로 사용됨)
              </span>
            </div>
          </div>
        </section>

        {/* 실행 기록 */}
        <section className="section">
          <h2>실행 기록</h2>
          <div className="log-manager">
            <div className="log-actions">
              <button onClick={clearExecutionLog} className="danger-btn">
                실행 기록 삭제
              </button>
              <button onClick={clearParticipationHistory} className="danger-btn">
                참여 기록 초기화
              </button>
            </div>

            <div className="log-list">
              {executionLog.length === 0 ? (
                <div className="empty-log">실행 기록이 없습니다.</div>
              ) : (
                executionLog.slice().reverse().map((log, index) => (
                  <div key={index} className="log-entry">
                    <div className="log-header">
                      <span className="log-date">{formatDate(log.timestamp)}</span>
                      <span className={`log-status ${log.errors && log.errors.length > 0 ? 'warning' : 'success'}`}>
                        {log.processedCount}개 참여 완료
                      </span>
                    </div>
                    
                    {log.errors && log.errors.length > 0 && (
                      <div className="log-errors">
                        <div className="error-title">오류 ({log.errors.length}개):</div>
                        {log.errors.map((error, errorIndex) => (
                          <div key={errorIndex} className="error-item">{error}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* 주의사항 */}
        <section className="section notice-section">
          <h2>⚠️ 주의사항</h2>
          <div className="notice-content">
            <ul>
              <li>이 익스텐션은 개인 사용 목적으로만 사용해주세요.</li>
              <li>과도한 사용은 카카오 계정 제재의 위험이 있습니다.</li>
              <li>카카오 로그인 상태를 유지해야 정상 작동합니다.</li>
              <li>카카오의 정책 변경에 따라 기능이 중단될 수 있습니다.</li>
              <li>API 호출 간격은 인간의 행동 패턴을 모방하여 설정되었습니다.</li>
            </ul>
          </div>
        </section>
      </div>

      {/* 저장 버튼 */}
      <div className="save-section">
        <button 
          onClick={saveSettings} 
          className="save-btn"
          disabled={saving}
        >
          {saving ? '저장 중...' : '설정 저장'}
        </button>
      </div>
    </div>
  );
};

export default Options;
