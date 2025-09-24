import React, { useState, useEffect } from 'react';

const Popup = () => {
  const [status, setStatus] = useState({
    isEnabled: true,
    lastExecutionTime: null,
    isRunning: false,
    recentLogs: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
      if (response.success) {
        setStatus(response);
      }
    } catch (error) {
      console.error('상태 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEnabled = async () => {
    try {
      setLoading(true);
      const response = await chrome.runtime.sendMessage({ action: 'toggleEnabled' });
      if (response.success) {
        setStatus(prev => ({ ...prev, isEnabled: response.isEnabled }));
      }
    } catch (error) {
      console.error('설정 변경 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeNow = async () => {
    try {
      setLoading(true);
      setStatus(prev => ({ ...prev, isRunning: true }));
      
      const response = await chrome.runtime.sendMessage({ action: 'executeNow' });
      
      if (response.success) {
        alert(`성공적으로 ${response.processedCount}개 항목에 참여했습니다!`);
      } else {
        alert(`오류가 발생했습니다: ${response.error}`);
      }
      
      // 상태 새로고침
      await loadStatus();
    } catch (error) {
      console.error('즉시 실행 오류:', error);
      alert('실행 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setStatus(prev => ({ ...prev, isRunning: false }));
    }
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const openKakaoTogether = () => {
    chrome.tabs.create({ url: 'https://together.kakao.com' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '없음';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR');
  };

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      {/* 헤더 */}
      <div className="header">
        <div className="logo">
          <span className="logo-icon">💝</span>
          <span className="logo-text">카카오같이가치</span>
        </div>
        <div className="version">v1.0</div>
      </div>

      {/* 상태 표시 */}
      <div className="status-section">
        <div className="status-item">
          <div className="status-label">자동화 상태</div>
          <div className={`status-value ${status.isEnabled ? 'enabled' : 'disabled'}`}>
            {status.isEnabled ? '활성화' : '비활성화'}
          </div>
        </div>
        
        <div className="status-item">
          <div className="status-label">마지막 실행</div>
          <div className="status-value">
            {formatDate(status.lastExecutionTime)}
          </div>
        </div>

        {status.isRunning && (
          <div className="status-item">
            <div className="running-indicator">
              <span className="spinner"></span>
              실행 중...
            </div>
          </div>
        )}
      </div>

      {/* 컨트롤 버튼 */}
      <div className="control-section">
        <button
          className={`toggle-btn ${status.isEnabled ? 'enabled' : 'disabled'}`}
          onClick={toggleEnabled}
          disabled={loading || status.isRunning}
        >
          {status.isEnabled ? '자동화 끄기' : '자동화 켜기'}
        </button>

        <button
          className="execute-btn"
          onClick={executeNow}
          disabled={loading || status.isRunning || !status.isEnabled}
        >
          지금 실행하기
        </button>
      </div>

      {/* 최근 실행 로그 */}
      {status.recentLogs && status.recentLogs.length > 0 && (
        <div className="log-section">
          <div className="log-title">최근 실행 기록</div>
          <div className="log-list">
            {status.recentLogs.map((log, index) => (
              <div key={index} className="log-item">
                <div className="log-time">{formatDate(log.timestamp)}</div>
                <div className="log-content">
                  {log.processedCount}개 참여 완료
                  {log.errors && log.errors.length > 0 && (
                    <span className="log-errors"> ({log.errors.length}개 오류)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 하단 링크 */}
      <div className="footer">
        <button className="link-btn" onClick={openKakaoTogether}>
          카카오같이가치 열기
        </button>
        <button className="link-btn" onClick={openOptions}>
          설정
        </button>
      </div>

      {/* 주의사항 */}
      <div className="notice">
        <div className="notice-title">⚠️ 주의사항</div>
        <div className="notice-content">
          • 카카오 로그인 상태를 유지해주세요<br/>
          • 과도한 사용은 계정 제재의 위험이 있습니다<br/>
          • 개인 사용 목적으로만 사용해주세요
        </div>
      </div>
    </div>
  );
};

export default Popup;
