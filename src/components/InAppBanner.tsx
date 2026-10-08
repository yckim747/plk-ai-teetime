import { detectInApp, openInExternalBrowser } from "../inApp";

/** 앱 안 브라우저에서 열렸을 때 외부 브라우저로 열도록 안내하는 띠 */
export function InAppBanner() {
  const kind = detectInApp();
  if (!kind) return null;
  return (
    <div className="inapp-banner" role="note">
      {kind === "kakao" ? (
        <>
          <span>카카오톡 안에서는 음성 기능이 제한될 수 있어요.</span>
          <button type="button" className="btn primary" onClick={openInExternalBrowser}>
            Safari·Chrome으로 열기
          </button>
        </>
      ) : (
        <span>앱 안 브라우저에서는 음성 기능이 제한될 수 있어요. 오른쪽 위 메뉴(⋯)에서 '브라우저로 열기'를 눌러 주세요.</span>
      )}
    </div>
  );
}
