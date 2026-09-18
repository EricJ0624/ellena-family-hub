// Service Worker for Web Push and Background Location Tracking
// Supabase를 사용하여 푸시 알림 및 백그라운드 위치 추적 구현

// 푸시 알림 수신 처리
self.addEventListener('push', (event) => {
  console.log('[sw.js] 푸시 알림 수신:', event);
  
  let notificationData = {
    title: '📍 위치 요청',
    body: '누군가 당신의 위치를 요청했습니다.',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'location-request',
    requireInteraction: true,
    silent: false,
    vibrate: undefined,
    renotify: false,
    data: {}
  };

  // 푸시 데이터 파싱
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        tag: payload.tag || payload.data?.requestId || notificationData.tag,
        requireInteraction: true,
        silent: payload.silent === true,
        vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : undefined,
        renotify: payload.renotify === true,
        data: payload.data || {}
      };
    } catch (e) {
      console.warn('[sw.js] 푸시 데이터 파싱 실패, 기본값 사용:', e);
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    silent: notificationData.silent,
    renotify: notificationData.renotify,
    data: notificationData.data,
  };
  if (Array.isArray(notificationData.vibrate)) {
    options.vibrate = notificationData.vibrate;
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[sw.js] 알림 클릭:', event);
  
  event.notification.close();
  
  // 앱 열기 또는 특정 페이지로 이동
  const urlToOpen = event.notification.data?.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // 이미 열려있는 창이 있으면 포커스
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // 새 창 열기
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// 백그라운드 위치 추적
let locationWatchId = null;
let lastLocationUpdate = 0;
const LOCATION_UPDATE_INTERVAL = 30000; // 30초마다 위치 업데이트

// 위치 추적 시작
function startBackgroundLocationTracking() {
  if (!('geolocation' in navigator)) {
    console.warn('[sw.js] Geolocation API를 사용할 수 없습니다.');
    return;
  }

  if (locationWatchId !== null) {
    console.log('[sw.js] 위치 추적이 이미 시작되어 있습니다.');
    return;
  }

  console.log('[sw.js] 백그라운드 위치 추적 시작');

  const options = {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 5000
  };

  locationWatchId = navigator.geolocation.watchPosition(
    async (position) => {
      const now = Date.now();
      
      // 쓰로틀링: 최소 30초 간격으로 업데이트
      if (now - lastLocationUpdate < LOCATION_UPDATE_INTERVAL) {
        return;
      }
      
      lastLocationUpdate = now;

      const { latitude, longitude, accuracy } = position.coords;

      // 정확도 필터링 (100m 이상 오차는 무시)
      if (accuracy > 100) {
        console.warn('[sw.js] 낮은 정확도 위치 무시됨:', accuracy);
        return;
      }

      console.log('[sw.js] 위치 업데이트:', { latitude, longitude, accuracy });

      // 클라이언트에 위치 업데이트 메시지 전송
      try {
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({
            type: 'LOCATION_UPDATE',
            data: {
              latitude,
              longitude,
              accuracy,
              timestamp: new Date().toISOString()
            }
          });
        });
      } catch (error) {
        console.error('[sw.js] 위치 업데이트 메시지 전송 실패:', error);
      }
    },
    (error) => {
      console.error('[sw.js] 위치 추적 오류:', error);
      
      // 권한 거부 시 위치 추적 중지
      if (error.code === error.PERMISSION_DENIED) {
        stopBackgroundLocationTracking();
      }
    },
    options
  );
}

// 위치 추적 중지
function stopBackgroundLocationTracking() {
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
    console.log('[sw.js] 백그라운드 위치 추적 중지');
  }
}

// 메시지 수신 처리 (클라이언트에서 Service Worker로 메시지 전송)
self.addEventListener('message', (event) => {
  console.log('[sw.js] 메시지 수신:', event.data);

  if (event.data && event.data.type === 'START_LOCATION_TRACKING') {
    startBackgroundLocationTracking();
  } else if (event.data && event.data.type === 'STOP_LOCATION_TRACKING') {
    stopBackgroundLocationTracking();
  }
});

// Service Worker 활성화 시
self.addEventListener('activate', (event) => {
  console.log('[sw.js] Service Worker 활성화');
  event.waitUntil(self.clients.claim());
});

// Service Worker 설치 시
self.addEventListener('install', (event) => {
  console.log('[sw.js] Service Worker 설치');
  self.skipWaiting(); // 즉시 활성화
});

