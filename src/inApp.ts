/**
 * 메신저·SNS 앱 안의 브라우저 감지.
 * 카카오톡 등 앱 안 브라우저에서는 마이크 권한이나 소리 재생이 막히는 경우가 많아,
 * 사파리·크롬(외부 브라우저)에서 열도록 안내한다.
 */
export type InAppKind = "kakao" | "other";

export function detectInApp(ua = navigator.userAgent): InAppKind | null {
  if (/KAKAOTALK/i.test(ua)) return "kakao";
  // 인스타그램·페이스북·네이버·라인 앱, 안드로이드 일반 웹뷰("; wv)")
  if (/Instagram|FBAN|FBAV|NAVER\(inapp|\bLine\/|; wv\)/i.test(ua)) return "other";
  return null;
}

/** 카카오톡에서 지금 주소를 외부 브라우저로 다시 연다 (카카오톡 공식 스킴) */
export function openInExternalBrowser() {
  location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}`;
}

const TRIED_KEY = "plk.openExternalTried";

/** 카카오톡 안에서 처음 열렸으면 한 번만 자동으로 외부 브라우저 전환을 시도한다 */
export function autoOpenExternalOnce() {
  if (detectInApp() !== "kakao") return;
  try {
    if (sessionStorage.getItem(TRIED_KEY)) return;
    sessionStorage.setItem(TRIED_KEY, "1");
  } catch {
    // 저장 불가 환경에서도 한 번은 시도
  }
  openInExternalBrowser();
}
