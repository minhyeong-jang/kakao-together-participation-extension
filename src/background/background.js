// 카카오같이가치 자동 참여 Service Worker
class KakaoTogetherAutomation {
  constructor() {
    this.isRunning = false;
    this.defaultComments = [
      '응원합니다!',
      '좋은 일에 함께할 수 있어 기쁩니다.',
      '의미있는 활동이네요!',
      '작은 힘이지만 보탭니다.',
      '함께 만들어가요!'
    ];
    this.baseUrl = 'https://together.kakao.com';
    this.init();
  }

  init() {
    // 익스텐션 설치 시 초기 설정
    chrome.runtime.onInstalled.addListener(() => {
      this.setupDefaultSettings();
      this.setupAlarm();
    });

    // 알람 이벤트 리스너
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'kakao-together-daily') {
        this.executeAutomation();
      }
    });

    // 메시지 리스너 (팝업에서 오는 명령 처리)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 비동기 응답을 위해 true 반환
    });
  }

  async setupDefaultSettings() {
    const defaultSettings = {
      isEnabled: true,
      comments: this.defaultComments,
      lastExecutionTime: null,
      participatedContentIds: [],
      executionLog: []
    };

    // 기존 설정이 없으면 기본값 설정
    const existing = await chrome.storage.local.get(Object.keys(defaultSettings));
    const toSet = {};
    
    for (const [key, value] of Object.entries(defaultSettings)) {
      if (existing[key] === undefined) {
        toSet[key] = value;
      }
    }

    if (Object.keys(toSet).length > 0) {
      await chrome.storage.local.set(toSet);
    }
  }

  setupAlarm() {
    // 매일 오전 9시에 실행되도록 설정 (사용자가 설정 가능하도록 추후 확장 예정)
    chrome.alarms.create('kakao-together-daily', {
      when: this.getNextExecutionTime(),
      periodInMinutes: 24 * 60 // 24시간마다 반복
    });
  }

  getNextExecutionTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 오전 9시로 설정
    return tomorrow.getTime();
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'getStatus':
          sendResponse(await this.getStatus());
          break;
        case 'toggleEnabled':
          sendResponse(await this.toggleEnabled());
          break;
        case 'executeNow':
          sendResponse(await this.executeAutomation());
          break;
        case 'getSettings':
          sendResponse(await this.getSettings());
          break;
        case 'updateSettings':
          sendResponse(await this.updateSettings(request.settings));
          break;
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async getStatus() {
    const data = await chrome.storage.local.get(['isEnabled', 'lastExecutionTime', 'executionLog']);
    return {
      success: true,
      isEnabled: data.isEnabled ?? true,
      lastExecutionTime: data.lastExecutionTime,
      isRunning: this.isRunning,
      recentLogs: (data.executionLog || []).slice(-5)
    };
  }

  async toggleEnabled() {
    const { isEnabled } = await chrome.storage.local.get('isEnabled');
    const newStatus = !isEnabled;
    await chrome.storage.local.set({ isEnabled: newStatus });
    
    return {
      success: true,
      isEnabled: newStatus
    };
  }

  async getSettings() {
    const data = await chrome.storage.local.get(['comments', 'isEnabled']);
    return {
      success: true,
      comments: data.comments || this.defaultComments,
      isEnabled: data.isEnabled ?? true
    };
  }

  async updateSettings(settings) {
    await chrome.storage.local.set(settings);
    return { success: true };
  }

  async executeAutomation() {
    if (this.isRunning) {
      return { success: false, error: '이미 실행 중입니다.' };
    }

    const { isEnabled } = await chrome.storage.local.get('isEnabled');
    if (!isEnabled) {
      return { success: false, error: '자동화 기능이 비활성화되어 있습니다.' };
    }

    this.isRunning = true;
    const startTime = new Date();
    let result = { success: false, processedCount: 0, errors: [] };

    try {
      // 로그인 상태 확인
      const isLoggedIn = await this.checkLoginStatus();
      if (!isLoggedIn) {
        throw new Error('카카오 로그인이 필요합니다.');
      }

      // 기부 목록 가져오기
      const contentList = await this.fetchContentList();
      if (!contentList || contentList.length === 0) {
        throw new Error('기부 목록을 가져올 수 없습니다.');
      }

      console.log(`📊 총 ${contentList.length}개 기부 항목 발견`);

      // 이미 참여한 항목 확인
      const { participatedContentIds } = await chrome.storage.local.get('participatedContentIds');
      const participated = new Set(participatedContentIds || []);

      console.log(`📝 이미 참여한 항목: ${participated.size}개`);

      // 새로운 항목들 필터링 (id 기반)
      const newContents = contentList.filter(content => {
        // STATUS_FUNDING인 항목만 처리
        if (content.status !== 'STATUS_FUNDING') {
          return false;
        }
        
        // 이미 참여한 항목 제외
        return !participated.has(content.id);
      });

      console.log(`🎯 새로 참여할 항목: ${newContents.length}개`);

      if (newContents.length === 0) {
        console.log('✅ 모든 항목에 이미 참여했습니다.');
        result.success = true;
        result.message = '모든 기부 항목에 이미 참여했습니다.';
        return result;
      }
      
      // 새로운 항목들에 대해 참여 처리
      for (const content of newContents) {
        try {
          console.log(`🎯 처리 중: [${content.id}] ${content.title}`);
          
          // 인간적 패턴을 위한 랜덤 지연 (2-5초)
          // 좋아요와 댓글 사이 고정 지연 추가 랜덤 지연 (1-2초)
          const delay1 = Math.random() * 1000 + 1000;
          await this.delay(delay1);

          // 좋아요 처리
          await this.performLike(content.id);
          console.log(`👍 좋아요 완료: ${content.title}`);
          
          // 좋아요와 댓글 사이 고정 지연 추가 랜덤 지연 (1-2초)
          const delay2 = Math.random() * 1000 + 1000;
          await this.delay(delay2);

          // 댓글 처리
          await this.performComment(content.id);
          console.log(`💬 댓글 완료: ${content.title}`);
          
          // 성공한 항목 ID 저장
          participated.add(content.id);
          result.processedCount++;

        } catch (error) {
          console.error(`❌ 항목 [${content.id}] 처리 중 오류:`, error);
          result.errors.push(`${content.title || content.id}: ${error.message}`);
          
          // 오류 발생 시에도 1초 지연
          await this.delay(1000);
        }
      }

      // 참여 기록 저장
      await chrome.storage.local.set({
        participatedContentIds: Array.from(participated),
        lastExecutionTime: startTime.toISOString()
      });

      // 실행 로그 저장
      await this.saveExecutionLog({
        timestamp: startTime.toISOString(),
        processedCount: result.processedCount,
        totalCount: contentList.length,
        newCount: newContents.length,
        skippedCount: contentList.length - newContents.length,
        errors: result.errors,
        duration: Date.now() - startTime.getTime()
      });

      result.success = true;

      // 알림 표시
      if (result.processedCount > 0) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: '카카오같이가치 자동 참여 완료',
          message: `${result.processedCount}개 항목에 참여했습니다.`
        });
      }

    } catch (error) {
      console.error('자동화 실행 중 오류:', error);
      result.error = error.message;
      
      // 에러 알림
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '카카오같이가치 자동 참여 오류',
        message: error.message
      });
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  async checkLoginStatus() {
    try {
      // 실제 로그인 상태 확인 API (추정)
      const response = await fetch(`${this.baseUrl}/api/v1/users/me`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      const isLoggedIn = response.ok;
      console.log(`🔐 로그인 상태 확인: ${isLoggedIn ? '✅ 로그인됨' : '❌ 로그인 필요'}`);
      return isLoggedIn;
      
    } catch (error) {
      console.error('로그인 상태 확인 오류:', error);
      return false;
    }
  }

  async fetchContentList() {
    try {
      const allContent = [];
      let currentPage = 1;
      let hasMorePages = true;
      const pageSize = 10; // API 기본 사이즈

      console.log('📋 기부 목록 수집 시작...');

      while (hasMorePages) {
        const url = `${this.baseUrl}/fundraisings/api/fundraisings/api/v1/fundraisings/now?sort=FUNDRAISING_END_AT&page=${currentPage}&size=${pageSize}&seed=${Date.now()}`;
        
        console.log(`📄 페이지 ${currentPage} 요청 중...`);
        
        const response = await fetch(url, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });

        if (!response.ok) {
          throw new Error(`API 호출 실패: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        
        // 실제 API 응답 구조에 맞춰 처리
        if (data.content && Array.isArray(data.content)) {
          allContent.push(...data.content);
          
          // 페이징 정보 확인
          hasMorePages = !data.last && currentPage < data.totalPages;
          currentPage++;
          
          console.log(`✅ 페이지 ${currentPage - 1}: ${data.content.length}개 항목 수집 (전체: ${allContent.length}/${data.totalElement})`);
          
          // API 부하 방지를 위한 지연
          if (hasMorePages) {
            await this.delay(500); // 0.5초 지연
          }
        } else {
          console.warn('예상과 다른 API 응답 구조:', data);
          hasMorePages = false;
        }

        // 무한 루프 방지 (최대 50페이지)
        if (currentPage > 50) {
          console.warn('최대 페이지 수 초과, 수집 중단');
          break;
        }
      }

      console.log(`🎉 총 ${allContent.length}개 기부 항목 수집 완료`);
      return allContent;
      
    } catch (error) {
      console.error('기부 목록 조회 오류:', error);
      throw new Error(`기부 목록을 가져올 수 없습니다: ${error.message}`);
    }
  }

  async performLike(contentId) {
    try {
      console.log(`👍 좋아요 시도 [${contentId}]`);

      // 실제 좋아요 API 엔드포인트
      const response = await fetch(`${this.baseUrl}/fundraisings/together-api/api/fundraisings/${contentId}/signs`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': `${this.baseUrl}/fundraisings/${contentId}`,
          'Origin': this.baseUrl
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`좋아요 실패: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ 좋아요 성공 [${contentId}]:`, result);
      return result;
      
    } catch (error) {
      console.error(`❌ 좋아요 처리 오류 [${contentId}]:`, error);
      throw new Error(`좋아요 실패: ${error.message}`);
    }
  }

  async performComment(contentId) {
    try {
      const { comments } = await chrome.storage.local.get('comments');
      const commentList = comments || this.defaultComments;
      const randomComment = commentList[Math.floor(Math.random() * commentList.length)];

      console.log(`💬 댓글 작성 시도 [${contentId}]: "${randomComment}"`);

      // 실제 댓글 API 엔드포인트
      const response = await fetch('https://together-api-gw.kakao.com/fundraisings/api/v2/comments', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': `${this.baseUrl}/fundraisings/${contentId}`,
          'Origin': this.baseUrl
        },
        body: JSON.stringify({
          contentId: parseInt(contentId),
          contentType: 'FUNDRAISING',
          message: randomComment
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`댓글 작성 실패: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ 댓글 성공 [${contentId}]:`, result);
      return result;
      
    } catch (error) {
      console.error(`❌ 댓글 작성 오류 [${contentId}]:`, error);
      throw new Error(`댓글 작성 실패: ${error.message}`);
    }
  }

  async saveExecutionLog(logEntry) {
    const { executionLog } = await chrome.storage.local.get('executionLog');
    const logs = executionLog || [];
    
    logs.push(logEntry);
    
    // 최대 50개 로그만 유지
    if (logs.length > 50) {
      logs.splice(0, logs.length - 50);
    }

    await chrome.storage.local.set({ executionLog: logs });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Service Worker 인스턴스 생성
new KakaoTogetherAutomation();
