// Web Push API를 사용한 푸시 알림 설정
// Supabase를 사용하여 푸시 알림 구현

// Web Push 토큰 가져오기
export async function getPushToken(): Promise<string | null> {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('이 브라우저는 Web Push를 지원하지 않습니다.');
      return null;
    }

    // Notification 권한 확인
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('알림 권한이 거부되었습니다.');
        return null;
      }
    }

    // Service Worker 등록
    const registration = await navigator.serviceWorker.ready;
    
    // VAPID 공개 키 (환경 변수에서 가져오기)
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn('VAPID 공개 키가 설정되지 않았습니다.');
      return null;
    }

    // Push 구독 생성
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    // 구독 정보를 JSON 문자열로 변환하여 저장
    const subscriptionJson = JSON.stringify(subscription);
    console.log('Web Push 토큰 획득 성공');
    
    return subscriptionJson;
  } catch (error) {
    console.error('Web Push 토큰 가져오기 오류:', error);
    return null;
  }
}

// VAPID 공개 키를 Uint8Array로 변환
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

// Service Worker 등록
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service Worker를 지원하지 않는 브라우저입니다.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('Service Worker 등록 성공:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker 등록 실패:', error);
    return null;
  }
}

// 백그라운드 위치 추적 시작 (Service Worker에 메시지 전송)
export function startBackgroundLocationTracking() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.ready.then((registration) => {
    if (registration.active) {
      registration.active.postMessage({
        type: 'START_LOCATION_TRACKING'
      });
      console.log('백그라운드 위치 추적 시작 요청 전송');
    }
  });
}

// 백그라운드 위치 추적 중지
export function stopBackgroundLocationTracking() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.ready.then((registration) => {
    if (registration.active) {
      registration.active.postMessage({
        type: 'STOP_LOCATION_TRACKING'
      });
      console.log('백그라운드 위치 추적 중지 요청 전송');
    }
  });
}

