# 관리자 대시보드 설정 가이드

## 🔧 필수 설정

### 1. auth-guard.js 설정

`auth-guard.js` 파일을 열어 다음 값을 수정하세요:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
const ADMIN_KAKAO_ID = 'YOUR_ADMIN_KAKAO_ID';
const KAKAO_JS_KEY = 'YOUR_KAKAO_JS_KEY';
```

#### 값 가져오기:

**SUPABASE_URL, SUPABASE_ANON_KEY:**
- Supabase Dashboard → Settings → API
- Project URL과 anon public key 복사

**ADMIN_KAKAO_ID:**
- 관리자로 등록할 카카오 ID
- Edge Functions 환경변수와 동일한 값 사용
- 카카오 개발자 콘솔에서 확인 가능

**KAKAO_JS_KEY:**
- 카카오 개발자 콘솔: https://developers.kakao.com/
- 내 애플리케이션 → 앱 키 → **JavaScript 키** 복사

---

### 2. admin.js 설정

`admin.js` 파일을 열어 다음 값을 수정하세요:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
const ADMIN_KAKAO_ID = 'YOUR_ADMIN_KAKAO_ID';
```

(auth-guard.js와 동일한 값 사용)

---

## 🔒 보안 기능

### 카카오 로그인 인증

1. **초기 접속**: 카카오 로그인 화면 표시
2. **카카오 로그인**: 사용자 카카오 계정으로 로그인
3. **관리자 검증**: 로그인한 카카오 ID가 `ADMIN_KAKAO_ID`와 일치하는지 확인
4. **API 검증**: Supabase API 호출하여 실제 관리자 권한 확인
5. **세션 유지**: localStorage에 토큰 저장 (브라우저 종료 시까지)
6. **자동 로그아웃**: 권한 없는 사용자는 즉시 차단

### 접근 제어 흐름

```
사용자 접속
  ↓
카카오 로그인
  ↓
카카오 ID 확인
  ↓
[일치하지 않음] → ❌ 접근 거부
  ↓
[일치함]
  ↓
Supabase API 검증
  ↓
[실패] → ❌ 접근 거부
  ↓
[성공] → ✅ 대시보드 접근 허용
```

---

## 📝 카카오 개발자 설정

### 1. Web 플랫폼 등록

- 카카오 개발자 콘솔 → 내 애플리케이션
- 플랫폼 설정 → Web 플랫폼 등록
- 사이트 도메인 추가:
  ```
  https://ytp20231992.github.io
  ```

### 2. Redirect URI 설정

- 제품 설정 → 카카오 로그인 → Redirect URI
- URI 추가:
  ```
  https://ytp20231992.github.io/sanga-admin/
  ```

### 3. 동의 항목 설정

- 제품 설정 → 카카오 로그인 → 동의 항목
- 필수 동의:
  - 닉네임
  - 프로필 사진

---

## 🧪 테스트

### 1. 로컬 테스트

```bash
cd backend/admin
python -m http.server 8080
```

브라우저에서 http://localhost:8080 접속

**예상 동작:**
1. 카카오 로그인 화면 표시
2. 카카오 로그인 버튼 클릭
3. 관리자 카카오 ID로 로그인
4. 대시보드 화면 표시

### 2. GitHub Pages 테스트

https://ytp20231992.github.io/sanga-admin/ 접속

**주의사항:**
- `auth-guard.js`와 `admin.js`의 설정값이 모두 올바른지 확인
- 카카오 개발자 콘솔에서 도메인과 Redirect URI가 등록되어 있는지 확인

---

## 🐛 문제 해결

### 문제 1: "사용자 목록 로드 실패"

**원인**: Supabase API 키 미설정 또는 잘못된 값

**해결**:
1. `auth-guard.js`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 확인
2. `admin.js`의 동일한 값 확인
3. Supabase Dashboard에서 API 키 재확인

### 문제 2: "Kakao is not defined"

**원인**: 카카오 SDK 로딩 실패

**해결**:
1. 인터넷 연결 확인
2. 브라우저 콘솔에서 네트워크 오류 확인
3. 페이지 새로고침

### 문제 3: "관리자 권한이 없습니다"

**원인**: 카카오 ID 불일치

**해결**:
1. 로그인한 카카오 ID 확인
2. `auth-guard.js`의 `ADMIN_KAKAO_ID` 값 확인
3. Edge Functions 환경변수 `ADMIN_KAKAO_ID` 확인
4. 모든 값이 정확히 일치하는지 확인 (공백, 대소문자 주의)

### 문제 4: 카카오 로그인 팝업이 안 뜸

**원인**: 카카오 개발자 설정 누락

**해결**:
1. 카카오 개발자 콘솔 → 내 애플리케이션
2. Web 플랫폼 등록 확인
3. Redirect URI 등록 확인
4. JavaScript 키 활성화 확인

---

## 🔐 추가 보안 권장사항

### 1. GitHub Pages를 Private Repository로

- Repository → Settings → Change visibility → Make private
- ⚠️ Private repository는 GitHub Pro 이상 필요

### 2. IP 화이트리스트 (Cloudflare 사용 시)

Cloudflare로 도메인을 연결한 경우:
- Cloudflare → Firewall Rules
- IP 화이트리스트 규칙 추가

### 3. 2단계 인증 추가 (OTP)

카카오 로그인 후 추가로 OTP 인증을 요구할 수 있습니다.
(향후 개선 사항)

---

## 📊 현재 보안 수준

| 기능 | 상태 |
|------|------|
| 카카오 로그인 인증 | ✅ 구현됨 |
| 관리자 ID 검증 | ✅ 구현됨 |
| Supabase API 검증 | ✅ 구현됨 |
| 세션 관리 | ✅ 구현됨 |
| 자동 로그아웃 | ✅ 구현됨 |
| HTTPS 통신 | ✅ GitHub Pages 기본 제공 |
| IP 화이트리스트 | ❌ 미구현 |
| 2단계 인증 (OTP) | ❌ 미구현 |
| 활동 로그 | ❌ 미구현 |

---

## ✅ 배포 체크리스트

- [ ] `auth-guard.js` 설정 완료
- [ ] `admin.js` 설정 완료
- [ ] 카카오 개발자 콘솔 Web 플랫폼 등록
- [ ] 카카오 Redirect URI 등록
- [ ] 로컬 테스트 성공
- [ ] GitHub에 Push
- [ ] GitHub Pages 활성화 확인
- [ ] 실제 URL에서 카카오 로그인 테스트 성공
- [ ] 관리자 권한 확인 성공
- [ ] 사용자 목록 로드 성공

---

**설정 완료 후 관리자 대시보드를 안전하게 사용할 수 있습니다!**
